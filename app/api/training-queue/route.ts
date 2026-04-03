import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type QueuePayload = {
  nodeId?: string
  clipKey?: string
  clipType?: string
  result?: 'relevant' | 'not_yet' | 'known' | 'later' | 'irrelevant'
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const body = (await request.json()) as QueuePayload

  if (!body.nodeId || !body.clipKey || !body.clipType || !body.result) {
    return NextResponse.json({ error: 'Unvollstaendige Queue-Daten.' }, { status: 400 })
  }

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

  const { data: existingProgress } = await supabase
    .from('progress')
    .select('watched, drilled, attempted, hit_in_sparring, completed, completed_at')
    .eq('user_id', user.id)
    .eq('node_id', body.nodeId)
    .maybeSingle()

  const nodeCompleted = Boolean(existingProgress?.completed) || body.result === 'known'

  const progressPayload = {
    user_id: user.id,
    node_id: body.nodeId,
    watched: true,
    drilled: Boolean(existingProgress?.drilled) || body.result === 'relevant' || body.result === 'not_yet' || body.result === 'known',
    attempted: Boolean(existingProgress?.attempted) || body.result === 'relevant' || body.result === 'known',
    hit_in_sparring: Boolean(existingProgress?.hit_in_sparring) || body.result === 'known',
    completed: nodeCompleted,
    completed_at: nodeCompleted ? existingProgress?.completed_at ?? new Date().toISOString() : null,
  }

  const { error: progressError } = await supabase.from('progress').upsert(progressPayload)

  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nodeCompleted })
}
