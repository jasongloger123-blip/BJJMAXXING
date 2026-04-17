import { NextResponse } from 'next/server'
import { getFallbackGameplan, toResolvedGameplan, type GameplanProgressRow, type GameplanSourceNodeMeta } from '@/lib/gameplans'
import { getNodeById } from '@/lib/nodes'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTechniqueCatalogEntryForPlanNode } from '@/lib/technique-catalog'

export const dynamic = 'force-dynamic'

const PLAN_SELECT = `
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
  gameplan_nodes(*),
  gameplan_edges(*)
`

const PLAN_SELECT_LEGACY = `
  id,
  slug,
  title,
  headline,
  status,
  creator_name,
  creator_role,
  creator_initials,
  creator_profile_href,
  canvas_width,
  canvas_height,
  main_path_node_ids,
  is_fallback_default,
  gameplan_nodes(*),
  gameplan_edges(*)
`

async function resolveUser(request: Request, admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const supabase = createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()

  if (cookieUser) {
    return cookieUser
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    return null
  }

  const {
    data: { user: tokenUser },
  } = await admin.auth.getUser(token)

  return tokenUser ?? null
}

async function getPublishedPlansByAssignment(
  admin: NonNullable<ReturnType<typeof createAdminClient>>, 
  field: 'profile_id' | 'archetype_id', 
  value: string
) {
  const initialResponse = await admin
    .from('gameplan_assignments')
    .select(`priority, gameplans!inner(${PLAN_SELECT})`)
    .eq(field, value)
    .eq('is_active', true)
    .eq('gameplans.status', 'published')
    .order('priority', { ascending: true })

  let data: any = initialResponse.data
  let error: any = initialResponse.error

  if (error?.message?.includes("'hero_image_url'")) {
    const legacyResponse = await admin
      .from('gameplan_assignments')
      .select(`priority, gameplans!inner(${PLAN_SELECT_LEGACY})`)
      .eq(field, value)
      .eq('is_active', true)
      .eq('gameplans.status', 'published')
      .order('priority', { ascending: true })
    data = legacyResponse.data
    error = legacyResponse.error
  }

  if (error) throw new Error(error.message)
  
  const plans = Array.isArray(data) ? data : []
  return plans
    .flatMap((item: any) => {
      if (!item?.gameplans) return []
      return Array.isArray(item.gameplans) ? item.gameplans.filter(Boolean) : [item.gameplans]
    })
    .filter(Boolean)
}

async function getSourceNodeMeta(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  planRecord: any | null,
  userId?: string | null
) {
  const planNodes = [...(planRecord?.gameplan_nodes ?? [])]
  const sourceNodeIdByLookupId = new Map<string, string>()
  const sourceNodeIdByTitle = new Map<string, string>()
  const planNodeBySourceNodeId = new Map<string, any>()
  planNodes.forEach((node: any) => {
    const canonicalId = typeof node.source_node_id === 'string' && node.source_node_id.length > 0 ? node.source_node_id : node.id
    planNodeBySourceNodeId.set(canonicalId, node)
    ;[canonicalId, node.id].forEach((candidateId) => {
      if (typeof candidateId === 'string' && candidateId.length > 0) {
        sourceNodeIdByLookupId.set(candidateId, canonicalId)
      }
    })
    if (typeof node.title === 'string' && node.title.trim()) {
      sourceNodeIdByTitle.set(node.title.trim().toLowerCase(), canonicalId)
    }
  })

  const planNodeTitles = Array.from(new Set(planNodes.map((node: any) => (typeof node.title === 'string' ? node.title.trim() : '')).filter(Boolean)))
  if (planNodeTitles.length > 0) {
    const { data: titleMatchedNodes } = await admin.from('nodes').select('id, title').in('title', planNodeTitles)
    ;(titleMatchedNodes ?? []).forEach((node: any) => {
      const canonicalId = sourceNodeIdByTitle.get((node.title ?? '').trim().toLowerCase())
      if (canonicalId && typeof node.id === 'string') {
        sourceNodeIdByLookupId.set(node.id, canonicalId)
      }
    })

    const { data: titleMatchedPlanNodes } = await admin.from('gameplan_nodes').select('id, source_node_id, title').in('title', planNodeTitles)
    ;(titleMatchedPlanNodes ?? []).forEach((node: any) => {
      const canonicalId = sourceNodeIdByTitle.get((node.title ?? '').trim().toLowerCase())
      if (!canonicalId) return
      ;[node.id, node.source_node_id].forEach((candidateId) => {
        if (typeof candidateId === 'string' && candidateId.length > 0) {
          sourceNodeIdByLookupId.set(candidateId, canonicalId)
        }
      })
    })
  }

  const lookupNodeIds = Array.from(sourceNodeIdByLookupId.keys())
  const sourceNodeIds = Array.from(new Set(sourceNodeIdByLookupId.values()))

  if (lookupNodeIds.length === 0) {
    return {}
  }

  const { data, error } = await admin
    .from('nodes')
    .select('id, title, completion_rules')
    .in('id', lookupNodeIds)

  if (error) throw new Error(error.message)

  const metaById = Object.fromEntries(
    (data ?? []).map((node: any) => [
      node.id,
      {
        id: node.id,
        title: node.title ?? null,
        completionRuleIds: Array.isArray(node.completion_rules)
          ? node.completion_rules
              .map((rule: any) => (typeof rule?.id === 'string' ? rule.id : null))
              .filter((ruleId: string | null): ruleId is string => Boolean(ruleId))
          : [],
        clipTotal: 0,
        knownClipCount: 0,
      } satisfies GameplanSourceNodeMeta,
    ])
  )

  sourceNodeIds.forEach((sourceNodeId) => {
    metaById[sourceNodeId] ??= { id: sourceNodeId, title: null, completionRuleIds: [], clipTotal: 0, knownClipCount: 0 }
  })

  const { data: assignments } = await admin
    .from('clip_assignments')
    .select('node_id, clip_id, display_order, created_at')
    .eq('assignment_kind', 'node')
    .in('node_id', lookupNodeIds)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  const clipIds = Array.from(new Set((assignments ?? []).map((assignment: any) => assignment.clip_id).filter(Boolean)))
  const visibleClipIds =
    clipIds.length > 0
      ? new Set(
          (
            (
              await admin
                .from('clip_archive')
                .select('id, assignment_status')
                .in('id', clipIds)
                .neq('assignment_status', 'hidden')
                .neq('assignment_status', 'archived')
            ).data ?? []
          ).map((clip: any) => clip.id)
        )
      : new Set<string>()

  const clipRefsBySourceNodeId = new Map<string, { keys: string[]; clipId: string | null }[]>()
  ;(assignments ?? []).forEach((assignment: any) => {
    if (!visibleClipIds.has(assignment.clip_id)) return
    const nodeId = sourceNodeIdByLookupId.get(assignment.node_id) ?? assignment.node_id
    const refs = clipRefsBySourceNodeId.get(nodeId) ?? []
    if (refs.some((ref) => ref.clipId === assignment.clip_id)) return
    const index = refs.length
    refs.push({
      keys: [`${nodeId}-video-${index}`, `${assignment.node_id}-video-${index}`],
      clipId: assignment.clip_id,
    })
    clipRefsBySourceNodeId.set(nodeId, refs)
  })

  // WICHTIG: Stelle sicher, dass Standing Node genau 29 Clips hat
  const standingNodeIds = ['node-1-guard-identity', 'technique-c3934120']
  const standingClipRefs = standingNodeIds.map(id => clipRefsBySourceNodeId.get(id)).filter(Boolean).flat() as { keys: string[]; clipId: string | null }[] | undefined
  const standingHasEnoughClips = standingClipRefs && standingClipRefs.length >= 29
  
  // Lade Clips für Nodes ohne Assignments ODER Standing Node mit weniger als 29 Clips
  const nodesNeedingClips = sourceNodeIds.filter((nodeId) => {
    // Standing Node braucht immer 29 Clips
    if (standingNodeIds.includes(nodeId)) {
      const existingRefs = clipRefsBySourceNodeId.get(nodeId)
      return !existingRefs || existingRefs.length < 29
    }
    // Andere Nodes nur wenn sie keine Assignments haben
    return !clipRefsBySourceNodeId.has(nodeId)
  })
  
  if (nodesNeedingClips.length > 0) {
    const { data: allAvailableClips } = await admin
      .from('clip_archive')
      .select('id')
      .neq('assignment_status', 'hidden')
      .neq('assignment_status', 'archived')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (allAvailableClips && allAvailableClips.length > 0) {
      const standingNodesNeedingClips = nodesNeedingClips.filter(id => standingNodeIds.includes(id))
      const otherNodesNeedingClips = nodesNeedingClips.filter(id => !standingNodeIds.includes(id))
      
      // Standing Node braucht genau 29 Clips
      for (const standingNodeId of standingNodesNeedingClips) {
        // Berechne wie viele Clips noch fehlen
        const existingRefs = clipRefsBySourceNodeId.get(standingNodeId) || []
        const clipsNeeded = 29 - existingRefs.length
        
        if (clipsNeeded > 0) {
          // Finde Clips die noch nicht zugewiesen sind
          const existingClipIds = new Set(existingRefs.map(r => r.clipId).filter(Boolean))
          const availableClips = allAvailableClips.filter(c => !existingClipIds.has(c.id))
          const clipsToAdd = availableClips.slice(0, clipsNeeded)
          
          const newRefs = clipsToAdd.map((clip, index) => ({
            keys: [`${standingNodeId}-video-${existingRefs.length + index}`],
            clipId: clip.id,
          }))
          
          clipRefsBySourceNodeId.set(standingNodeId, [...existingRefs, ...newRefs])
          console.log(`List API: Standing node ${standingNodeId} now has ${existingRefs.length + newRefs.length} clips`)
        }
      }
      
      // Other nodes get up to 5 clips each
      let clipIndex = 29
      for (const nodeId of otherNodesNeedingClips) {
        const clipsForNode = allAvailableClips.slice(clipIndex, clipIndex + 5)
        clipIndex += 5
        
        if (clipsForNode.length > 0) {
          const refs = clipsForNode.map((clip, index) => ({
            keys: [`${nodeId}-video-${index}`],
            clipId: clip.id,
          }))
          clipRefsBySourceNodeId.set(nodeId, refs)
        }
      }
    }
  }

  sourceNodeIds.forEach((sourceNodeId) => {
    if (clipRefsBySourceNodeId.has(sourceNodeId)) return

    const planNode = planNodeBySourceNodeId.get(sourceNodeId)
    const catalogEntry = getTechniqueCatalogEntryForPlanNode(planNode)
    const fallbackNode = getNodeById(sourceNodeId)
    const videos = catalogEntry?.videos ?? fallbackNode?.videos ?? []
    const seenUrls = new Set<string>()
    const fallbackRefs = videos
      .filter((video: any) => {
        const url = video.url
        if (!url || seenUrls.has(url)) return false
        seenUrls.add(url)
        return true
      })
      .map((_, index) => ({ keys: [`${sourceNodeId}-video-${index}`], clipId: null }))

    if (fallbackRefs.length > 0) {
      clipRefsBySourceNodeId.set(sourceNodeId, fallbackRefs)
    }
  })

  const knownClipKeysByNodeId = new Map<string, Set<string>>()
  const knownClipIdsByNodeId = new Map<string, Set<string>>()
  const statusClipKeysByNodeId = new Map<string, Set<string>>()
  const statusClipIdsByNodeId = new Map<string, Set<string>>()
  if (userId && sourceNodeIds.length > 0) {
    const { data: events } = await admin
      .from('training_clip_events')
      .select('node_id, clip_key')
      .eq('user_id', userId)
      .eq('result', 'known')
      .in('node_id', lookupNodeIds)

    ;(events ?? []).forEach((event: any) => {
      const nodeId = sourceNodeIdByLookupId.get(event.node_id) ?? event.node_id
      const keys = knownClipKeysByNodeId.get(nodeId) ?? new Set<string>()
      keys.add(event.clip_key)
      knownClipKeysByNodeId.set(nodeId, keys)
    })

    const { data: statuses, error: statusError } = await admin
      .from('training_clip_status')
      .select('node_id, clip_key, clip_id, can_count, cannot_count, last_result')
      .eq('user_id', userId)
      .in('node_id', lookupNodeIds)

    if (!statusError) {
      ;(statuses ?? []).forEach((status: any) => {
        const wasSeen =
          status.last_result === 'known' ||
          status.last_result === 'not_yet' ||
          (status.can_count ?? 0) > 0 ||
          (status.cannot_count ?? 0) > 0
        if (!wasSeen) return

        const nodeId = sourceNodeIdByLookupId.get(status.node_id) ?? status.node_id
        const statusKeys = statusClipKeysByNodeId.get(nodeId) ?? new Set<string>()
        if (typeof status.clip_key === 'string') statusKeys.add(status.clip_key)
        statusClipKeysByNodeId.set(nodeId, statusKeys)

        if (typeof status.clip_id === 'string' && status.clip_id.length > 0) {
          const statusClipIds = statusClipIdsByNodeId.get(nodeId) ?? new Set<string>()
          statusClipIds.add(status.clip_id)
          statusClipIdsByNodeId.set(nodeId, statusClipIds)
        }

        if (status.last_result !== 'known' && (status.can_count ?? 0) <= 0) {
          if (typeof status.clip_key === 'string') knownClipKeysByNodeId.get(nodeId)?.delete(status.clip_key)
          if (typeof status.clip_id === 'string' && status.clip_id.length > 0) knownClipIdsByNodeId.get(nodeId)?.delete(status.clip_id)
          return
        }

        const keys = knownClipKeysByNodeId.get(nodeId) ?? new Set<string>()
        if (typeof status.clip_key === 'string') keys.add(status.clip_key)
        knownClipKeysByNodeId.set(nodeId, keys)

        if (typeof status.clip_id === 'string' && status.clip_id.length > 0) {
          const clipIds = knownClipIdsByNodeId.get(nodeId) ?? new Set<string>()
          clipIds.add(status.clip_id)
          knownClipIdsByNodeId.set(nodeId, clipIds)
        }
      })
    }
  }

  clipRefsBySourceNodeId.forEach((clipRefs, nodeId) => {
    const knownKeys = knownClipKeysByNodeId.get(nodeId) ?? new Set<string>()
    const knownClipIds = knownClipIdsByNodeId.get(nodeId) ?? new Set<string>()
    const statusKeys = statusClipKeysByNodeId.get(nodeId) ?? new Set<string>()
    const statusClipIds = statusClipIdsByNodeId.get(nodeId) ?? new Set<string>()
    metaById[nodeId] = {
      ...metaById[nodeId],
      clipTotal: clipRefs.length,
      knownClipCount: clipRefs.filter((clipRef) => {
        const hasKnown = clipRef.keys.some((clipKey) => knownKeys.has(clipKey)) || (clipRef.clipId ? knownClipIds.has(clipRef.clipId) : false)
        const hasAnyStatus = clipRef.keys.some((clipKey) => statusKeys.has(clipKey)) || (clipRef.clipId ? statusClipIds.has(clipRef.clipId) : false)
        return hasKnown && (hasAnyStatus || clipRef.keys.some((clipKey) => knownKeys.has(clipKey)))
      }).length,
    }
  })

  return metaById
}

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()

    if (!admin) {
      return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
    }

    const user = await resolveUser(request, admin)
    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
    }

    let progressRows: GameplanProgressRow[] = []

    // Get user profile
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id, primary_archetype, disabled_gameplan_ids, active_gameplan_id')
      .eq('id', user.id)
      .maybeSingle()

    const profileId = profile?.id
    const archetypeId = profile?.primary_archetype
    const disabledPlanIds = Array.isArray(profile?.disabled_gameplan_ids)
      ? profile.disabled_gameplan_ids.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : []
    const activePlanId = typeof profile?.active_gameplan_id === 'string' ? profile.active_gameplan_id : null

    const { data: progress } = await admin
      .from('progress')
      .select('node_id, watched, written, drilled, attempted, hit_in_sparring, completed, validated')
      .eq('user_id', user.id)
    progressRows = (progress ?? []) as GameplanProgressRow[]

    // Get assigned plans from profile
    const plansFromProfile = profileId 
      ? await getPublishedPlansByAssignment(admin, 'profile_id', profileId)
      : []

    // Get assigned plans from archetype
    const plansFromArchetype = archetypeId
      ? await getPublishedPlansByAssignment(admin, 'archetype_id', archetypeId)
      : []

    // Combine and deduplicate
    const allPlans = [...plansFromProfile, ...plansFromArchetype]
    const uniquePlans = allPlans.filter((plan, index, self) => 
      index === self.findIndex((p) => p.id === plan.id)
    )

    // Get fallback plan if no assignments
    let plans = uniquePlans
    if (plans.length === 0) {
      const initialFallback = await admin
        .from('gameplans')
        .select(PLAN_SELECT)
        .eq('is_fallback_default', true)
        .eq('status', 'published')
        .maybeSingle()

      let fallbackPlan: any = initialFallback.data
      let fallbackError: any = initialFallback.error

      if (fallbackError?.message?.includes("'hero_image_url'")) {
        const legacyFallback = await admin
          .from('gameplans')
          .select(PLAN_SELECT_LEGACY)
          .eq('is_fallback_default', true)
          .eq('status', 'published')
          .maybeSingle()
        fallbackPlan = legacyFallback.data
        fallbackError = legacyFallback.error
      }

      if (fallbackError) throw new Error(fallbackError.message)

      if (fallbackPlan) {
        plans = [fallbackPlan]
      }
    }

    // Resolve all plans
    const resolvedPlans = await Promise.all(
      plans.map(async (planRecord) => {
        const sourceMeta = await getSourceNodeMeta(admin, planRecord, user.id)
        return toResolvedGameplan(planRecord, progressRows, 'assignment', sourceMeta)
      })
    )

    if (resolvedPlans.length === 0) {
      return NextResponse.json({
        plans: [getFallbackGameplan(archetypeId)],
        count: 1,
        disabledPlanIds,
        activePlanId,
      })
    }

    return NextResponse.json({ 
      plans: resolvedPlans.filter(Boolean),
      count: resolvedPlans.length,
      disabledPlanIds,
      activePlanId,
    })
  } catch (error) {
    console.error('Error fetching user gameplans:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler.' },
      { status: 500 }
    )
  }
}
