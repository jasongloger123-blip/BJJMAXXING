export type StageKey = 'position' | 'pass' | 'submission'
export type UnlockPhase = 'core' | 'expansion'
export type NodeState = 'completed' | 'current' | 'available' | 'locked' | 'silhouette'
export type NodeSize = 'main' | 'branch' | 'future'
export type GameplanStatus = 'draft' | 'published'
export type GameplanProgressRow = {
  node_id: string
  watched?: boolean | null
  written?: boolean | null
  drilled?: boolean | null
  attempted?: boolean | null
  hit_in_sparring?: boolean | null
  completed?: boolean | null
  validated?: boolean | null
}

export type GameplanSourceNodeMeta = {
  id: string
  title?: string | null
  completionRuleIds: string[]
  clipTotal?: number
  knownClipCount?: number
}

export type PlanNode = {
  id: string
  title: string
  stage: StageKey
  label: string
  description: string
  outcome: string
  focus: string[]
  mistakes: string[]
  state: NodeState
  expansionPaths?: string[][]
  sourceNodeId?: string | null
  unlockPhase?: UnlockPhase
  unlockOrder?: number | null
  requiresValidation?: boolean
  unlockParentNodeId?: string | null
  progressPercent?: number
  progressCompletedRules?: number
  progressTotalRules?: number
}

export type GameplanLayoutNode = {
  id: string
  tier?: number | null
  lane?: number | null
  x?: number | null
  y?: number | null
  size: NodeSize
}

export type GameplanLayoutEdge = {
  from: string
  to: string
}

export type ResolvedGameplan = {
  id: string
  slug: string
  title: string
  headline: string
  heroImageUrl?: string | null
  status: GameplanStatus
  creatorName: string
  creatorRole: string
  creatorInitials: string
  creatorAvatarUrl?: string | null
  creatorProfileHref: string
  mainPath: string[]
  nodes: Record<string, PlanNode>
  layout: {
    width: number
    height: number
    nodes: GameplanLayoutNode[]
    edges: GameplanLayoutEdge[]
  }
  source: 'assignment' | 'fallback'
  unlockSummary: {
    coreCompletedCount: number
    coreTotalCount: number
    expansionCompletedCount: number
    expansionTotalCount: number
    currentNodeId: string | null
    validationPendingNodeId: string | null
    currentSourceNodeId: string | null
    coreValidated: boolean
    unlockedNodeIds: string[]
    unlockedSourceNodeIds: string[]
    lockedSourceNodeIds: string[]
    visibleNodeIds: string[]
    visibleSourceNodeIds: string[]
  }
}

export type GameplanAdminNode = {
  id: string
  title: string
  stage: StageKey
  label: string
  description: string
  outcome: string
  focus: string[]
  mistakes: string[]
  state: NodeState
  expansionPaths: string[][]
  sourceNodeId: string | null
  unlockPhase: UnlockPhase
  unlockOrder: number | null
  requiresValidation: boolean
  unlockParentNodeId: string | null
  x: number
  y: number
  tier: number | null
  lane: number | null
  size: NodeSize
  orderIndex: number
}

export type GameplanAdminEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  label: string | null
  orderIndex: number
}

export type GameplanAssignmentTarget = 'profile' | 'archetype'

export type GameplanAdminAssignment = {
  id: string
  targetType: GameplanAssignmentTarget
  profileId: string | null
  archetypeId: string | null
  priority: number
  isActive: boolean
}

export type GameplanAdminPlan = {
  id: string
  slug: string
  title: string
  headline: string
  heroImageUrl: string | null
  status: GameplanStatus
  creatorName: string
  creatorRole: string
  creatorInitials: string
  creatorProfileHref: string
  canvasWidth: number
  canvasHeight: number
  mainPathNodeIds: string[]
  isFallbackDefault: boolean
  updatedAt: string
  nodes: GameplanAdminNode[]
  edges: GameplanAdminEdge[]
  assignments: GameplanAdminAssignment[]
  directProfileAssignmentCount: number
  archetypeAssignmentCount: number
  assignmentPriorityNote: string | null
}

export type GameplanProfileOption = {
  id: string
  label: string
  archetypeId: string | null
}

function getInitials(value: string) {
  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'GP'
}

export function isTechnicalGuardArchetype(archetypeId?: string | null) {
  return archetypeId === 'flexible-guard-technician' || archetypeId === 'long-technical-guard-player'
}

export function createEmptyAdminPlan(): GameplanAdminPlan {
  return {
    id: crypto.randomUUID(),
    slug: `gameplan-${Date.now()}`,
    title: 'New Plan',
    headline: 'New Gameplan',
    heroImageUrl: null,
    status: 'draft',
    creatorName: 'BJJMAXXING',
    creatorRole: 'Custom Plan',
    creatorInitials: 'BM',
    creatorProfileHref: '/profile',
    canvasWidth: 1600,
    canvasHeight: 900,
    mainPathNodeIds: [],
    isFallbackDefault: false,
    updatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    assignments: [],
    directProfileAssignmentCount: 0,
    archetypeAssignmentCount: 0,
    assignmentPriorityNote: null,
  }
}

function resolveSourceNodeId(node: Pick<PlanNode, 'id' | 'sourceNodeId'>) {
  return node.sourceNodeId ?? node.id
}

function toProgressLookup(rows: GameplanProgressRow[]) {
  return new Map(
    rows.map((row) => [
      row.node_id,
      {
        watched: row.watched === true,
        written: row.written === true,
        drilled: row.drilled === true,
        attempted: row.attempted === true,
        hit_in_sparring: row.hit_in_sparring === true,
        completed: row.completed === true,
        validated: row.validated === true,
      },
    ])
  )
}

function normalizePlanUnlockMetadata(plan: Omit<ResolvedGameplan, 'unlockSummary'>) {
  const maybeLegacyFlexibleMainPath =
    (plan.mainPath.join('>') === 'stand-up>closed-guard>backtake>rear-naked-choke' ||
      plan.mainPath.join('>') === 'rear-naked-choke>backtake>closed-guard>stand-up') &&
    ['rear-naked-choke', 'backtake', 'closed-guard', 'stand-up'].every((nodeId) => plan.nodes[nodeId])
  const normalizedMainPath = maybeLegacyFlexibleMainPath
    ? ['rear-naked-choke', 'backtake', 'closed-guard', 'stand-up']
    : plan.mainPath
  const mainPathSet = new Set(normalizedMainPath)
  const orderedIds = Array.from(new Set([...plan.layout.nodes.map((node) => node.id), ...Object.keys(plan.nodes)]))
  const incomingParentMap = new Map<string, string | null>()
  const seenExpansionIds = new Set<string>()
  let nextExpansionOrder = 1

  plan.layout.edges.forEach((edge) => {
    if (!incomingParentMap.has(edge.to)) {
      incomingParentMap.set(edge.to, edge.from)
    }
  })

  const nodes = Object.fromEntries(
    orderedIds.map((nodeId) => {
      const node = plan.nodes[nodeId]
      const patchedNode =
        nodeId === 'closed-guard' && maybeLegacyFlexibleMainPath
          ? {
              ...node,
              title: 'De La Riva',
              label: node.label === 'Kontrolle & Grips' ? 'Entry Position' : node.label,
            }
          : node
      const mainPathIndex = normalizedMainPath.indexOf(nodeId)
      const isCore = mainPathIndex !== -1
      const unlockPhase = patchedNode?.unlockPhase ?? (isCore ? 'core' : 'expansion')
      const unlockOrder =
        typeof patchedNode?.unlockOrder === 'number'
          ? patchedNode.unlockOrder
          : isCore
            ? mainPathIndex + 1
            : (() => {
                if (!seenExpansionIds.has(nodeId)) {
                  seenExpansionIds.add(nodeId)
                  nextExpansionOrder += 1
                }
                return nextExpansionOrder - 1
              })()
      const requiresValidation =
        patchedNode?.requiresValidation ?? (isCore && mainPathIndex === normalizedMainPath.length - 1)
      const unlockParentNodeId =
        patchedNode?.unlockParentNodeId ?? (!mainPathSet.has(nodeId) ? incomingParentMap.get(nodeId) ?? null : null)

      return [
        nodeId,
        {
          ...patchedNode,
          unlockPhase,
          unlockOrder,
          requiresValidation,
          unlockParentNodeId,
        } satisfies PlanNode,
      ]
    })
  ) as Record<string, PlanNode>

  return {
    ...plan,
    mainPath: normalizedMainPath,
    layout: maybeLegacyFlexibleMainPath
      ? {
          ...plan.layout,
          nodes: plan.layout.nodes.map((node) => {
            if (node.id === 'stand-up') return { ...node, tier: 0, x: 24 }
            if (node.id === 'closed-guard') return { ...node, tier: 1, x: 344 }
            if (node.id === 'backtake') return { ...node, tier: 2, x: 664 }
            if (node.id === 'rear-naked-choke') return { ...node, tier: 3, x: 984 }
            return node
          }),
          edges: plan.layout.edges.map((edge) => {
            if (edge.from === 'rear-naked-choke' && edge.to === 'backtake') return { from: 'backtake', to: 'rear-naked-choke' }
            if (edge.from === 'backtake' && edge.to === 'closed-guard') return { from: 'closed-guard', to: 'backtake' }
            if (edge.from === 'closed-guard' && edge.to === 'stand-up') return { from: 'stand-up', to: 'closed-guard' }
            return edge
          }),
        }
      : plan.layout,
    nodes,
  }
}

function withResolvedStates(
  plan: Omit<ResolvedGameplan, 'unlockSummary'>,
  progressRows: GameplanProgressRow[],
  sourceNodeMetaById: Record<string, GameplanSourceNodeMeta> = {}
): ResolvedGameplan {
  const normalizedPlan = normalizePlanUnlockMetadata(plan)
  const progressLookup = toProgressLookup(progressRows)
  const nodes = { ...normalizedPlan.nodes }
  const coreNodes = normalizedPlan.mainPath
    .map((nodeId) => nodes[nodeId])
    .filter(Boolean)
    .sort((a, b) => (a.unlockOrder ?? 0) - (b.unlockOrder ?? 0))
  const expansionNodes = Object.values(nodes)
    .filter((node) => node.unlockPhase === 'expansion')
    .sort((a, b) => (a.unlockOrder ?? 0) - (b.unlockOrder ?? 0))

  const getSnapshot = (node: PlanNode) => {
    const sourceNodeId = resolveSourceNodeId(node)
    const snapshot = progressLookup.get(sourceNodeId)
    const sourceMeta = sourceNodeMetaById[sourceNodeId]
    const completedByClips = Boolean(sourceMeta?.clipTotal && sourceMeta.clipTotal > 0 && (sourceMeta.knownClipCount ?? 0) >= sourceMeta.clipTotal)

    return {
      ...snapshot,
      completed: Boolean(snapshot?.completed) || completedByClips,
      validated: Boolean(snapshot?.validated) || completedByClips,
    }
  }
  const isNodeCompleted = (node: PlanNode) => getSnapshot(node).completed
  const isNodeResolved = (node: PlanNode) => {
    const snapshot = getSnapshot(node)
    return snapshot.completed && (!node.requiresValidation || snapshot.validated)
  }

  let coreResolvedPrefix = 0
  while (coreResolvedPrefix < coreNodes.length && isNodeResolved(coreNodes[coreResolvedPrefix])) {
    coreResolvedPrefix += 1
  }

  let validationPendingNodeId: string | null = null
  let currentNodeId: string | null = null
  let currentCoreIndex = coreResolvedPrefix
  const visibleNodeIds = new Set<string>()

  coreNodes.forEach((node, index) => {
    const snapshot = getSnapshot(node)
    if (index < coreResolvedPrefix) {
      nodes[node.id] = { ...node, state: 'completed' }
      return
    }

    if (index === coreResolvedPrefix) {
      if (snapshot.completed && node.requiresValidation && !snapshot.validated) {
        nodes[node.id] = { ...node, state: 'completed' }
        validationPendingNodeId = validationPendingNodeId ?? node.id
        currentNodeId = currentNodeId ?? node.id
        currentCoreIndex = index
        return
      }

      nodes[node.id] = { ...node, state: 'current' }
      currentNodeId = currentNodeId ?? node.id
      currentCoreIndex = index
      return
    }

    nodes[node.id] = { ...node, state: index === coreResolvedPrefix + 1 ? 'locked' : 'silhouette' }
  })

  const coreValidated = coreNodes.every((node) => isNodeResolved(node))
  let expansionCompletedCount = 0
  const unlockedNodeIds = new Set<string>()

  coreNodes.forEach((node) => {
    if (nodes[node.id].state !== 'locked' && nodes[node.id].state !== 'silhouette') {
      unlockedNodeIds.add(node.id)
    }
  })

  if (!coreValidated) {
    const currentCoreNode = coreNodes[currentCoreIndex] ?? null
    const nextCoreNode = currentCoreNode ? coreNodes[currentCoreIndex + 1] ?? null : coreNodes[0] ?? null

    if (currentCoreNode) {
      visibleNodeIds.add(currentCoreNode.id)
    }

    if (nextCoreNode) {
      nodes[nextCoreNode.id] = { ...nodes[nextCoreNode.id], state: 'locked' }
      visibleNodeIds.add(nextCoreNode.id)
    }
  }

  if (!coreValidated) {
    expansionNodes.forEach((node) => {
      nodes[node.id] = { ...node, state: 'silhouette' }
    })
  } else {
    const resolvedExpansionIds = new Set<string>(coreNodes.filter(isNodeResolved).map((node) => node.id))
    let currentExpansionAssigned = false

    expansionNodes.forEach((node, index) => {
      const snapshot = getSnapshot(node)
      const parentSatisfied = !node.unlockParentNodeId || resolvedExpansionIds.has(node.unlockParentNodeId) || coreNodes.some((coreNode) => coreNode.id === node.unlockParentNodeId && isNodeResolved(coreNode))
      const sequentialGate = index === expansionCompletedCount

      if (sequentialGate && parentSatisfied && isNodeResolved(node)) {
        nodes[node.id] = { ...node, state: 'completed' }
        expansionCompletedCount += 1
        resolvedExpansionIds.add(node.id)
        unlockedNodeIds.add(node.id)
        return
      }

      if (!currentExpansionAssigned && sequentialGate && parentSatisfied) {
        if (snapshot.completed && node.requiresValidation && !snapshot.validated) {
          nodes[node.id] = { ...node, state: 'completed' }
          validationPendingNodeId = validationPendingNodeId ?? node.id
          currentNodeId = currentNodeId ?? node.id
        } else {
          nodes[node.id] = { ...node, state: 'current' }
          currentNodeId = currentNodeId ?? node.id
        }
      currentExpansionAssigned = true
      unlockedNodeIds.add(node.id)
      return
    }

      nodes[node.id] = { ...node, state: 'locked' }
    })

    Object.values(nodes).forEach((node) => {
      visibleNodeIds.add(node.id)
    })
  }

  const unlockedSourceNodeIds = Array.from(
    new Set(
      Object.values(nodes)
        .filter((node) => node.state !== 'locked' && node.state !== 'silhouette')
        .map((node) => resolveSourceNodeId(node))
    )
  )
  const lockedSourceNodeIds = Array.from(
    new Set(
      Object.values(nodes)
        .filter((node) => node.state === 'locked' || node.state === 'silhouette')
        .map((node) => resolveSourceNodeId(node))
    )
  )
  const visibleSourceNodeIds = Array.from(
    new Set(
      Array.from(visibleNodeIds)
        .map((nodeId) => nodes[nodeId])
        .filter(Boolean)
        .map((node) => resolveSourceNodeId(node))
    )
  )

  Object.values(nodes).forEach((node) => {
    const sourceNodeId = resolveSourceNodeId(node)
    const sourceMeta = sourceNodeMetaById[sourceNodeId]
    const snapshot = progressLookup.get(sourceNodeId)
    const completionRuleIds = sourceMeta?.completionRuleIds ?? []
    const clipTotal = sourceMeta?.clipTotal ?? 0
    const completedRuleCount = completionRuleIds.filter((ruleId) => Boolean(snapshot?.[ruleId as keyof typeof snapshot])).length
    const validationTotal = node.requiresValidation ? 1 : 0
    const validationCompleted = node.requiresValidation && snapshot?.validated ? 1 : 0
    const progressTotalRules = clipTotal > 0 ? clipTotal : completionRuleIds.length + validationTotal
    const progressCompletedRules = clipTotal > 0 ? Math.min(clipTotal, sourceMeta?.knownClipCount ?? 0) : completedRuleCount + validationCompleted
    const progressPercent =
      progressTotalRules > 0
        ? Math.max(0, Math.min(100, Math.round((progressCompletedRules / progressTotalRules) * 100)))
        : node.state === 'completed'
          ? 100
          : node.state === 'current'
            ? 0
            : 0

    nodes[node.id] = {
      ...nodes[node.id],
      progressPercent,
      progressCompletedRules,
      progressTotalRules,
    }
  })

  return {
    ...normalizedPlan,
    nodes,
    unlockSummary: {
      coreCompletedCount: coreNodes.filter((node) => isNodeCompleted(node)).length,
      coreTotalCount: coreNodes.length,
      expansionCompletedCount,
      expansionTotalCount: expansionNodes.length,
      currentNodeId,
      validationPendingNodeId,
      currentSourceNodeId: currentNodeId ? resolveSourceNodeId(nodes[currentNodeId]) : null,
      coreValidated,
      unlockedNodeIds: Array.from(unlockedNodeIds),
      unlockedSourceNodeIds,
      lockedSourceNodeIds,
      visibleNodeIds: Array.from(visibleNodeIds),
      visibleSourceNodeIds,
    },
  }
}

export function toResolvedGameplan(
  record: any,
  progressRows: GameplanProgressRow[] = [],
  source: 'assignment' | 'fallback' = 'assignment',
  sourceNodeMetaById: Record<string, GameplanSourceNodeMeta> = {}
): ResolvedGameplan {
  const sortedNodes = [...(record.gameplan_nodes ?? [])]
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((node: any) => [
      node.id,
      {
        id: node.id,
        title: node.title,
        stage: node.stage,
        label: node.label,
        description: node.description,
        outcome: node.outcome,
        focus: Array.isArray(node.focus_items) ? node.focus_items : [],
        mistakes: Array.isArray(node.mistake_items) ? node.mistake_items : [],
        state: node.node_state,
        expansionPaths: Array.isArray(node.expansion_paths) ? node.expansion_paths : [],
        sourceNodeId: node.source_node_id ?? null,
        unlockPhase: node.unlock_phase ?? undefined,
        unlockOrder: typeof node.unlock_order === 'number' ? node.unlock_order : undefined,
        requiresValidation: node.requires_validation ?? undefined,
        unlockParentNodeId: node.unlock_parent_node_id ?? null,
      } satisfies PlanNode,
    ])

  return withResolvedStates({
    id: record.id,
    slug: record.slug,
    title: record.title,
    headline: record.headline,
    heroImageUrl: record.hero_image_url ?? null,
    status: record.status,
    creatorName: record.creator_name ?? 'BJJMAXXING',
    creatorRole: record.creator_role ?? 'Custom Plan',
    creatorInitials: record.creator_initials ?? getInitials(record.creator_name ?? record.title ?? 'GP'),
    creatorProfileHref: record.creator_profile_href ?? '/profile',
    mainPath: Array.isArray(record.main_path_node_ids) ? record.main_path_node_ids : [],
    nodes: Object.fromEntries(sortedNodes),
    layout: {
      width: record.canvas_width ?? 1600,
      height: record.canvas_height ?? 900,
      nodes: [...(record.gameplan_nodes ?? [])]
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((node: any) => ({
          id: node.id,
          tier: node.tier,
          lane: node.lane,
          x: node.canvas_x,
          y: node.canvas_y,
          size: node.node_size,
        })),
      edges: [...(record.gameplan_edges ?? [])]
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((edge: any) => ({ from: edge.from_node_id, to: edge.to_node_id })),
    },
    source,
  }, progressRows, sourceNodeMetaById)
}

export function toAdminPlan(record: any): GameplanAdminPlan {
  const assignments = [...(record.gameplan_assignments ?? [])]
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map((assignment: any) => ({
      id: assignment.id,
      targetType: assignment.target_type,
      profileId: assignment.profile_id ?? null,
      archetypeId: assignment.archetype_id ?? null,
      priority: assignment.priority ?? 0,
      isActive: assignment.is_active !== false,
    }))
  const activeAssignments = assignments.filter((assignment) => assignment.isActive)
  const directProfileAssignmentCount = activeAssignments.filter((assignment) => assignment.targetType === 'profile' && assignment.profileId).length
  const archetypeAssignmentCount = activeAssignments.filter((assignment) => assignment.targetType === 'archetype' && assignment.archetypeId).length
  const assignmentPriorityNote =
    directProfileAssignmentCount > 0
      ? 'Direkte Profil-Zuweisung hat Vorrang. Wenn ein Profil hier zugewiesen ist, wird dieser Plan fuer dieses Profil angezeigt, auch wenn der Archetyp nicht passt.'
      : archetypeAssignmentCount > 0
        ? 'Ohne direkte Profil-Zuweisung wird dieser Plan ueber passende Archetyp-Zuweisungen sichtbar.'
        : null

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    headline: record.headline,
    heroImageUrl: record.hero_image_url ?? null,
    status: record.status,
    creatorName: record.creator_name ?? 'BJJMAXXING',
    creatorRole: record.creator_role ?? 'Custom Plan',
    creatorInitials: record.creator_initials ?? getInitials(record.creator_name ?? record.title ?? 'GP'),
    creatorProfileHref: record.creator_profile_href ?? '/profile',
    canvasWidth: record.canvas_width ?? 1600,
    canvasHeight: record.canvas_height ?? 900,
    mainPathNodeIds: Array.isArray(record.main_path_node_ids) ? record.main_path_node_ids : [],
    isFallbackDefault: Boolean(record.is_fallback_default),
    updatedAt: record.updated_at ?? new Date().toISOString(),
    nodes: [...(record.gameplan_nodes ?? [])]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((node: any) => ({
        id: node.id,
        title: node.title,
        stage: node.stage,
        label: node.label,
        description: node.description,
        outcome: node.outcome,
        focus: Array.isArray(node.focus_items) ? node.focus_items : [],
        mistakes: Array.isArray(node.mistake_items) ? node.mistake_items : [],
        state: node.node_state,
        expansionPaths: Array.isArray(node.expansion_paths) ? node.expansion_paths : [],
        sourceNodeId: node.source_node_id ?? null,
        unlockPhase: node.unlock_phase ?? ((record.main_path_node_ids ?? []).includes(node.id) ? 'core' : 'expansion'),
        unlockOrder: typeof node.unlock_order === 'number' ? node.unlock_order : null,
        requiresValidation: node.requires_validation === true,
        unlockParentNodeId: node.unlock_parent_node_id ?? null,
        x: node.canvas_x ?? 0,
        y: node.canvas_y ?? 0,
        tier: node.tier ?? null,
        lane: node.lane ?? null,
        size: node.node_size,
        orderIndex: node.order_index ?? 0,
      })),
    edges: [...(record.gameplan_edges ?? [])]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((edge: any) => ({
        id: edge.id,
        fromNodeId: edge.from_node_id,
        toNodeId: edge.to_node_id,
        label: edge.label ?? null,
        orderIndex: edge.order_index ?? 0,
      })),
    assignments,
    directProfileAssignmentCount,
    archetypeAssignmentCount,
    assignmentPriorityNote,
  }
}

const DEFAULT_FALLBACK_PLAN: Omit<ResolvedGameplan, 'source' | 'unlockSummary'> = {
  id: 'fallback-a-plan',
  slug: 'fallback-a-plan',
  title: 'A-Plan',
  headline: 'Long Flexible Guard Player',
  status: 'published',
  creatorName: 'FGES',
  creatorRole: 'Fight School',
  creatorInitials: 'FG',
  creatorProfileHref: '/profile',
  mainPath: ['rear-naked-choke', 'backtake', 'closed-guard', 'stand-up'],
  nodes: {
    'stand-up': {
      id: 'stand-up',
      title: 'Stand Up',
      stage: 'position',
      label: 'Startposition',
      description: 'Hier beginnt dein Game Plan im Stand, bevor du in deine Guard-Verbindungen oder direkten Folgepfade gehst.',
      outcome: 'Definiert den Einstiegspunkt fuer den A-Plan und die Verbindung in deine Close Guard.',
      focus: ['Ersten Kontakt im Stand lesen', 'Balance vor dem Uebergang halten', 'Verbindung in die Guard frueh vorbereiten'],
      mistakes: ['Zu statisch im Stand bleiben', 'Ohne Verbindung nach unten gehen', 'Die Folgeposition zu spaet aufbauen'],
      state: 'completed',
      sourceNodeId: 'node-1-guard-identity',
      expansionPaths: [
        ['closed-guard', 'backtake', 'rear-naked-choke'],
        ['closed-guard', 'off-balance', 'backtake'],
        ['hip-bump-sweep', 'kuzushi-details', 'backtake'],
        ['guillotine', 'front-headlock', 'mounted-guillotine'],
        ['backtake-from-closed-guard', 'triangle-path', 'triangle-finish'],
      ],
    },
    'closed-guard': {
      id: 'closed-guard',
      title: 'De La Riva',
      stage: 'position',
      label: 'Entry Position',
      description: 'Hier baust du deine De-La-Riva-Position auf, bevor du den Winkel fuer den Backtake oeffnest.',
      outcome: 'Gibt dir den klaren Einstieg in deinen Rueckenangriff.',
      focus: ['Hook und Distanz sauber setzen', 'Winkel fuer die Rotation vorbereiten', 'Balance des Gegners frueh lesen'],
      mistakes: ['Zu flach vor dem Gegner bleiben', 'Hook ohne Kontrolle setzen', 'Winkel zu spaet aufbauen'],
      state: 'completed',
      sourceNodeId: 'node-3-dlr-connection',
      expansionPaths: [
        ['backtake', 'rear-naked-choke'],
        ['off-balance', 'backtake'],
        ['hip-bump-sweep', 'kuzushi-details', 'backtake'],
        ['guillotine', 'front-headlock', 'mounted-guillotine'],
        ['backtake-from-closed-guard', 'triangle-path', 'triangle-finish'],
      ],
    },
    'off-balance': {
      id: 'off-balance',
      title: 'Off-Balance',
      stage: 'pass',
      label: 'Gleichgewicht brechen',
      description: 'Du zwingst den Gegner nach vorne, zur Seite oder auf die Haende, damit sein Ruecken offen wird.',
      outcome: 'Schafft die ideale Vorarbeit fuer Backtake, Sweep oder Front-Headlock.',
      focus: ['Kopf ueber die Hips ziehen', 'Winkel vor Kraft nutzen', 'Reaktion lesen und nachsetzen'],
      mistakes: ['Nur mit Armen reissen', 'Zu frueh oeffnen', 'Gegner wieder stabil werden lassen'],
      state: 'current',
      expansionPaths: [
        ['backtake', 'seatbelt-control', 'rear-naked-choke'],
        ['wrestle-up', 'single-leg-finish'],
      ],
    },
    backtake: {
      id: 'backtake',
      title: 'Back Take',
      stage: 'position',
      label: 'Position sichern',
      description: 'Sobald der Gegner die Linie verliert, gehst du hinter die Huefte und uebernimmst den Ruecken.',
      outcome: 'Fuehrt in deine hoechstwertige Kontroll- und Submission-Position.',
      focus: ['Huefte hinterlaufen', 'Brustkontakt halten', 'Seatbelt vor hektischen Hooks sichern'],
      mistakes: ['Zu frueh nur auf die Hooks gehen', 'Seitlich am Ruecken haengen', 'Kopfposition verlieren'],
      state: 'available',
      sourceNodeId: 'node-7-back-entry',
      expansionPaths: [['seatbelt-control'], ['rear-naked-choke'], ['back-crucifix']],
    },
    'hip-bump-sweep': {
      id: 'hip-bump-sweep',
      title: 'Hip Bump Sweep',
      stage: 'pass',
      label: 'Alternative Position',
      description: 'Wenn der Gegner aufrecht bleibt, nutzt du die Reaktion fuer einen direkten Sweep.',
      outcome: 'Zweite starke Reaktion aus derselben Closed-Guard-Arbeit.',
      focus: ['Hand posten erzwingen', 'Huefte seitlich hochbringen'],
      mistakes: ['Zu weit weg bleiben', 'Keine Schulterlinie erzeugen'],
      state: 'available',
      expansionPaths: [['kuzushi-details', 'backtake']],
    },
    guillotine: {
      id: 'guillotine',
      title: 'Guillotine',
      stage: 'submission',
      label: 'Alternative Attack',
      description: 'Wenn der Kopf vorne bleibt, gehst du direkt in die Front-Headlock-Linie.',
      outcome: 'Erweitert dein Guard-Spiel um eine direkte Submission-Bedrohung.',
      focus: ['Kopf einsammeln', 'Ellbogenlinie eng halten'],
      mistakes: ['Zu hoch greifen', 'Kein Brustkontakt'],
      state: 'available',
      expansionPaths: [['front-headlock', 'mounted-guillotine']],
    },
    'backtake-from-closed-guard': {
      id: 'backtake-from-closed-guard',
      title: 'Backtake Route',
      stage: 'pass',
      label: 'Direkter Winkel',
      description: 'Du oeffnest nur kurz, gewinnst den Winkel und nimmst direkt den Ruecken oder die Trap-Line.',
      outcome: 'Direkterer Weg zum Ruecken aus der Closed Guard.',
      focus: ['Winkel zuerst', 'Rueckenlinie offen halten'],
      mistakes: ['Zu gross oeffnen', 'Huefte nicht mitnehmen'],
      state: 'available',
      expansionPaths: [['triangle-path', 'triangle-finish']],
    },
    'kuzushi-details': {
      id: 'kuzushi-details',
      title: 'Kuzushi Details',
      stage: 'pass',
      label: 'Timing',
      description: 'Feinabstimmung fuer Zugrichtung, Timing und den Moment, in dem der Gegner wirklich leicht wird.',
      outcome: 'Macht dein Off-Balancing sauberer und reproduzierbarer.',
      focus: ['Zugrichtung wechseln', 'Hand und Huefte koppeln'],
      mistakes: ['Immer nur in eine Richtung ziehen', 'Timing nicht lesen'],
      state: 'completed',
      expansionPaths: [['backtake']],
    },
    'front-headlock': {
      id: 'front-headlock',
      title: 'Front Headlock',
      stage: 'position',
      label: 'Kontrolle',
      description: 'Wenn der Gegner nach vorne kippt, kontrollierst du Kopf und Schulter fuer den direkten Finish.',
      outcome: 'Sichert den guillotine-lastigen Zweig.',
      focus: ['Kopf nach unten halten', 'Schulter blockieren'],
      mistakes: ['Nur am Hals haengen', 'Huefte zu weit weg'],
      state: 'available',
      expansionPaths: [['mounted-guillotine']],
    },
    'wrestle-up': {
      id: 'wrestle-up',
      title: 'Wrestle Up',
      stage: 'pass',
      label: 'Alternative Pass',
      description: 'Wenn der Gegner dir zu viel Raum gibt, gehst du aus der Guard nach oben.',
      outcome: 'Bringt dich in den Takedown-Zweig statt in den Backtake.',
      focus: ['Hand am Boden nutzen', 'Kopf ueber Knie bringen'],
      mistakes: ['Zu spaet aufstehen', 'Ruecken rund lassen'],
      state: 'available',
      expansionPaths: [['single-leg-finish']],
    },
    'triangle-path': {
      id: 'triangle-path',
      title: 'Triangle Path',
      stage: 'submission',
      label: 'Alternative Finish',
      description: 'Wenn der Ruecken nicht frei wird, klappst du auf die Triangle-Linie um.',
      outcome: 'Haelt den Gegner zwischen Backtake und Submission gefangen.',
      focus: ['Knie ueber Schulter bringen', 'Winkel halten'],
      mistakes: ['Flach bleiben', 'Zu spaet das Bein schwingen'],
      state: 'locked',
      expansionPaths: [['triangle-finish']],
    },
    'mounted-guillotine': {
      id: 'mounted-guillotine',
      title: 'Mounted Guillotine',
      stage: 'submission',
      label: 'Submission',
      description: 'Kontrollierter Abschluss aus der Front-Headlock-Linie.',
      outcome: 'Direkter Finish, wenn der Kopf vorne bleibt.',
      focus: ['Brust schwer machen', 'Wristline fixieren'],
      mistakes: ['Zu frueh fallen', 'Kein Druck ueber den ganzen Koerper'],
      state: 'locked',
    },
    'single-leg-finish': {
      id: 'single-leg-finish',
      title: 'Single Leg Finish',
      stage: 'pass',
      label: 'Top Entry',
      description: 'Finish des Wrestle-Up-Zweigs.',
      outcome: 'Top-Position als alternativer Abschluss.',
      focus: ['Ecke laufen', 'Kopf innen halten'],
      mistakes: ['Stehen bleiben', 'Kein Winkel beim Finish'],
      state: 'available',
    },
    'seatbelt-control': {
      id: 'seatbelt-control',
      title: 'Seatbelt Control',
      stage: 'position',
      label: 'Kontrolle',
      description: 'Sichert den Ruecken vor dem eigentlichen Finish.',
      outcome: 'Macht den Finish-Druck belastbar.',
      focus: ['Brustkontakt', 'Handlinie sichern'],
      mistakes: ['Haken vor Seatbelt', 'Zu flach am Ruecken'],
      state: 'completed',
    },
    'rear-naked-choke': {
      id: 'rear-naked-choke',
      title: 'Rear Naked Choke',
      stage: 'submission',
      label: 'Submission',
      description: 'Klassischer Abschluss aus stabiler Rueckenkontrolle.',
      outcome: 'High-value Finish des A-Plans.',
      focus: ['Kinnlinie lesen', 'Ellbogen nach hinten ziehen'],
      mistakes: ['Zu viel squeeze ohne Position', 'Schulter nicht hinter dem Kopf'],
      state: 'locked',
      sourceNodeId: 'node-9-rnc-finish',
    },
    'back-crucifix': {
      id: 'back-crucifix',
      title: 'Back Crucifix',
      stage: 'submission',
      label: 'Alternative Finish',
      description: 'Wechsel auf eine kontrollierte Arm-Isolation vom Ruecken.',
      outcome: 'Alternative Endroute, wenn der Choke blockiert wird.',
      focus: ['Arm einklemmen', 'Huefte dicht halten'],
      mistakes: ['Zu locker am Oberkoerper', 'Winkel verlieren'],
      state: 'locked',
    },
    'triangle-finish': {
      id: 'triangle-finish',
      title: 'Triangle Finish',
      stage: 'submission',
      label: 'Submission',
      description: 'Sauberer Abschluss, wenn der Gegner den Rueckenweg blockiert.',
      outcome: 'Dritte vernuenftige Endroute aus derselben Guard-Struktur.',
      focus: ['Winkel schliessen', 'Knie zusammenziehen'],
      mistakes: ['Zu frontal bleiben', 'Kein Zug am Kopf'],
      state: 'locked',
    },
  },
  layout: {
    width: 1680,
    height: 1180,
    nodes: [
      { id: 'rear-naked-choke', tier: 0, lane: 1, size: 'main' },
      { id: 'backtake', tier: 1, lane: 1, size: 'main' },
      { id: 'closed-guard', tier: 2, lane: 1, size: 'main' },
      { id: 'stand-up', tier: 3, lane: 1, size: 'main' },
      { id: 'off-balance', tier: 2, lane: 3, size: 'branch' },
      { id: 'hip-bump-sweep', tier: 1, lane: 3, size: 'branch' },
      { id: 'guillotine', tier: 1, lane: 4, size: 'branch' },
      { id: 'backtake-from-closed-guard', tier: 2, lane: 4, size: 'branch' },
      { id: 'kuzushi-details', tier: 2, lane: 5, size: 'future' },
      { id: 'front-headlock', tier: 2, lane: 6, size: 'future' },
      { id: 'mounted-guillotine', tier: 3, lane: 6, size: 'future' },
      { id: 'wrestle-up', tier: 3, lane: 3, size: 'future' },
      { id: 'single-leg-finish', tier: 4, lane: 3, size: 'future' },
      { id: 'seatbelt-control', tier: 3, lane: 2, size: 'future' },
      { id: 'back-crucifix', tier: 4, lane: 2, size: 'future' },
      { id: 'triangle-path', tier: 3, lane: 4, size: 'future' },
      { id: 'triangle-finish', tier: 4, lane: 4, size: 'future' },
    ],
    edges: [
      { from: 'rear-naked-choke', to: 'backtake' },
      { from: 'backtake', to: 'closed-guard' },
      { from: 'closed-guard', to: 'stand-up' },
      { from: 'closed-guard', to: 'off-balance' },
      { from: 'closed-guard', to: 'hip-bump-sweep' },
      { from: 'closed-guard', to: 'guillotine' },
      { from: 'closed-guard', to: 'backtake-from-closed-guard' },
      { from: 'hip-bump-sweep', to: 'kuzushi-details' },
      { from: 'guillotine', to: 'front-headlock' },
      { from: 'front-headlock', to: 'mounted-guillotine' },
      { from: 'off-balance', to: 'wrestle-up' },
      { from: 'wrestle-up', to: 'single-leg-finish' },
      { from: 'backtake', to: 'seatbelt-control' },
      { from: 'seatbelt-control', to: 'back-crucifix' },
      { from: 'backtake-from-closed-guard', to: 'triangle-path' },
      { from: 'triangle-path', to: 'triangle-finish' },
    ],
  },
}

const TECHNICAL_FALLBACK_PLAN: Omit<ResolvedGameplan, 'source' | 'unlockSummary'> = {
  id: 'fallback-a-plan-technical',
  slug: 'fallback-a-plan-technical',
  title: 'A-Plan',
  headline: 'Long Technical Guard Player',
  status: 'published',
  creatorName: 'Flexible Guard',
  creatorRole: 'A-Plan fuer deinen Archetyp',
  creatorInitials: 'FG',
  creatorProfileHref: '/profile',
  mainPath: ['leg-entry', 'leg-control', 'leg-isolation', 'knee-submission'],
  nodes: {
    'leg-entry': {
      id: 'leg-entry',
      title: 'Leg Entry',
      stage: 'position',
      label: 'Shin to Shin Entry',
      description: 'Du ziehst sauber in Shin to Shin oder direkt in den Guard Pull zum Bein-Einstieg.',
      outcome: 'Bringt dich strukturiert an das Bein und startet deinen Leg-Flow.',
      focus: ['Guard Pull mit Verbindung', 'Shin to Shin sauber treffen', 'Kopf und Hips direkt ausrichten'],
      mistakes: ['Ohne Verbindung fallen', 'Zu weit weg vom Bein landen', 'Kein Winkel nach dem Pull'],
      state: 'completed',
      sourceNodeId: 'node-1-guard-identity',
      expansionPaths: [
        ['leg-control', 'leg-isolation', 'knee-submission'],
        ['shin-to-shin-kuzushi', 'leg-control', 'finish-details'],
        ['wrestle-up', 'single-leg-finish'],
      ],
    },
    'leg-control': {
      id: 'leg-control',
      title: 'Leg Control',
      stage: 'position',
      label: 'Ashi Garami / Single Leg X',
      description: 'Hier stellst du Ashi Garami oder Single Leg X sauber her und fixierst das Bein.',
      outcome: 'Gibt dir Kontrolle, bevor du das Bein wirklich isolierst.',
      focus: ['Knie eng um die Huefte', 'Ferse kontrollieren', 'Gegner auf ein Bein setzen'],
      mistakes: ['Fuesse offen lassen', 'Zu lose um die Huefte sein', 'Keine Kontrolle ueber die Ferse'],
      state: 'completed',
      sourceNodeId: 'node-2-guard-entry',
      expansionPaths: [
        ['leg-isolation', 'knee-submission'],
        ['ankle-switch', 'finish-details'],
      ],
    },
    'leg-isolation': {
      id: 'leg-isolation',
      title: 'Leg Isolation',
      stage: 'pass',
      label: 'Off-Balance ins Finish',
      description: 'Du brichst die Balance, bringst das Knie aus der sicheren Linie und isolierst den Fuss.',
      outcome: 'Macht dein Straight Foot Lock erst wirklich erreichbar.',
      focus: ['Knie ausrichten', 'Off-Balance in die richtige Richtung', 'Fusslinie isolieren'],
      mistakes: ['Nur am Fuss ziehen', 'Keine Gewichtsverlagerung erzwingen', 'Zu frueh ins Finish gehen'],
      state: 'current',
      sourceNodeId: 'node-3-dlr-connection',
      expansionPaths: [['knee-submission'], ['wrestle-up', 'single-leg-finish']],
    },
    'knee-submission': {
      id: 'knee-submission',
      title: 'Knee Submission',
      stage: 'submission',
      label: 'Straight Foot Lock',
      description: 'Aus der isolierten Beinlinie schliesst du den Straight Foot Lock sauber ab.',
      outcome: 'Ein klares Finish aus deinem Haupt-Leg-Flow.',
      focus: ['Ellbogen eng', 'Fersenlinie fixieren', 'Hips sauber unter den Fuss bringen'],
      mistakes: ['Zu viel mit Armen ziehen', 'Knie-Linie nicht kontrollieren', 'Zu frueh aufmachen'],
      state: 'available',
      sourceNodeId: 'node-4-dlr-retention',
      expansionPaths: [['finish-details']],
    },
    'shin-to-shin-kuzushi': {
      id: 'shin-to-shin-kuzushi',
      title: 'Shin to Shin Kuzushi',
      stage: 'position',
      label: 'Alternative Route',
      description: 'Mehr Zug und Winkel direkt aus Shin to Shin, bevor du in Ashi gehst.',
      outcome: 'Hilft dir, den Einstieg leichter gegen stehende Gegner aufzubauen.',
      focus: ['Zug aufs Knie', 'Gegnerbein leicht machen'],
      mistakes: ['Zu statisch bleiben', 'Keine Schulterlinie erzeugen'],
      state: 'available',
      expansionPaths: [['leg-control', 'leg-isolation']],
    },
    'ankle-switch': {
      id: 'ankle-switch',
      title: 'Ankle Switch',
      stage: 'pass',
      label: 'Grip-Wechsel',
      description: 'Grip- und Fusswechsel, wenn die erste Straight-Foot-Lock-Linie nicht sauber sitzt.',
      outcome: 'Haelt deine Beinangriffe lebendig statt zu stagnieren.',
      focus: ['Grip wechseln ohne Raum zu geben', 'Knie-Linie behalten'],
      mistakes: ['Loslassen bevor der neue Grip sitzt', 'Hips zu weit weg'],
      state: 'completed',
      expansionPaths: [['finish-details']],
    },
    'finish-details': {
      id: 'finish-details',
      title: 'Finish Details',
      stage: 'submission',
      label: 'Feinabstimmung',
      description: 'Feine Anpassungen fuer Griff, Winkel und Spannung am Fuss.',
      outcome: 'Erhoeht deine Abschlussquote in Live-Rolls.',
      focus: ['Unterarm sauber platzieren', 'Ferse auf Linie halten'],
      mistakes: ['Falscher Handwinkel', 'Druck zu spaet setzen'],
      state: 'locked',
      sourceNodeId: 'node-5-dlr-off-balance',
    },
    'wrestle-up': {
      id: 'wrestle-up',
      title: 'Wrestle Up',
      stage: 'pass',
      label: 'Alternative Pass',
      description: 'Wenn der Gegner zu weit entlastet, kommst du nach oben.',
      outcome: 'Bricht die Linie und fuehrt in Takedown-Finish.',
      focus: ['Hand am Boden nutzen', 'Kopf ueber Knie bringen'],
      mistakes: ['Zu spaet aufstehen', 'Ruecken rund lassen'],
      state: 'available',
      expansionPaths: [['single-leg-finish']],
    },
    'single-leg-finish': {
      id: 'single-leg-finish',
      title: 'Single Leg Finish',
      stage: 'pass',
      label: 'Top Entry',
      description: 'Finish des Wrestle-Up-Zweigs.',
      outcome: 'Top-Position als alternativer Abschluss.',
      focus: ['Ecke laufen', 'Kopf innen halten'],
      mistakes: ['Stehen bleiben', 'Kein Winkel beim Finish'],
      state: 'available',
    },
  },
  layout: {
    width: 1360,
    height: 620,
    nodes: [
      { id: 'leg-entry', tier: 0, lane: 1, size: 'main' },
      { id: 'leg-control', tier: 1, lane: 1, size: 'main' },
      { id: 'leg-isolation', tier: 2, lane: 1, size: 'main' },
      { id: 'knee-submission', tier: 3, lane: 1, size: 'main' },
      { id: 'shin-to-shin-kuzushi', tier: 1, lane: 3, size: 'branch' },
      { id: 'ankle-switch', tier: 2, lane: 3, size: 'branch' },
      { id: 'wrestle-up', tier: 2, lane: 4, size: 'branch' },
      { id: 'finish-details', tier: 3, lane: 3, size: 'future' },
      { id: 'single-leg-finish', tier: 3, lane: 4, size: 'future' },
    ],
    edges: [
      { from: 'leg-entry', to: 'leg-control' },
      { from: 'leg-control', to: 'leg-isolation' },
      { from: 'leg-isolation', to: 'knee-submission' },
      { from: 'leg-entry', to: 'shin-to-shin-kuzushi' },
      { from: 'leg-control', to: 'ankle-switch' },
      { from: 'leg-isolation', to: 'wrestle-up' },
      { from: 'ankle-switch', to: 'finish-details' },
      { from: 'wrestle-up', to: 'single-leg-finish' },
    ],
  },
}

export function getFallbackGameplan(archetypeId?: string | null): ResolvedGameplan {
  return withResolvedStates({
    id: 'empty-fallback-plan',
    slug: 'empty-fallback-plan',
    title: 'Game Plan',
    headline: archetypeId ? 'Noch keine Techniken freigeschaltet' : 'Noch kein aktiver Game Plan',
    status: 'published',
    creatorName: 'BJJMAXXING',
    creatorRole: 'Custom Plan',
    creatorInitials: 'BM',
    creatorProfileHref: '/profile',
    mainPath: [],
    nodes: {},
    layout: {
      width: 1600,
      height: 900,
      nodes: [],
      edges: [],
    },
    source: 'fallback',
  }, [])
}
