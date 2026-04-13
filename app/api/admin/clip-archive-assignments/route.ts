import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-access'
import { normalizeClipContentType, normalizeClipLearningPhase } from '@/lib/clip-taxonomy'

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

async function refreshClipStatus(admin: ReturnType<typeof createAdminClient>, clipId: string) {
  if (!admin) return

  const { count } = await admin
    .from('clip_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('clip_id', clipId)

  await admin
    .from('clip_archive')
    .update({ assignment_status: (count ?? 0) > 0 ? 'assigned' : 'unassigned' })
    .eq('id', clipId)
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
  const clipId = searchParams.get('clipId')?.trim()

  if (!clipId) {
    return NextResponse.json({ error: 'clipId fehlt.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('clip_assignments')
    .select('id, clip_id, assignment_kind, node_id, from_node_id, to_node_id, role, display_order, content_type, learning_phase, target_archetype_ids, notes, created_at')
    .eq('clip_id', clipId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ assignments: data ?? [] })
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
    clipId?: string
    externalSourceId?: string
    assignmentKind?: 'node' | 'connection'
    nodeId?: string
    fromNodeId?: string
    toNodeId?: string
    role?: 'main_reference' | 'counter_reference' | 'drill_reference' | 'related_reference'
    displayOrder?: number
    contentType?: string | null
    learningPhase?: string | null
    targetArchetypeIds?: string[] | null
    notes?: string | null
  }

  if ((!body.clipId && !body.externalSourceId) || !body.assignmentKind) {
    return NextResponse.json({ error: 'clipId/externalSourceId oder assignmentKind fehlt.' }, { status: 400 })
  }

  if (body.assignmentKind === 'node' && !body.nodeId) {
    return NextResponse.json({ error: 'nodeId fehlt.' }, { status: 400 })
  }

  if (body.assignmentKind === 'connection' && (!body.fromNodeId || !body.toNodeId)) {
    return NextResponse.json({ error: 'fromNodeId oder toNodeId fehlt.' }, { status: 400 })
  }

  let clipId = body.clipId ?? null
  if (!clipId && body.externalSourceId) {
    const { data: clipRow } = await admin
      .from('clip_archive')
      .select('id')
      .eq('external_source_id', body.externalSourceId)
      .maybeSingle()

    clipId = clipRow?.id ?? null
  }

  if (!clipId) {
    return NextResponse.json({ error: 'Kein passender Archivclip gefunden.' }, { status: 404 })
  }

  const { error } = await admin.from('clip_assignments').upsert(
    {
      clip_id: clipId,
      assignment_kind: body.assignmentKind,
      node_id: body.assignmentKind === 'node' ? body.nodeId ?? null : null,
      from_node_id: body.assignmentKind === 'connection' ? body.fromNodeId ?? null : null,
      to_node_id: body.assignmentKind === 'connection' ? body.toNodeId ?? null : null,
      role: body.assignmentKind === 'node' ? body.role ?? 'main_reference' : null,
      display_order: body.displayOrder ?? 0,
      content_type: body.assignmentKind === 'node' ? normalizeClipContentType(body.contentType) : null,
      learning_phase: body.assignmentKind === 'node' ? normalizeClipLearningPhase(body.learningPhase) : null,
      target_archetype_ids: Array.isArray(body.targetArchetypeIds)
        ? body.targetArchetypeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [],
      notes: body.notes?.trim() || null,
    },
    {
      onConflict: body.assignmentKind === 'node' ? 'clip_id,node_id,role' : 'clip_id,from_node_id,to_node_id',
      ignoreDuplicates: false,
    }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.assignmentKind === 'node') {
    await admin
      .from('clip_archive')
      .update({
        content_type: normalizeClipContentType(body.contentType),
        learning_phase: normalizeClipLearningPhase(body.learningPhase),
        target_archetype_ids: Array.isArray(body.targetArchetypeIds)
          ? body.targetArchetypeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
          : [],
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', clipId)
  }

  await refreshClipStatus(admin, clipId)
  
  // Fetch the created assignment to return its ID
  const { data: assignmentData } = await admin
    .from('clip_assignments')
    .select('id, role')
    .eq('clip_id', clipId)
    .eq('assignment_kind', body.assignmentKind)
    .eq('node_id', body.assignmentKind === 'node' ? body.nodeId : null)
    .single()
  
  return NextResponse.json({ ok: true, assignmentId: assignmentData?.id, role: assignmentData?.role })
}

export async function PATCH(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const body = (await request.json()) as {
    assignmentId?: string
    clipId?: string
    role?: 'main_reference' | 'counter_reference' | 'drill_reference' | 'related_reference'
    contentType?: string | null
    learningPhase?: string | null
    targetArchetypeIds?: string[] | null
    notes?: string | null
  }

  if (!body.assignmentId || !body.clipId || !body.role) {
    return NextResponse.json({ error: 'assignmentId, clipId oder role fehlt.' }, { status: 400 })
  }

  const targetArchetypeIds = Array.isArray(body.targetArchetypeIds)
    ? body.targetArchetypeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []
  const contentType = normalizeClipContentType(body.contentType)
  const learningPhase = normalizeClipLearningPhase(body.learningPhase)

  const { error } = await admin
    .from('clip_assignments')
    .update({
      role: body.role,
      content_type: contentType,
      learning_phase: learningPhase,
      target_archetype_ids: targetArchetypeIds,
      ...(typeof body.notes === 'string' ? { notes: body.notes.trim() || null } : {}),
    })
    .eq('id', body.assignmentId)
    .eq('clip_id', body.clipId)
    .eq('assignment_kind', 'node')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin
    .from('clip_archive')
    .update({
      content_type: contentType,
      learning_phase: learningPhase,
      target_archetype_ids: targetArchetypeIds,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', body.clipId)

  await refreshClipStatus(admin, body.clipId)
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

  const body = (await request.json()) as { assignmentId?: string; clipId?: string }

  if (!body.assignmentId || !body.clipId) {
    return NextResponse.json({ error: 'assignmentId oder clipId fehlt.' }, { status: 400 })
  }

  const { error } = await admin.from('clip_assignments').delete().eq('id', body.assignmentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await refreshClipStatus(admin, body.clipId)
  return NextResponse.json({ ok: true })
}
