import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-access'
import { normalizeClipHashtags } from '@/lib/clip-archive'
import { normalizeClipContentType, normalizeClipLearningPhase } from '@/lib/clip-taxonomy'
import { detectVideoFormat, getVideoPlatform } from '@/lib/video-format'

async function resolveAdmin(request: Request) {
  const supabase = createClient()
  const admin = createAdminClient()

  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()

  if (cookieUser) {
    return { user: cookieUser, admin }
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token || !admin) {
    return { user: null, admin }
  }

  const {
    data: { user: tokenUser },
  } = await admin.auth.getUser(token)

  return { user: tokenUser ?? null, admin }
}

export async function GET(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('runId')?.trim()
  const query = searchParams.get('query')?.trim()?.toLowerCase()
  const status = searchParams.get('status')?.trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100), 1), 200)
  let runExternalSourceIds: string[] = []

  if (runId) {
    const { data: runSourceRows, error: runSourceError } = await admin
      .from('external_technique_search_run_sources')
      .select('external_source_id')
      .eq('run_id', runId)

    if (runSourceError) {
      return NextResponse.json({ error: runSourceError.message }, { status: 500 })
    }

    runExternalSourceIds = (runSourceRows ?? [])
      .map((row) => row.external_source_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  }

  let builder = admin
    .from('clip_archive')
    .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, content_type, learning_phase, target_archetype_ids, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(limit)

  if (runId && runExternalSourceIds.length > 0) {
    builder = builder.in('external_source_id', runExternalSourceIds)
  } else if (runId) {
    builder = builder.eq('source_run_id', runId)
  }
  if (status) builder = builder.eq('assignment_status', status)

  const { data, error } = await builder

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Load assignments for clips to check which ones are already assigned
  const clipIds = (data ?? []).map((clip) => clip.id).filter((id): id is string => Boolean(id))
  let assignmentsMap = new Map<string, { id: string; role: string }>()
  
  if (clipIds.length > 0) {
    const { data: assignmentsData } = await admin
      .from('node_external_sources')
      .select('id, external_source_id, role')
      .in('external_source_id', clipIds)
    
    for (const assignment of assignmentsData ?? []) {
      if (assignment.external_source_id) {
        assignmentsMap.set(assignment.external_source_id, { id: assignment.id, role: assignment.role })
      }
    }
  }

  const clips = (data ?? []).map((clip) => ({
    ...clip,
    assignment_id: assignmentsMap.get(clip.id)?.id ?? null,
    assignment_role: assignmentsMap.get(clip.id)?.role ?? null,
  })).filter((clip) =>
    query ? [clip.title, clip.summary, clip.search_query].join(' ').toLowerCase().includes(query) : true
  )

  let sections: Array<{
    id: string
    runId: string
    sectionKey: string
    sectionTitle: string
    sectionOrder: number
    sectionSummary: string | null
    createdAt: string
    sources: Array<
      (typeof clips)[number] & {
        evidenceText: string | null
        sourceOrder: number
      }
    >
  }> = []

  if (runId) {
    const { data: sectionData, error: sectionError } = await admin
      .from('external_technique_search_run_sections')
      .select(
        'id, run_id, section_key, section_title, section_order, section_summary, created_at, external_technique_search_run_section_sources(external_source_id, source_order, evidence_text)'
      )
      .eq('run_id', runId)
      .order('section_order', { ascending: true })

    if (sectionError) {
      return NextResponse.json(
        {
          error: sectionError.message,
          hint: 'Pruefe, ob die Migration 20260404_outlierdb_search_run_sections.sql in Supabase ausgefuehrt wurde.',
        },
        { status: 500 }
      )
    }

    const clipByExternalSourceId = new Map(clips.map((clip) => [clip.external_source_id, clip]))
    sections = (sectionData ?? []).map((section) => {
      const clipEntries = (
        (section as unknown as {
          external_technique_search_run_section_sources?: Array<{ external_source_id?: string | null; source_order?: number }>
        }).external_technique_search_run_section_sources ?? []
      )
        .map((entry) => ({
          clip: entry.external_source_id ? clipByExternalSourceId.get(entry.external_source_id) : null,
          order: entry.source_order ?? 0,
          evidenceText: typeof (entry as { evidence_text?: unknown }).evidence_text === 'string' ? (entry as { evidence_text: string }).evidence_text : null,
        }))
        .filter((entry): entry is { clip: (typeof clips)[number]; order: number; evidenceText: string | null } => Boolean(entry.clip))
        .sort((a, b) => a.order - b.order)
        .map((entry) => ({
          ...entry.clip,
          evidenceText: entry.evidenceText,
          sourceOrder: entry.order,
        }))

      return {
        id: (section as { id: string }).id,
        runId: (section as { run_id: string }).run_id,
        sectionKey: (section as { section_key: string }).section_key,
        sectionTitle: (section as { section_title: string }).section_title,
        sectionOrder: (section as { section_order: number }).section_order,
        sectionSummary: (section as { section_summary: string | null }).section_summary,
        createdAt: (section as { created_at: string }).created_at,
        sources: clipEntries,
      }
    })
  }

  return NextResponse.json({ clips, sections })
}

export async function POST(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const body = (await request.json()) as {
    url?: string
    title?: string | null
    summary?: string | null
    hashtags?: string[] | string | null
    contentType?: string | null
    learningPhase?: string | null
    targetArchetypeIds?: string[] | null
    loopSeconds?: number | null
  }

  const url = body.url?.trim()
  if (!url) {
    return NextResponse.json({ error: 'Video-URL fehlt.' }, { status: 400 })
  }

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Bitte eine gueltige http(s)-URL angeben.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Bitte eine gueltige Video-URL angeben.' }, { status: 400 })
  }

  const title = body.title?.trim() || 'Manuell importierter Clip'
  const summary = body.summary?.trim() || null
  const hashtags = normalizeClipHashtags(body.hashtags)
  const videoFormat = detectVideoFormat(url)
  const videoPlatform = getVideoPlatform(videoFormat)
  const targetArchetypeIds = Array.isArray(body.targetArchetypeIds)
    ? body.targetArchetypeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []
  const loopSeconds =
    typeof body.loopSeconds === 'number' && Number.isFinite(body.loopSeconds)
      ? Math.min(Math.max(Math.round(body.loopSeconds), 8), 300)
      : null

  const { data: existingBySourceUrl, error: existingBySourceError } = await admin
    .from('clip_archive')
    .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, content_type, learning_phase, target_archetype_ids, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
    .eq('source_url', url)
    .maybeSingle()

  if (existingBySourceError) {
    return NextResponse.json({ error: existingBySourceError.message }, { status: 500 })
  }

  const { data: existingByVideoUrl, error: existingByVideoError } = existingBySourceUrl
    ? { data: null, error: null }
    : await admin
        .from('clip_archive')
        .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, content_type, learning_phase, target_archetype_ids, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
        .eq('video_url', url)
        .maybeSingle()

  if (existingByVideoError) {
    return NextResponse.json({ error: existingByVideoError.message }, { status: 500 })
  }

  const existingClip = existingBySourceUrl ?? existingByVideoUrl
  if (existingClip) {
    return NextResponse.json({ clip: existingClip, existing: true })
  }

  const { data, error } = await admin
    .from('clip_archive')
    .insert({
      provider: 'manual_admin',
      source_url: url,
      source_type: 'video',
      title,
      video_url: url,
      video_platform: videoPlatform,
      video_format: videoFormat,
      content_type: normalizeClipContentType(body.contentType),
      learning_phase: normalizeClipLearningPhase(body.learningPhase),
      target_archetype_ids: targetArchetypeIds,
      hashtags,
      summary,
      search_query: null,
      raw_payload: {
        import_source: 'admin_video_upload',
        loop_seconds: loopSeconds,
        submitted_by: user.email ?? user.id,
      },
      assignment_status: 'unassigned',
      last_seen_at: new Date().toISOString(),
    })
    .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, content_type, learning_phase, target_archetype_ids, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ clip: data, existing: false }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const body = (await request.json()) as {
    clipId?: string
    summary?: string | null
    hashtags?: string[] | string | null
    contentType?: string | null
    learningPhase?: string | null
    targetArchetypeIds?: string[] | null
  }

  if (!body.clipId) {
    return NextResponse.json({ error: 'clipId fehlt.' }, { status: 400 })
  }

  const summary = typeof body.summary === 'string' ? body.summary.trim() : null
  const hashtags = normalizeClipHashtags(body.hashtags)
  const targetArchetypeIds = Array.isArray(body.targetArchetypeIds)
    ? body.targetArchetypeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []

  const { data, error } = await admin
    .from('clip_archive')
    .update({
      summary: summary || null,
      hashtags,
      content_type: normalizeClipContentType(body.contentType),
      learning_phase: normalizeClipLearningPhase(body.learningPhase),
      target_archetype_ids: targetArchetypeIds,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', body.clipId)
    .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, content_type, learning_phase, target_archetype_ids, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ clip: data })
}
