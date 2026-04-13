import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type QueuePayload = {
  nodeId?: string
  clipKey?: string
  clipType?: string
  clipId?: string | null
  coreVideoKeys?: string[]
  validatedFromQuiz?: boolean
  result?: 'relevant' | 'not_yet' | 'known' | 'later' | 'irrelevant'
}

async function resolveUserAndClient(request: Request) {
  const supabase = createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()

  if (cookieUser) {
    return { user: cookieUser, client: supabase }
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const admin = token ? createAdminClient() : null

  if (!token || !admin) {
    return { user: null, client: supabase }
  }

  const {
    data: { user: tokenUser },
  } = await admin.auth.getUser(token)

  return { user: tokenUser ?? null, client: admin }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getKnownReviewOffset(streakCan: number) {
  if (streakCan <= 1) return 1
  if (streakCan === 2) return 3
  if (streakCan === 3) return 7
  return 14
}

function isMissingTrainingClipStatusError(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === '42P01' || Boolean(error?.message?.includes('training_clip_status'))
}

function normalizeCoreVideoKeys(body: QueuePayload) {
  const keys = Array.isArray(body.coreVideoKeys) ? body.coreVideoKeys.filter(Boolean) : []
  return Array.from(new Set(keys.length > 0 ? keys : body.clipKey ? [body.clipKey] : []))
}

async function updateLearningStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: QueuePayload,
  currentStep: number
) {
  if (!body.nodeId || !body.clipKey || !body.clipType || !body.result) return null

  const { data: existingStatus, error: statusLoadError } = await supabase
    .from('training_clip_status')
    .select('seen_count, can_count, cannot_count, streak_can, streak_cannot, confidence_score')
    .eq('user_id', userId)
    .eq('node_id', body.nodeId)
    .eq('clip_key', body.clipKey)
    .maybeSingle()

  if (statusLoadError) {
    if (isMissingTrainingClipStatusError(statusLoadError)) {
      return null
    }
    throw new Error(statusLoadError.message)
  }

  const seenCount = (existingStatus?.seen_count ?? 0) + 1
  const canCount = (existingStatus?.can_count ?? 0) + (body.result === 'known' ? 1 : 0)
  const cannotCount = (existingStatus?.cannot_count ?? 0) + (body.result === 'not_yet' ? 1 : 0)
  const streakCan = body.result === 'known' ? (existingStatus?.streak_can ?? 0) + 1 : 0
  const streakCannot = body.result === 'not_yet' ? (existingStatus?.streak_cannot ?? 0) + 1 : 0
  const confidenceDelta = body.result === 'known' ? 20 : body.result === 'not_yet' ? -25 : 0
  const confidenceScore = clamp((existingStatus?.confidence_score ?? 20) + confidenceDelta, 0, 100)
  const nextReviewStep =
    body.result === 'known'
      ? currentStep + getKnownReviewOffset(streakCan)
      : body.result === 'not_yet'
        ? currentStep + 2
        : currentStep + 1

  const payload = {
    user_id: userId,
    node_id: body.nodeId,
    clip_key: body.clipKey,
    clip_type: body.clipType,
    clip_id: body.clipId ?? null,
    seen_count: seenCount,
    can_count: canCount,
    cannot_count: cannotCount,
    streak_can: streakCan,
    streak_cannot: streakCannot,
    confidence_score: confidenceScore,
    last_result: body.result,
    next_review_step: nextReviewStep,
    last_seen_step: currentStep,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('training_clip_status')
    .upsert(payload, { onConflict: 'user_id,node_id,clip_key' })

  if (error) {
    if (isMissingTrainingClipStatusError(error)) {
      return null
    }
    throw new Error(error.message)
  }

  return payload
}

async function isNodeLearningComplete(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  nodeId: string,
  coreVideoKeys: string[]
) {
  if (coreVideoKeys.length === 0) return false

  const { data, error } = await supabase
    .from('training_clip_status')
    .select('clip_key, can_count, confidence_score, last_result')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .in('clip_key', coreVideoKeys)

  if (error) {
    if (isMissingTrainingClipStatusError(error)) {
      return false
    }
    throw new Error(error.message)
  }

  const statusByKey = new Map((data ?? []).map((status) => [status.clip_key, status]))
  return coreVideoKeys.every((clipKey) => {
    const status = statusByKey.get(clipKey)
    return (status?.can_count ?? 0) > 0 || status?.last_result === 'known'
  })
}

export async function POST(request: Request) {
  const { user, client: supabase } = await resolveUserAndClient(request)

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const body = (await request.json()) as QueuePayload

  if (!body.nodeId || !body.clipKey || !body.clipType || !body.result) {
    return NextResponse.json({ error: 'Unvollstaendige Queue-Daten.' }, { status: 400 })
  }

  const { count: previousEventCount, error: countError } = await supabase
    .from('training_clip_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  const currentStep = (previousEventCount ?? 0) + 1

  const { error: insertError } = await supabase.from('training_clip_events').insert({
    user_id: user.id,
    node_id: body.nodeId,
    clip_key: body.clipKey,
    clip_type: body.clipType,
    result: body.result,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  try {
    await updateLearningStatus(supabase, user.id, body, currentStep)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lernstatus konnte nicht gespeichert werden.' }, { status: 500 })
  }

  const { data: existingProgress } = await supabase
    .from('progress')
    .select('watched, drilled, attempted, hit_in_sparring, completed, completed_at, validated, validated_at')
    .eq('user_id', user.id)
    .eq('node_id', body.nodeId)
    .maybeSingle()

  let learnedCoreVideos = false
  try {
    learnedCoreVideos = await isNodeLearningComplete(supabase, user.id, body.nodeId, normalizeCoreVideoKeys(body))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lernfortschritt konnte nicht berechnet werden.' }, { status: 500 })
  }

  const hasClipCompletionRules = normalizeCoreVideoKeys(body).length > 0
  const nodeCompleted = Boolean(existingProgress?.completed) || (hasClipCompletionRules ? learnedCoreVideos : false)
  const validated = body.result === 'known' ? Boolean(existingProgress?.validated) || Boolean(body.validatedFromQuiz) : Boolean(existingProgress?.validated)

  const progressPayload = {
    user_id: user.id,
    node_id: body.nodeId,
    watched: true,
    drilled: Boolean(existingProgress?.drilled) || body.result === 'relevant' || body.result === 'not_yet' || body.result === 'known',
    attempted: Boolean(existingProgress?.attempted) || body.result === 'relevant' || body.result === 'known',
    hit_in_sparring: Boolean(existingProgress?.hit_in_sparring) || body.result === 'known',
    completed: nodeCompleted,
    completed_at: nodeCompleted ? existingProgress?.completed_at ?? new Date().toISOString() : null,
    validated,
    validated_at: validated ? existingProgress?.validated_at ?? new Date().toISOString() : null,
  }

  const { error: progressError } = await supabase.from('progress').upsert(progressPayload, { onConflict: 'user_id,node_id' })

  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nodeCompleted, wasAlreadyCompleted: Boolean(existingProgress?.completed) })
}
