export type ClipProgressValue = {
  completed: number
  total: number
  percent: number
}

export type ClipProgressNode = {
  id: string
  title: string
  sourceNodeId?: string | null
}

export type ClipProgressPlan = {
  nodes: Record<string, ClipProgressNode>
}

export type ClipProgressTechnique = {
  id: string
  title: string
}

export type ClipProgressEvent = {
  node_id: string
  clip_key: string
}

export type ClipProgressStatus = {
  node_id: string
  clip_key: string
  clip_id?: string | null
  can_count?: number | null
  cannot_count?: number | null
  last_result?: string | null
}

export type ClipProgressRef = {
  id?: string | null
  url: string
}

export function getClipProgressLookupIds(
  node: ClipProgressNode,
  plans: ClipProgressPlan[],
  customTechniques: ClipProgressTechnique[] = []
) {
  const sourceNodeId = node.sourceNodeId ?? node.id
  const lookupIds = new Set<string>([sourceNodeId, node.id])
  const matchingTitle = node.title.trim().toLowerCase()

  plans.forEach((plan) => {
    Object.values(plan.nodes ?? {}).forEach((candidate) => {
      if (candidate.title.trim().toLowerCase() !== matchingTitle) return
      lookupIds.add(candidate.id)
      if (candidate.sourceNodeId) lookupIds.add(candidate.sourceNodeId)
    })
  })

  customTechniques.forEach((technique) => {
    if (technique.title.trim().toLowerCase() === matchingTitle) {
      lookupIds.add(technique.id)
    }
  })

  return Array.from(lookupIds)
}

export function calculateClipProgressForNode({
  node,
  lookupIds,
  clipRefs,
  knownEvents,
  statuses,
}: {
  node: ClipProgressNode
  lookupIds: string[]
  clipRefs: ClipProgressRef[]
  knownEvents: ClipProgressEvent[]
  statuses: ClipProgressStatus[]
}): ClipProgressValue | null {
  const sourceNodeId = node.sourceNodeId ?? node.id
  const normalizedLookupIds = Array.from(new Set([sourceNodeId, node.id, ...lookupIds]))
  const seenStatuses = statuses.filter(
    (status) =>
      status.last_result === 'known' ||
      status.last_result === 'not_yet' ||
      (status.can_count ?? 0) > 0 ||
      (status.cannot_count ?? 0) > 0
  )
  const knownStatuses = seenStatuses.filter((status) => status.last_result === 'known' || (status.can_count ?? 0) > 0)
  const knownEventKeys = new Set(knownEvents.map((event) => `${event.node_id}:${event.clip_key}`))
  const seenStatusKeys = new Set(seenStatuses.map((status) => `${status.node_id}:${status.clip_key}`))
  const seenStatusClipIds = new Set(
    seenStatuses
      .filter((status) => typeof status.clip_id === 'string' && status.clip_id.length > 0)
      .map((status) => `${status.node_id}:${status.clip_id}`)
  )
  const knownStatusKeys = new Set(knownStatuses.map((status) => `${status.node_id}:${status.clip_key}`))
  const knownStatusClipIds = new Set(
    knownStatuses
      .filter((status) => typeof status.clip_id === 'string' && status.clip_id.length > 0)
      .map((status) => `${status.node_id}:${status.clip_id}`)
  )

  const total = clipRefs.length
  if (total === 0) return null

  const exactCompleted = clipRefs.filter((clip, index) =>
    normalizedLookupIds.some((lookupId) => {
      const eventKey = `${lookupId}:${lookupId}-video-${index}`
      const hasKnownStatus =
        knownStatusKeys.has(eventKey) ||
        (clip.id ? knownStatusClipIds.has(`${lookupId}:${clip.id}`) : false)
      const hasAnyStatus =
        seenStatusKeys.has(eventKey) ||
        (clip.id ? seenStatusClipIds.has(`${lookupId}:${clip.id}`) : false)

      return hasKnownStatus || (!hasAnyStatus && knownEventKeys.has(eventKey))
    })
  ).length
  const legacyKnownKeys = new Set(
    knownEvents
      .filter((entry) => {
        const eventKey = `${entry.node_id}:${entry.clip_key}`
        return (
          !seenStatusKeys.has(eventKey) &&
          normalizedLookupIds.some((lookupId) => entry.node_id === lookupId || entry.clip_key.startsWith(`${lookupId}-`))
        )
      })
      .map((entry) => entry.clip_key)
  )
  knownStatuses
    .filter((entry) =>
      normalizedLookupIds.some((lookupId) => entry.node_id === lookupId || entry.clip_key.startsWith(`${lookupId}-`))
    )
    .forEach((entry) => legacyKnownKeys.add(entry.clip_key))

  const completed = Math.max(exactCompleted, Math.min(total, legacyKnownKeys.size))
  const clampedCompleted = Math.min(total, completed)

  return {
    completed: clampedCompleted,
    total,
    percent: Math.max(0, Math.min(100, Math.round((clampedCompleted / total) * 100))),
  }
}
