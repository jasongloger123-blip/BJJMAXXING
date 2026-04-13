import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-access'
import { importOutlierAiChat, importOutlierTagSearch } from '@/lib/outlierdb'
import { normalizeTechniqueStyleCoverage } from '@/lib/technique-style'

type ClipArchiveRow = {
  id: string
  external_source_id: string | null
  source_url: string | null
  video_url: string | null
  timestamp_seconds: number | null
  summary: string | null
  hashtags: string[] | null
}

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

async function findExistingOutlierClip(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  sourceUrl: string,
  videoUrl: string | null,
  timestampSeconds: number | null
) {
  const applyTimestampFilter = (query: any) => {
    if (timestampSeconds === null || timestampSeconds === undefined) {
      return query.is('timestamp_seconds', null)
    }

    return query.eq('timestamp_seconds', timestampSeconds)
  }

  const sourceQuery = applyTimestampFilter(
    admin
      .from('clip_archive')
      .select('id, external_source_id, source_url, video_url, timestamp_seconds, summary, hashtags')
      .eq('provider', 'outlierdb')
      .eq('source_url', sourceUrl)
  ).limit(1)

  const { data: sourceMatches, error: sourceError } = await sourceQuery
  if (sourceError) {
    throw new Error(sourceError.message)
  }

  const sourceMatch = (sourceMatches?.[0] ?? null) as ClipArchiveRow | null
  if (sourceMatch || !videoUrl) {
    return sourceMatch
  }

  const videoQuery = applyTimestampFilter(
    admin
      .from('clip_archive')
      .select('id, external_source_id, source_url, video_url, timestamp_seconds, summary, hashtags')
      .eq('provider', 'outlierdb')
      .eq('video_url', videoUrl)
  ).limit(1)

  const { data: videoMatches, error: videoError } = await videoQuery
  if (videoError) {
    throw new Error(videoError.message)
  }

  return (videoMatches?.[0] ?? null) as ClipArchiveRow | null
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await resolveAdmin(request)

    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
    }

    if (!admin) {
      return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
    }

    const body = (await request.json()) as {
      mode?: 'tag_search' | 'ai_chat'
      label?: string
      query?: string
      authToken?: string
      hashtags?: string[]
      limit?: number
      page?: number
      styleCoverage?: 'gi' | 'nogi' | 'both'
    }

    const mode = body.mode === 'ai_chat' ? 'ai_chat' : 'tag_search'
    const label = body.label?.trim() || body.query?.trim() || (mode === 'ai_chat' ? 'AI Search' : 'Tag Search')
    const query = body.query?.trim()
    const authToken = body.authToken?.trim()
    const styleCoverage = normalizeTechniqueStyleCoverage(body.styleCoverage)

    if (!query) {
      return NextResponse.json({ error: 'Suchbegriff fehlt.' }, { status: 400 })
    }

    if (!authToken) {
      return NextResponse.json({ error: 'OutlierDB Token fehlt.' }, { status: 400 })
    }

    const result =
      mode === 'ai_chat'
        ? await importOutlierAiChat({
            query,
            authToken,
          })
        : await importOutlierTagSearch({
            query,
            authToken,
            hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
            limit: Math.min(Math.max(body.limit ?? 10, 1), 25),
            page: Math.max(body.page ?? 1, 1),
          })

    const { data: runRow, error: runError } = await admin
      .from('external_technique_search_runs')
      .insert({
        provider: 'outlierdb',
        mode,
        label,
        query,
        hashtags: result.hashtags,
        page: result.page,
        limit_count: result.limit,
        imported_count: result.imported.length,
        failed_count: result.failed.length,
        has_more: result.hasMore,
        request_payload: result.requestPayload,
        response_payload: result.responsePayload,
      })
      .select('id')
      .single()

    if (runError || !runRow) {
      return NextResponse.json(
        {
          error: runError?.message ?? 'Search-Run konnte nicht gespeichert werden.',
          hint: 'Pruefe, ob die Migration 20260404_outlierdb_search_runs.sql in Supabase ausgefuehrt wurde.',
        },
        { status: 500 }
      )
    }

    const now = new Date().toISOString()

    if (result.imported.length > 0) {
      const { data: upsertedRows, error } = await admin
        .from('external_technique_sources')
        .upsert(
          result.imported.map((entry) => ({
            ...entry,
            imported_at: now,
            last_seen_at: now,
            style_coverage: styleCoverage,
          })),
          {
            onConflict: 'source_url',
            ignoreDuplicates: false,
          }
        )
        .select('id, source_url')

      if (error) {
        return NextResponse.json({ error: error.message, result }, { status: 500 })
      }

      if ((upsertedRows ?? []).length > 0) {
        const importedBySourceUrl = new Map(result.imported.map((entry) => [entry.source_url, entry]))

        for (const row of upsertedRows) {
          const importedEntry = importedBySourceUrl.get(row.source_url)
          const clipRow = {
            external_source_id: row.id,
            source_run_id: runRow.id,
            provider: importedEntry?.provider ?? 'outlierdb',
            source_url: importedEntry?.source_url ?? row.source_url,
            source_type: importedEntry?.source_type ?? 'sequence',
            title: importedEntry?.title ?? row.source_url,
            video_url: importedEntry?.video_url ?? null,
            video_platform: importedEntry?.video_platform ?? null,
            video_format: importedEntry?.video_format ?? null,
            style_coverage: styleCoverage,
            content_type: 'technical_demo',
            learning_phase: 'core_mechanic',
            target_archetype_ids: [],
            timestamp_label: importedEntry?.timestamp_label ?? null,
            timestamp_seconds: importedEntry?.timestamp_seconds ?? null,
            hashtags: importedEntry?.hashtags ?? [],
            summary: importedEntry?.summary ?? null,
            search_query: importedEntry?.search_query ?? query,
            raw_payload: importedEntry?.raw_payload ?? {},
            last_seen_at: now,
          }

          try {
            const existingClip = await findExistingOutlierClip(
              admin,
              clipRow.source_url,
              clipRow.video_url,
              clipRow.timestamp_seconds
            )

            if (existingClip) {
              const existingClipUpdate = {
                external_source_id: clipRow.external_source_id,
                source_run_id: clipRow.source_run_id,
                provider: clipRow.provider,
                source_url: clipRow.source_url,
                source_type: clipRow.source_type,
                title: clipRow.title,
                video_url: clipRow.video_url,
                video_platform: clipRow.video_platform,
                video_format: clipRow.video_format,
                style_coverage: clipRow.style_coverage,
                timestamp_label: clipRow.timestamp_label,
                timestamp_seconds: clipRow.timestamp_seconds,
                search_query: clipRow.search_query,
                raw_payload: clipRow.raw_payload,
                last_seen_at: clipRow.last_seen_at,
              }
              const { error: updateError } = await admin
                .from('clip_archive')
                .update({
                  ...existingClipUpdate,
                  summary: existingClip.summary?.trim() ? existingClip.summary : clipRow.summary,
                  hashtags: (existingClip.hashtags?.length ?? 0) > 0 ? existingClip.hashtags : clipRow.hashtags,
                })
                .eq('id', existingClip.id)

              if (updateError) {
                return NextResponse.json(
                  {
                    error: updateError.message,
                    hint: 'Pruefe, ob die Migration 20260404_clip_archive.sql in Supabase ausgefuehrt wurde.',
                  },
                  { status: 500 }
                )
              }

              continue
            }

            const { error: clipArchiveError } = await admin.from('clip_archive').upsert(clipRow, {
              onConflict: 'external_source_id',
              ignoreDuplicates: false,
            })

            if (clipArchiveError) {
              return NextResponse.json(
                {
                  error: clipArchiveError.message,
                  hint: 'Pruefe, ob die Migration 20260404_clip_archive.sql in Supabase ausgefuehrt wurde.',
                },
                { status: 500 }
              )
            }
          } catch (dedupeError) {
            return NextResponse.json(
              {
                error: dedupeError instanceof Error ? dedupeError.message : 'Clip-Dedupe fehlgeschlagen.',
                hint: 'OutlierDB Import prueft Clips jetzt vor dem Anlegen nach URL und Timestamp.',
              },
              { status: 500 }
            )
          }
        }

        const { error: linkError } = await admin.from('external_technique_search_run_sources').upsert(
          upsertedRows.map((row) => ({
            run_id: runRow.id,
            external_source_id: row.id,
          })),
          {
            onConflict: 'run_id,external_source_id',
            ignoreDuplicates: false,
          }
        )

        if (linkError) {
          return NextResponse.json(
            {
              error: linkError.message,
              result,
              hint: 'Pruefe, ob die Migration 20260404_outlierdb_search_runs.sql in Supabase ausgefuehrt wurde.',
            },
            { status: 500 }
          )
        }
      }

      if (mode === 'ai_chat' && result.sections.length > 0) {
        const sectionRows = result.sections.map((section) => ({
          run_id: runRow.id,
          section_key: section.sectionKey,
          section_title: section.sectionTitle,
          section_order: section.sectionOrder,
          section_summary: section.sectionSummary,
        }))

        const { data: insertedSections, error: sectionError } = await admin
          .from('external_technique_search_run_sections')
          .upsert(sectionRows, {
            onConflict: 'run_id,section_key',
            ignoreDuplicates: false,
          })
          .select('id, section_key')

        if (sectionError) {
          return NextResponse.json(
            {
              error: sectionError.message,
              hint: 'Pruefe, ob die Migration 20260404_outlierdb_search_run_sections.sql in Supabase ausgefuehrt wurde.',
            },
            { status: 500 }
          )
        }

        const sourceIdByUrl = new Map((upsertedRows ?? []).map((row) => [row.source_url, row.id]))
        const sectionIdByKey = new Map((insertedSections ?? []).map((section) => [section.section_key, section.id]))
        const sectionSourceRows = result.sections.flatMap((section) =>
          section.sourceUrls
            .map((sourceUrl) => {
              const runSectionId = sectionIdByKey.get(section.sectionKey)
              const externalSourceId = sourceIdByUrl.get(sourceUrl)

              if (!runSectionId || !externalSourceId) {
                return null
              }

              return {
                run_section_id: runSectionId,
                external_source_id: externalSourceId,
                source_order: section.sourceOrderByUrl[sourceUrl] ?? 0,
                evidence_text: section.evidenceTextByUrl[sourceUrl] ?? null,
              }
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        )

        if (sectionSourceRows.length > 0) {
          const { error: sectionSourceError } = await admin
            .from('external_technique_search_run_section_sources')
            .upsert(sectionSourceRows, {
              onConflict: 'run_section_id,external_source_id',
              ignoreDuplicates: false,
            })

          if (sectionSourceError) {
            return NextResponse.json(
              {
                error: sectionSourceError.message,
                hint: 'Pruefe, ob die Migration 20260404_outlierdb_search_run_sections.sql in Supabase ausgefuehrt wurde.',
              },
              { status: 500 }
            )
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      runId: runRow.id,
      mode,
      label,
      query,
      hashtags: result.hashtags,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      groupCount: result.groupCount,
      importedCount: result.imported.length,
      sections: result.sections,
      failed: result.failed,
      imported: result.imported,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unbekannter Import-Fehler.',
      },
      { status: 500 }
    )
  }
}
