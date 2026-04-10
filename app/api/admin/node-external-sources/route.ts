import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-access'
import {
  EXTERNAL_SOURCE_ROLES,
  type ExternalTechniqueSearchRunSectionWithSources,
  type ExternalTechniqueSourceRecord,
} from '@/lib/external-technique-sources'

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
  const query = searchParams.get('query')?.trim()
  const runId = searchParams.get('runId')?.trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 25), 1), 100)

  const response = runId
    ? await admin
        .from('external_technique_search_run_sources')
        .select(
          'id, external_source_id, external_technique_sources!inner(id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, imported_at, last_seen_at)'
        )
        .eq('run_id', runId)
        .limit(limit)
    : await admin
        .from('external_technique_sources')
        .select('id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, imported_at, last_seen_at')
        .order('imported_at', { ascending: false })
        .limit(limit)

  const { data, error } = response

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const flattenedSources: ExternalTechniqueSourceRecord[] = runId
    ? (data ?? [])
        .map(
          (entry) =>
            (entry as unknown as { external_technique_sources: ExternalTechniqueSourceRecord | null }).external_technique_sources
        )
        .filter((entry): entry is ExternalTechniqueSourceRecord => Boolean(entry))
    : ((data ?? []) as ExternalTechniqueSourceRecord[])

  const filteredSources = query
    ? flattenedSources.filter((entry) =>
        [entry.title, entry.summary, entry.search_query]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : flattenedSources

  let sections: ExternalTechniqueSearchRunSectionWithSources[] = []

  if (runId) {
    const { data: sectionData, error: sectionError } = await admin
      .from('external_technique_search_run_sections')
      .select(
        'id, run_id, section_key, section_title, section_order, section_summary, created_at, external_technique_search_run_section_sources(external_source_id, source_order, evidence_text, external_technique_sources(id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, imported_at, last_seen_at))'
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

    sections = (sectionData ?? []).map((section) => {
      const sourceEntries = (
        (section as unknown as {
          external_technique_search_run_section_sources?: Array<{
            source_order?: number
            evidence_text?: string | null
            external_technique_sources?: ExternalTechniqueSourceRecord | null
          }>
        }).external_technique_search_run_section_sources ?? []
      )
        .map((entry) => ({
          source: entry.external_technique_sources,
          order: entry.source_order ?? 0,
        }))
        .filter((entry): entry is { source: ExternalTechniqueSourceRecord; order: number } => Boolean(entry.source))
        .sort((a, b) => a.order - b.order)
        .map((entry) => entry.source)
        .filter((entry) =>
          query
            ? [entry.title, entry.summary, entry.search_query]
                .join(' ')
                .toLowerCase()
                .includes(query.toLowerCase())
            : true
        )

      return {
        id: (section as { id: string }).id,
        runId: (section as { run_id: string }).run_id,
        sectionKey: (section as { section_key: string }).section_key,
        sectionTitle: (section as { section_title: string }).section_title,
        sectionOrder: (section as { section_order: number }).section_order,
        sectionSummary: (section as { section_summary: string | null }).section_summary,
        createdAt: (section as { created_at: string }).created_at,
        sources: sourceEntries,
      }
    }).filter((section) => section.sources.length > 0 || section.sectionSummary)
  }

  return NextResponse.json({ sources: filteredSources, sections })
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
    nodeId?: string
    externalSourceId?: string
    role?: string
    notes?: string
  }

  if (!body.nodeId || !body.externalSourceId || !body.role) {
    return NextResponse.json({ error: 'nodeId, externalSourceId oder role fehlt.' }, { status: 400 })
  }

  if (!EXTERNAL_SOURCE_ROLES.includes(body.role as (typeof EXTERNAL_SOURCE_ROLES)[number])) {
    return NextResponse.json({ error: 'Ungueltige Role.' }, { status: 400 })
  }

  const { error } = await admin.from('node_external_sources').upsert(
    {
      node_id: body.nodeId,
      external_source_id: body.externalSourceId,
      role: body.role,
      notes: body.notes?.trim() || null,
    },
    {
      onConflict: 'node_id,external_source_id,role',
      ignoreDuplicates: false,
    }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const body = (await request.json()) as {
    nodeId?: string
    externalSourceId?: string
    role?: string
  }

  if (!body.nodeId || !body.externalSourceId || !body.role) {
    return NextResponse.json({ error: 'nodeId, externalSourceId oder role fehlt.' }, { status: 400 })
  }

  const { error } = await admin
    .from('node_external_sources')
    .delete()
    .eq('node_id', body.nodeId)
    .eq('external_source_id', body.externalSourceId)
    .eq('role', body.role)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
