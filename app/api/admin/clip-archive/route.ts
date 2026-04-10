import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-access'

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

  let builder = admin
    .from('clip_archive')
    .select('id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, style_coverage, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(limit)

  if (runId) builder = builder.eq('source_run_id', runId)
  if (status) builder = builder.eq('assignment_status', status)

  const { data, error } = await builder

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const clips = (data ?? []).filter((clip) =>
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
