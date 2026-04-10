import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { type ClipArchiveRecord } from '@/lib/clip-archive'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fromNodeId = searchParams.get('fromNodeId')?.trim()
  const toNodeId = searchParams.get('toNodeId')?.trim()

  if (!fromNodeId || !toNodeId) {
    return NextResponse.json({ error: 'fromNodeId oder toNodeId fehlt.' }, { status: 400 })
  }

  const client = createAdminClient() ?? createClient()
  const { data: assignments, error: assignmentError } = await client
    .from('clip_assignments')
    .select('clip_id')
    .eq('assignment_kind', 'connection')
    .eq('from_node_id', fromNodeId)
    .eq('to_node_id', toNodeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  const clipIds = Array.from(new Set((assignments ?? []).map((entry) => entry.clip_id)))
  if (clipIds.length === 0) {
    return NextResponse.json({ clips: [] })
  }

  const { data: clips, error: clipError } = await client
    .from('clip_archive')
    .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
    .in('id', clipIds)
    .neq('assignment_status', 'hidden')
    .neq('assignment_status', 'archived')

  if (clipError) {
    return NextResponse.json({ error: clipError.message }, { status: 500 })
  }

  return NextResponse.json({ clips: (clips ?? []) as ClipArchiveRecord[] })
}
