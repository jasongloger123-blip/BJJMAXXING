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
  
  // Pagination
  const page = Math.max(Number(searchParams.get('page') ?? 1), 1)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 200)
  const offset = (page - 1) * limit
  
  // Sortierung
  const sortBy = searchParams.get('sortBy') ?? 'created_at'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  
  // Filter
  const searchQuery = searchParams.get('query')?.trim()?.toLowerCase()
  const statusFilter = searchParams.get('status')?.trim()
  const contentTypeFilter = searchParams.get('contentType')?.trim()
  const learningPhaseFilter = searchParams.get('learningPhase')?.trim()
  const styleCoverageFilter = searchParams.get('styleCoverage')?.trim()
  const techniqueIdFilter = searchParams.get('techniqueId')?.trim()
  const archetypeIdFilter = searchParams.get('archetypeId')?.trim()
  const providerFilter = searchParams.get('provider')?.trim()
  
  // Datumsfilter
  const dateFrom = searchParams.get('dateFrom')?.trim()
  const dateTo = searchParams.get('dateTo')?.trim()

  try {
    // Basis-Query für Clips mit Assignments und Node-Infos
    let builder = admin
      .from('clip_archive')
      .select(
        `
        id,
        external_source_id,
        source_run_id,
        provider,
        source_url,
        source_type,
        title,
        video_url,
        video_platform,
        video_format,
        style_coverage,
        content_type,
        learning_phase,
        target_archetype_ids,
        timestamp_label,
        timestamp_seconds,
        hashtags,
        summary,
        search_query,
        assignment_status,
        created_at,
        last_seen_at,
        clip_assignments:clip_assignments!left(
          id,
          node_id,
          role,
          content_type,
          learning_phase,
          target_archetype_ids
        )
      `,
        { count: 'exact' }
      )

    // Status-Filter auf clip_archive
    if (statusFilter) {
      builder = builder.eq('assignment_status', statusFilter)
    }

    // Content-Type Filter
    if (contentTypeFilter) {
      builder = builder.eq('content_type', contentTypeFilter)
    }

    // Learning Phase Filter
    if (learningPhaseFilter) {
      builder = builder.eq('learning_phase', learningPhaseFilter)
    }

    // Style Coverage Filter
    if (styleCoverageFilter) {
      builder = builder.eq('style_coverage', styleCoverageFilter)
    }

    // Provider Filter
    if (providerFilter) {
      builder = builder.eq('provider', providerFilter)
    }

    // Datumsfilter
    if (dateFrom) {
      builder = builder.gte('created_at', dateFrom)
    }
    if (dateTo) {
      builder = builder.lte('created_at', dateTo + 'T23:59:59.999Z')
    }

    // Archetype Filter (array contains)
    if (archetypeIdFilter) {
      builder = builder.contains('target_archetype_ids', [archetypeIdFilter])
    }

    // Suche in Titel, Summary, Hashtags
    if (searchQuery) {
      builder = builder.or(`title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`)
    }

    // Sortierung anwenden
    const validSortColumns = ['created_at', 'last_seen_at', 'title', 'assignment_status']
    const orderColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    builder = builder.order(orderColumn, { ascending: sortOrder === 'asc' })

    // Pagination
    builder = builder.range(offset, offset + limit - 1)

    const { data: clips, error, count } = await builder

    if (error) {
      console.error('Error fetching clips:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Wenn Technik-Filter aktiv ist, filtern wir in der Applikationsschicht
    let filteredClips = clips ?? []
    if (techniqueIdFilter) {
      filteredClips = filteredClips.filter((clip: { clip_assignments?: Array<{ node_id?: string }> }) =>
        clip.clip_assignments?.some((a) => a.node_id === techniqueIdFilter)
      )
    }

    // Technik-Namen laden für die Zuordnungen
    const nodeIds = new Set<string>()
    filteredClips.forEach((clip: { clip_assignments?: Array<{ node_id?: string }> }) => {
      clip.clip_assignments?.forEach((assignment: { node_id?: string }) => {
        if (assignment.node_id) nodeIds.add(assignment.node_id)
      })
    })

    let allTechniqueNames: Record<string, string> = {}

    // Lade ALLE verfügbaren Techniken (nicht nur die zugewiesenen)
    // Erst die DB-Techniken
    const { data: dbTechniques } = await admin
      .from('techniques')
      .select('id, title')

    if (dbTechniques) {
      dbTechniques.forEach((t: { id: string; title: string }) => {
        allTechniqueNames[t.id] = t.title
      })
    }

    // Dann Custom-Techniken
    const { data: customTechniques } = await admin
      .from('custom_techniques')
      .select('id, title')

    if (customTechniques) {
      customTechniques.forEach((t: { id: string; title: string }) => {
        allTechniqueNames[t.id] = t.title
      })
    }

    // Statistiken laden
    const { data: stats } = await admin
      .from('clip_archive')
      .select('assignment_status', { count: 'exact' })

    const statusCounts = {
      total: stats?.length ?? 0,
      unassigned: stats?.filter((s: { assignment_status: string }) => s.assignment_status === 'unassigned').length ?? 0,
      assigned: stats?.filter((s: { assignment_status: string }) => s.assignment_status === 'assigned').length ?? 0,
      hidden: stats?.filter((s: { assignment_status: string }) => s.assignment_status === 'hidden').length ?? 0,
      archived: stats?.filter((s: { assignment_status: string }) => s.assignment_status === 'archived').length ?? 0,
    }

    // Verfügbare Provider für Filter
    const { data: providers } = await admin
      .from('clip_archive')
      .select('provider')
      .order('provider')

    const uniqueProviders = Array.from(new Set((providers ?? []).map((p: { provider: string }) => p.provider)))

    return NextResponse.json({
      clips: filteredClips,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
      stats: statusCounts,
      techniqueNames: allTechniqueNames,
      providers: uniqueProviders,
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const body = await request.json()
  const { clipId, updates, bulkAction } = body

  if (bulkAction === 'deactivate_all') {
    const { error } = await admin
      .from('clip_archive')
      .update({ assignment_status: 'hidden', last_seen_at: new Date().toISOString() })
      .neq('assignment_status', 'archived')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (bulkAction === 'activate_all') {
    const { data: hiddenClips, error: hiddenError } = await admin
      .from('clip_archive')
      .select('id')
      .eq('assignment_status', 'hidden')

    if (hiddenError) {
      return NextResponse.json({ error: hiddenError.message }, { status: 500 })
    }

    const hiddenClipIds = (hiddenClips ?? []).map((clip: { id: string }) => clip.id)
    if (hiddenClipIds.length === 0) {
      return NextResponse.json({ ok: true })
    }

    const { data: assignments, error: assignmentError } = await admin
      .from('clip_assignments')
      .select('clip_id')
      .in('clip_id', hiddenClipIds)

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 })
    }

    const assignedClipIds = new Set((assignments ?? []).map((assignment: { clip_id: string }) => assignment.clip_id))
    const now = new Date().toISOString()
    const assignedIds = hiddenClipIds.filter((id) => assignedClipIds.has(id))
    const unassignedIds = hiddenClipIds.filter((id) => !assignedClipIds.has(id))

    if (assignedIds.length > 0) {
      const { error } = await admin
        .from('clip_archive')
        .update({ assignment_status: 'assigned', last_seen_at: now })
        .in('id', assignedIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (unassignedIds.length > 0) {
      const { error } = await admin
        .from('clip_archive')
        .update({ assignment_status: 'unassigned', last_seen_at: now })
        .in('id', unassignedIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (!clipId || !updates) {
    return NextResponse.json({ error: 'clipId und updates sind erforderlich.' }, { status: 400 })
  }

  try {
    const { data, error } = await admin
      .from('clip_archive')
      .update({
        ...updates,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', clipId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ clip: data })
  } catch (err) {
    console.error('Error updating clip:', err)
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Clips' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const body = await request.json()
  const { clipId } = body

  if (!clipId) {
    return NextResponse.json({ error: 'clipId ist erforderlich.' }, { status: 400 })
  }

  try {
    // Zuerst alle zugehörigen Assignments löschen
    const { error: assignmentError } = await admin
      .from('clip_assignments')
      .delete()
      .eq('clip_id', clipId)

    if (assignmentError) {
      console.error('Error deleting assignments:', assignmentError)
      // Wir fahren trotzdem fort, da der Clip evtl. keine Assignments hat
    }

    // Dann den Clip selbst löschen
    const { error: clipError } = await admin
      .from('clip_archive')
      .delete()
      .eq('id', clipId)

    if (clipError) {
      return NextResponse.json({ error: clipError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting clip:', err)
    return NextResponse.json({ error: 'Fehler beim Löschen des Clips' }, { status: 500 })
  }
}
