import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getNodeById } from '@/lib/nodes'
import { getClipAssignmentRoleLabel, type ClipArchiveRecord, type ClipAssignmentRecord } from '@/lib/clip-archive'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const clipId = params.id?.trim()

  if (!clipId) {
    return NextResponse.json({ error: 'clip id fehlt.' }, { status: 400 })
  }

  const client = createAdminClient() ?? createClient()

  const { data: clip, error: clipError } = await client
    .from('clip_archive')
    .select(
      'id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at'
    )
    .eq('id', clipId)
    .maybeSingle()

  if (clipError) {
    return NextResponse.json({ error: clipError.message }, { status: 500 })
  }

  if (!clip) {
    return NextResponse.json({ error: 'Clip nicht gefunden.' }, { status: 404 })
  }

  const { data: assignments, error: assignmentError } = await client
    .from('clip_assignments')
    .select('id, clip_id, assignment_kind, node_id, from_node_id, to_node_id, role, display_order, notes, created_at')
    .eq('clip_id', clipId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  let run: { id: string; label: string; query: string | null; mode: string } | null = null
  if ((clip as ClipArchiveRecord).source_run_id) {
    const { data: runRow } = await client
      .from('external_technique_search_runs')
      .select('id, label, query, mode')
      .eq('id', (clip as ClipArchiveRecord).source_run_id)
      .maybeSingle()

    run = runRow ?? null
  }

  const enrichedAssignments = ((assignments ?? []) as ClipAssignmentRecord[]).map((assignment) => {
    const node = assignment.node_id ? getNodeById(assignment.node_id) : null
    const fromNode = assignment.from_node_id ? getNodeById(assignment.from_node_id) : null
    const toNode = assignment.to_node_id ? getNodeById(assignment.to_node_id) : null

    return {
      ...assignment,
      roleLabel: getClipAssignmentRoleLabel(assignment.role),
      nodeTitle: node?.title ?? null,
      nodeHref: node ? `/node/${node.id}` : null,
      fromNodeTitle: fromNode?.title ?? null,
      fromNodeHref: fromNode ? `/node/${fromNode.id}` : null,
      toNodeTitle: toNode?.title ?? null,
      toNodeHref: toNode ? `/node/${toNode.id}` : null,
    }
  })

  return NextResponse.json({
    clip: clip as ClipArchiveRecord,
    assignments: enrichedAssignments,
    run,
  })
}
