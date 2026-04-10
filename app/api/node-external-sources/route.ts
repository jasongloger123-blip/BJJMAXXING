import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  type ExternalSourceRole,
  type ExternalTechniqueSourceRecord,
  type NodeExternalSourceRecord,
  type NodeExternalSourceWithSource,
} from '@/lib/external-technique-sources'

type SourcesByRole = Record<ExternalSourceRole, NodeExternalSourceWithSource[]>

function createEmptyGroups(): SourcesByRole {
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

  const { data: mappings, error: mappingError } = await client
    .from('node_external_sources')
    .select('id, node_id, external_source_id, role, notes, created_at')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: true })

  if (mappingError) {
    return NextResponse.json({ error: mappingError.message }, { status: 500 })
  }

  const typedMappings = (mappings ?? []) as NodeExternalSourceRecord[]
  const sourceIds = Array.from(new Set(typedMappings.map((entry) => entry.external_source_id)))

  if (sourceIds.length === 0) {
    return NextResponse.json({ nodeId, groups })
  }

  const { data: sources, error: sourceError } = await client
    .from('external_technique_sources')
    .select('id, provider, source_url, source_type, title, video_url, video_platform, video_format, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, imported_at, last_seen_at')
    .in('id', sourceIds)

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 })
  }

  const sourceMap = new Map((sources ?? []).map((entry) => [entry.id, entry as ExternalTechniqueSourceRecord]))

  for (const mapping of typedMappings) {
    const source = sourceMap.get(mapping.external_source_id)

    if (!source) continue

    groups[mapping.role].push({
      mappingId: mapping.id,
      nodeId: mapping.node_id,
      role: mapping.role,
      notes: mapping.notes,
      createdAt: mapping.created_at,
      source,
    })
  }

  return NextResponse.json({ nodeId, groups })
}
