import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { type ClipArchiveRecord } from '@/lib/clip-archive'
import { type ExternalSourceRole } from '@/lib/external-technique-sources'

type Groups = Record<ExternalSourceRole, ClipArchiveRecord[]>

function createEmptyGroups(): Groups {
  return {
    main_reference: [],
    counter_reference: [],
    drill_reference: [],
    related_reference: [],
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('nodeId')?.trim()

  if (!nodeId) {
    return NextResponse.json({ error: 'nodeId fehlt.' }, { status: 400 })
  }

  const client = createAdminClient() ?? createClient()
  const groups = createEmptyGroups()

  const { data: assignments, error: assignmentError } = await client
    .from('clip_assignments')
    .select('clip_id, role, display_order')
    .eq('assignment_kind', 'node')
    .eq('node_id', nodeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  const clipIds = Array.from(new Set((assignments ?? []).map((entry) => entry.clip_id)))
  if (clipIds.length === 0) {
    return NextResponse.json({ nodeId, groups })
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

  const clipMap = new Map((clips ?? []).map((clip) => [clip.id, clip as ClipArchiveRecord]))

  for (const assignment of assignments ?? []) {
    const role = (assignment.role ?? 'main_reference') as ExternalSourceRole
    const clip = clipMap.get(assignment.clip_id)
    if (!clip) continue
    groups[role].push(clip)
  }

  return NextResponse.json({ nodeId, groups })
}
