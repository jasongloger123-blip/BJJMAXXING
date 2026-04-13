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

async function loadClipsForNodeIds(client: ReturnType<typeof createClient>, nodeIds: string[]): Promise<Groups> {
  const groups = createEmptyGroups()
  if (nodeIds.length === 0) return groups

  const { data: assignments, error: assignmentError } = await client
    .from('clip_assignments')
    .select('id, clip_id, role, display_order, content_type, learning_phase, target_archetype_ids')
    .eq('assignment_kind', 'node')
    .in('node_id', nodeIds)
    .order('display_order', { ascending: true })

  if (assignmentError || !assignments?.length) return groups

  const clipIds = Array.from(new Set(assignments.map((entry) => entry.clip_id)))

  const { data: clips, error: clipError } = await client
    .from('clip_archive')
    .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, content_type, learning_phase, target_archetype_ids, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
    .in('id', clipIds)
    .neq('assignment_status', 'hidden')
    .neq('assignment_status', 'archived')

  if (clipError || !clips?.length) return groups

  const clipMap = new Map(clips.map((clip) => [clip.id, clip as ClipArchiveRecord]))

  for (const assignment of assignments) {
    const role = (assignment.role ?? 'main_reference') as ExternalSourceRole
    const clip = clipMap.get(assignment.clip_id)
    if (!clip) continue
    groups[role].push({
      ...clip,
      assignment_id: assignment.id,
      assignment_role: role,
      content_type: assignment.content_type ?? clip.content_type,
      learning_phase: assignment.learning_phase ?? clip.learning_phase,
      target_archetype_ids:
        Array.isArray(assignment.target_archetype_ids) && assignment.target_archetype_ids.length > 0
          ? assignment.target_archetype_ids
          : clip.target_archetype_ids,
    })
  }

  return groups
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('nodeId')?.trim()
  const aliasNodeIds = searchParams.get('aliasIds')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []

  if (!nodeId) {
    return NextResponse.json({ error: 'nodeId fehlt.' }, { status: 400 })
  }

  const client = createAdminClient() ?? createClient()
  const allNodeIds = [nodeId, ...aliasNodeIds]
  const groups = await loadClipsForNodeIds(client, allNodeIds)

  return NextResponse.json({ nodeId, groups })
}
