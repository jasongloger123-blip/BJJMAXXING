import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-access'
import { ARCHETYPES } from '@/lib/archetypes'
import { createEmptyAdminPlan, toAdminPlan } from '@/lib/gameplans'

const PLAN_SELECT_FULL = `
  id,
  slug,
  title,
  headline,
  hero_image_url,
  status,
  creator_name,
  creator_role,
  creator_initials,
  creator_profile_href,
  canvas_width,
  canvas_height,
  main_path_node_ids,
  is_fallback_default,
  updated_at,
  gameplan_nodes(*),
  gameplan_edges(*),
  gameplan_assignments(*)
`

const PLAN_SELECT_LEGACY = `
  id,
  slug,
  title,
  headline,
  hero_image_url,
  status,
  creator_name,
  creator_role,
  creator_initials,
  creator_profile_href,
  canvas_width,
  canvas_height,
  main_path_node_ids,
  is_fallback_default,
  updated_at,
  gameplan_nodes(
    id,
    plan_id,
    title,
    stage,
    label,
    description,
    outcome,
    focus_items,
    mistake_items,
    node_state,
    expansion_paths,
    source_node_id,
    canvas_x,
    canvas_y,
    tier,
    lane,
    node_size,
    order_index
  ),
  gameplan_edges(*),
  gameplan_assignments(*)
`

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

async function fetchPlans(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  let { data, error } = await admin.from('gameplans').select(PLAN_SELECT_FULL).order('updated_at', { ascending: false })

  if (error?.message?.includes("'requires_validation'") || error?.message?.includes("'unlock_parent_node_id'") || error?.message?.includes("'unlock_phase'") || error?.message?.includes("'unlock_order'") || error?.message?.includes("'hero_image_url'")) {
    const legacyResponse = await admin.from('gameplans').select(PLAN_SELECT_LEGACY).order('updated_at', { ascending: false })
    data = legacyResponse.data
    error = legacyResponse.error
  }

  if (error) throw new Error(error.message)
  return (data ?? []).map((plan) => toAdminPlan(plan))
}

async function fetchProfiles(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data, error } = await admin
    .from('user_profiles')
    .select('id, username, full_name, primary_archetype')
    .order('full_name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((profile) => ({
    id: profile.id,
    label: profile.username ?? profile.full_name ?? profile.id.slice(0, 8),
    archetypeId: profile.primary_archetype ?? null,
  }))
}

async function fetchCurrentAdminProfile(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
) {
  const { data, error } = await admin
    .from('user_profiles')
    .select('id, username, full_name, primary_archetype')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    id: data.id,
    label: data.username ?? data.full_name ?? data.id.slice(0, 8),
    archetypeId: data.primary_archetype ?? null,
  }
}

async function syncArchetypes(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const archetypeRows = ARCHETYPES.map((archetype) => ({
    id: archetype.id,
    name: archetype.name,
    tagline: archetype.tagline,
    description: archetype.description,
    strengths: archetype.strengths,
    weaknesses: archetype.weaknesses,
    primary_systems: archetype.primarySystems,
    top_style: archetype.topStyle,
    win_path: archetype.winPath,
  }))

  const { error } = await admin.from('archetypes').upsert(archetypeRows, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

async function savePlan(admin: NonNullable<ReturnType<typeof createAdminClient>>, plan: any) {
  await syncArchetypes(admin)
  const cleanedMainPath = (Array.isArray(plan.mainPathNodeIds) ? plan.mainPathNodeIds : []).filter((id: string) =>
    (plan.nodes ?? []).some((node: any) => node.id === id)
  )

  if (plan.isFallbackDefault) {
    await admin.from('gameplans').update({ is_fallback_default: false }).neq('id', plan.id)
  }

  const upsertPlan = {
    id: plan.id,
    slug: slugify(plan.slug || plan.title || `gameplan-${Date.now()}`),
    title: plan.title || 'Untitled Plan',
    headline: plan.headline || plan.title || 'Untitled Gameplan',
    hero_image_url: plan.heroImageUrl || null,
    status: plan.status === 'published' ? 'published' : 'draft',
    creator_name: plan.creatorName || 'BJJMAXXING',
    creator_role: plan.creatorRole || 'Custom Plan',
    creator_initials: plan.creatorInitials || 'BM',
    creator_profile_href: plan.creatorProfileHref || '/profile',
    canvas_width: Number(plan.canvasWidth) || 1600,
    canvas_height: Number(plan.canvasHeight) || 900,
    main_path_node_ids: cleanedMainPath,
    is_fallback_default: Boolean(plan.isFallbackDefault),
    updated_at: new Date().toISOString(),
  }

  let { error: planError } = await admin.from('gameplans').upsert(upsertPlan)
  if (planError?.message?.includes("'hero_image_url'")) {
    const { hero_image_url, ...legacyUpsertPlan } = upsertPlan
    void hero_image_url
    const legacyUpsert = await admin.from('gameplans').upsert(legacyUpsertPlan)
    planError = legacyUpsert.error
  }
  if (planError) throw new Error(planError.message)

  await admin.from('gameplan_edges').delete().eq('plan_id', plan.id)
  await admin.from('gameplan_assignments').delete().eq('plan_id', plan.id)
  await admin.from('gameplan_nodes').delete().eq('plan_id', plan.id)

  if (Array.isArray(plan.nodes) && plan.nodes.length > 0) {
    const nodeRows = plan.nodes.map((node: any, index: number) => ({
      id: node.id,
      plan_id: plan.id,
      title: node.title || 'Untitled Node',
      stage: node.stage || 'position',
      label: node.label || '',
      description: node.description || '',
      outcome: node.outcome || '',
      focus_items: Array.isArray(node.focus) ? node.focus.filter(Boolean) : [],
      mistake_items: Array.isArray(node.mistakes) ? node.mistakes.filter(Boolean) : [],
      node_state: node.state || 'available',
      expansion_paths: Array.isArray(node.expansionPaths) ? node.expansionPaths : [],
      source_node_id: node.sourceNodeId || null,
      unlock_phase: node.unlockPhase === 'core' ? 'core' : 'expansion',
      unlock_order: Number.isFinite(node.unlockOrder) ? node.unlockOrder : null,
      requires_validation: node.requiresValidation === true,
      unlock_parent_node_id: node.unlockParentNodeId || null,
      canvas_x: Number(node.x) || 0,
      canvas_y: Number(node.y) || 0,
      tier: Number.isFinite(node.tier) ? node.tier : null,
      lane: Number.isFinite(node.lane) ? node.lane : null,
      node_size: node.size || 'main',
      order_index: Number.isFinite(node.orderIndex) ? node.orderIndex : index,
    }))

    let { error: nodeError } = await admin.from('gameplan_nodes').insert(nodeRows)

    if (nodeError?.message?.includes("'requires_validation'") || nodeError?.message?.includes("'unlock_parent_node_id'") || nodeError?.message?.includes("'unlock_phase'") || nodeError?.message?.includes("'unlock_order'")) {
      const legacyNodeRows = nodeRows.map((row: Record<string, unknown>) => {
        const { unlock_phase, unlock_order, requires_validation, unlock_parent_node_id, ...rest } = row
        void unlock_phase
        void unlock_order
        void requires_validation
        void unlock_parent_node_id
        return rest
      })
      const legacyInsert = await admin.from('gameplan_nodes').insert(legacyNodeRows)
      nodeError = legacyInsert.error
    }

    if (nodeError) throw new Error(nodeError.message)
  }

  if (Array.isArray(plan.edges) && plan.edges.length > 0) {
    const edgeRows = plan.edges
      .filter((edge: any) => edge.fromNodeId && edge.toNodeId)
      .map((edge: any, index: number) => ({
        id: edge.id,
        plan_id: plan.id,
        from_node_id: edge.fromNodeId,
        to_node_id: edge.toNodeId,
        label: edge.label || null,
        order_index: Number.isFinite(edge.orderIndex) ? edge.orderIndex : index,
      }))

    const { error: edgeError } = await admin.from('gameplan_edges').insert(edgeRows)
    if (edgeError) throw new Error(edgeError.message)
  }

  if (Array.isArray(plan.assignments) && plan.assignments.length > 0) {
    const assignmentRows = plan.assignments
      .filter((assignment: any) => assignment.profileId || assignment.archetypeId)
      .map((assignment: any, index: number) => ({
        id: assignment.id,
        plan_id: plan.id,
        target_type: assignment.targetType === 'profile' ? 'profile' : 'archetype',
        profile_id: assignment.profileId || null,
        archetype_id: assignment.archetypeId || null,
        priority: Number.isFinite(assignment.priority) ? assignment.priority : index,
        is_active: assignment.isActive !== false,
      }))

    if (assignmentRows.length > 0) {
      const { error: assignmentError } = await admin.from('gameplan_assignments').insert(assignmentRows)
      if (assignmentError) throw new Error(assignmentError.message)
    }
  }
}

async function duplicatePlan(admin: NonNullable<ReturnType<typeof createAdminClient>>, planId: string) {
  let { data, error } = await admin.from('gameplans').select(PLAN_SELECT_FULL).eq('id', planId).maybeSingle()
  if (error?.message?.includes("'requires_validation'") || error?.message?.includes("'unlock_parent_node_id'") || error?.message?.includes("'unlock_phase'") || error?.message?.includes("'unlock_order'") || error?.message?.includes("'hero_image_url'")) {
    const legacyResponse = await admin.from('gameplans').select(PLAN_SELECT_LEGACY).eq('id', planId).maybeSingle()
    data = legacyResponse.data
    error = legacyResponse.error
  }
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Plan nicht gefunden.')

  const plan = toAdminPlan(data)
  const nextPlan = createEmptyAdminPlan()
  const nodeIdMap = new Map<string, string>()

  const duplicatedNodes = plan.nodes.map((node, index) => {
    const nextId = `${slugify(node.title || 'node')}-${crypto.randomUUID().slice(0, 8)}`
    nodeIdMap.set(node.id, nextId)
    return { ...node, id: nextId, orderIndex: index }
  })

  const duplicatedEdges = plan.edges.map((edge, index) => ({
    ...edge,
    id: crypto.randomUUID(),
    fromNodeId: nodeIdMap.get(edge.fromNodeId) ?? edge.fromNodeId,
    toNodeId: nodeIdMap.get(edge.toNodeId) ?? edge.toNodeId,
    orderIndex: index,
  }))

  const duplicatedAssignments = plan.assignments.map((assignment, index) => ({
    ...assignment,
    id: crypto.randomUUID(),
    priority: index,
  }))

  await savePlan(admin, {
    ...nextPlan,
    slug: slugify(`${plan.slug}-copy-${Date.now()}`),
    title: `${plan.title} Copy`,
    headline: plan.headline,
    status: 'draft',
    creatorName: plan.creatorName,
    creatorRole: plan.creatorRole,
    creatorInitials: plan.creatorInitials,
    creatorProfileHref: plan.creatorProfileHref,
    canvasWidth: plan.canvasWidth,
    canvasHeight: plan.canvasHeight,
    mainPathNodeIds: plan.mainPathNodeIds.map((id) => nodeIdMap.get(id) ?? id),
    isFallbackDefault: false,
    nodes: duplicatedNodes,
    edges: duplicatedEdges,
    assignments: duplicatedAssignments,
  })
}

async function deletePlan(admin: NonNullable<ReturnType<typeof createAdminClient>>, planId: string) {
  await admin.from('gameplan_edges').delete().eq('plan_id', planId)
  await admin.from('gameplan_assignments').delete().eq('plan_id', planId)
  await admin.from('gameplan_nodes').delete().eq('plan_id', planId)

  const { error } = await admin.from('gameplans').delete().eq('id', planId)
  if (error) throw new Error(error.message)
}

export async function GET(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  try {
    await syncArchetypes(admin)
    const [plans, profiles, currentAdminProfile] = await Promise.all([
      fetchPlans(admin),
      fetchProfiles(admin),
      fetchCurrentAdminProfile(admin, user.id),
    ])
    return NextResponse.json({ plans, profiles, currentAdminProfile })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, admin } = await resolveAdmin(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const action = body?.action

    if (action === 'duplicate') {
      await duplicatePlan(admin, body.planId)
    } else if (action === 'save') {
      await savePlan(admin, body.plan)
    } else if (action === 'create') {
      const plan = body.plan ?? createEmptyAdminPlan()
      await savePlan(admin, plan)
    } else if (action === 'delete') {
      await deletePlan(admin, body.planId)
    } else {
      return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
    }

    const [plans, profiles, currentAdminProfile] = await Promise.all([
      fetchPlans(admin),
      fetchProfiles(admin),
      fetchCurrentAdminProfile(admin, user.id),
    ])
    return NextResponse.json({ ok: true, plans, profiles, currentAdminProfile })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler.' }, { status: 500 })
  }
}
