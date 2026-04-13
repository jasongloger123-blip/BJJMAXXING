import type { ResolvedGameplan } from '@/lib/gameplans'
import { getNodeById } from '@/lib/nodes'
import type { ExternalSourceRole } from '@/lib/external-technique-sources'
import { getTechniqueCatalogEntryForPlanNode } from '@/lib/technique-catalog'
import { getTechniqueNoteText } from '@/lib/custom-techniques'
import { normalizeClipContentType, normalizeClipLearningPhase, type ClipContentType, type ClipLearningPhase } from '@/lib/clip-taxonomy'

export type ClipResult = 'relevant' | 'not_yet' | 'known' | 'later' | 'irrelevant'

export type QueueEvent = {
  node_id: string
  clip_key: string
  clip_type: string
  result: ClipResult
  created_at: string
}

export type TrainingClipLearningStatus = 'NEW' | 'LEARNING' | 'UNSTABLE' | 'STABLE' | 'MASTERED'

export type TrainingClipStatus = {
  node_id: string
  clip_key: string
  clip_type: string
  clip_id?: string | null
  seen_count: number
  can_count: number
  cannot_count: number
  streak_can: number
  streak_cannot: number
  confidence_score: number
  last_result: ClipResult | null
  next_review_step: number
  last_seen_step: number
}

export type QueueScoreReason = {
  label: string
  value: number
  description: string
}

export type QueueCard = {
  id: string
  nodeId: string
  type: 'main' | 'fix' | 'review'
  videoKey: string
  videoKeys: string[]
  coreVideoKeys?: string[]
  clipId?: string | null
  videoIndex: number
  totalVideos: number
  badge: string
  title: string
  principle: string
  drill: string
  sparringGoal: string
  clipTitle: string
  clipDescription?: string | null
  clipHashtags?: string[]
  clipUrl: string
  clipSource: 'youtube' | 'instagram' | 'external'
  clipWindow: string
  categoryTag: string
  levelTag: string
  description: string
  keyPoints: {
    label: string
    items: string[]
  }[]
  comments: {
    author: string
    text: string
    meta: string
    avatarUrl?: string | null
  }[]
  helperText: string
  learningStatus?: TrainingClipLearningStatus
  confidenceScore?: number
  progressCreditEarned?: boolean
  isDue?: boolean
  isCore?: boolean
  nextReviewStep?: number
  priorityScore?: number
  scoreReasons?: QueueScoreReason[]
  contentType?: ClipContentType
  learningPhase?: ClipLearningPhase
  targetArchetypeIds?: string[]
}

export type QueueClipCandidate = {
  id?: string
  title: string
  url: string
  role: ExternalSourceRole
  displayOrder?: number
  contentType?: ClipContentType | null
  learningPhase?: ClipLearningPhase | null
  targetArchetypeIds?: string[]
  description?: string | null
  hashtags?: string[]
}

export type QueueClipGroups = Record<ExternalSourceRole, QueueClipCandidate[]>

function getClipSource(url: string): QueueCard['clipSource'] {
  if (url.includes('instagram.com')) {
    return 'instagram'
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube'
  }

  return 'external'
}

export function createEmptyQueueClipGroups(): QueueClipGroups {
  return {
    main_reference: [],
    counter_reference: [],
    drill_reference: [],
    related_reference: [],
  }
}

function getPhaseCategory(title: string) {
  if (title.toLowerCase().includes('dlr')) {
    return 'DLR'
  }

  if (title.toLowerCase().includes('back')) {
    return 'Back'
  }

  if (title.toLowerCase().includes('guard')) {
    return 'Guard'
  }

  return 'A-Plan'
}

function createPlanFallbackCard(
  planNode: NonNullable<ResolvedGameplan['nodes'][string]>,
  type: QueueCard['type'],
  badge: string,
  helperText: string
): QueueCard {
  return {
    id: `${planNode.id}-${type}`,
    nodeId: planNode.sourceNodeId ?? planNode.id,
    type,
    videoKey: `${planNode.id}-${type}-video-0`,
    videoKeys: [`${planNode.id}-${type}-video-0`],
    coreVideoKeys: [`${planNode.id}-${type}-video-0`],
    clipId: null,
    contentType: 'technical_demo',
    learningPhase: 'core_mechanic',
    targetArchetypeIds: [],
    videoIndex: 0,
    totalVideos: 0,
    badge,
    title: type === 'fix' ? `Fix: ${planNode.title}` : planNode.title,
    principle:
      type === 'fix'
        ? `Arbeite heute gezielt an den typischen Fehlern in ${planNode.title}.`
        : planNode.outcome || planNode.description || `${planNode.title} sauber in deinen Plan integrieren.`,
    drill: planNode.description || 'Diese Technik als naechsten Schritt im Gameplan aufbauen.',
    sparringGoal: planNode.outcome || `Suche ${planNode.title} bewusst in deinen Runden.`,
    clipTitle: planNode.title,
    clipDescription: null,
    clipHashtags: [],
    clipUrl: '',
    clipSource: 'external',
    clipWindow: '',
    categoryTag: getPhaseCategory(planNode.title),
    levelTag: type === 'review' ? 'Review' : type === 'fix' ? 'Fix' : 'Gameplan',
    description: planNode.description || planNode.outcome || `${planNode.title} ist Teil deines aktuellen Gameplans.`,
    keyPoints: [
      {
        label: 'Gameplan',
        items: [planNode.label || planNode.title],
      },
      ...(planNode.focus?.length
        ? [
            {
              label: 'Fokus',
              items: planNode.focus,
            },
          ]
        : []),
    ],
    comments: [],
    helperText,
    learningStatus: 'NEW',
    confidenceScore: 0,
    progressCreditEarned: false,
    isDue: false,
    isCore: true,
    priorityScore: 0,
    scoreReasons: [],
  }
}

function normalizeClipCandidates(candidates: QueueClipCandidate[]) {
  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()

  return candidates.filter((candidate) => {
    if (!candidate.url) return false
    if (candidate.id && seenIds.has(candidate.id)) return false
    if (seenUrls.has(candidate.url)) return false
    if (candidate.id) {
      seenIds.add(candidate.id)
    }
    seenUrls.add(candidate.url)
    return true
  })
}

function flattenClipGroups(groups?: Partial<QueueClipGroups> | null) {
  if (!groups) return []

  const safeGroups: QueueClipGroups = {
    ...createEmptyQueueClipGroups(),
    ...groups,
  }

  return normalizeClipCandidates([
    ...safeGroups.main_reference,
    ...safeGroups.counter_reference,
    ...safeGroups.drill_reference,
    ...safeGroups.related_reference,
  ]).map((candidate, index) => ({ ...candidate, displayOrder: candidate.displayOrder ?? index }))
}

function isCoreRole(role?: ExternalSourceRole) {
  return role === 'main_reference'
}

function getLearningStatus(status?: TrainingClipStatus | null): TrainingClipLearningStatus {
  if (!status || status.seen_count === 0) return 'NEW'
  if (status.confidence_score < 30 || status.last_result === 'not_yet') return 'UNSTABLE'
  if (status.confidence_score < 60) return 'LEARNING'
  if (status.confidence_score < 85) return 'STABLE'
  return 'MASTERED'
}

function getStatusLookup(statuses?: TrainingClipStatus[]) {
  return new Map((statuses ?? []).map((status) => [status.clip_key, status]))
}

function buildQueueSourceFromPlanNode(
  planNode: NonNullable<ResolvedGameplan['nodes'][string]>,
  clipGroupsByNodeId?: Record<string, Partial<QueueClipGroups> | undefined>
) {
  const techniqueEntry = getTechniqueCatalogEntryForPlanNode(planNode)
  const mappedNode = getNodeById(planNode.sourceNodeId ?? planNode.id)
  const why = techniqueEntry?.description ?? mappedNode?.why ?? planNode.outcome ?? planNode.description
  const drill =
    techniqueEntry?.drills[0]?.description ??
    mappedNode?.drill ??
    planNode.description ??
    'Diese Technik als naechsten Schritt im Gameplan aufbauen.'
  const sparringFocus =
    (techniqueEntry?.keyPoints[0] ? getTechniqueNoteText(techniqueEntry.keyPoints[0]) : undefined) ??
    mappedNode?.sparringFocus ??
    planNode.outcome ??
    `Suche ${planNode.title} bewusst in deinen Runden.`
  const sourceNodeId = planNode.sourceNodeId ?? planNode.id
  const assignedVideos = flattenClipGroups(clipGroupsByNodeId?.[sourceNodeId]).map((clip) => ({
    clipId: clip.id ?? null,
    title: clip.title,
    description: clip.description ?? null,
    hashtags: clip.hashtags ?? [],
    url: clip.url,
    creator: clip.role,
    role: clip.role,
    displayOrder: clip.displayOrder ?? 0,
    contentType: normalizeClipContentType(clip.contentType),
    learningPhase: normalizeClipLearningPhase(clip.learningPhase),
    targetArchetypeIds: clip.targetArchetypeIds ?? [],
  }))

  return {
    id: sourceNodeId,
    title: planNode.title,
    why,
    drill,
    sparringFocus,
    videos:
      assignedVideos.length > 0
        ? assignedVideos
        : techniqueEntry?.videos.map((video) => ({
            title: video.title,
            description: null,
            hashtags: [],
            url: video.url,
            creator: video.platform,
            role: 'main_reference' as const,
            clipId: null,
            displayOrder: 0,
            contentType: normalizeClipContentType(video.contentType),
            learningPhase: normalizeClipLearningPhase(video.learningPhase),
            targetArchetypeIds: video.targetArchetypeIds ?? [],
          })) ??
          mappedNode?.videos.map((video, index) => ({
            ...video,
            description: null,
            hashtags: [],
            role: 'main_reference' as const,
            clipId: null,
            displayOrder: index,
            contentType: 'technical_demo' as const,
            learningPhase: index === 0 ? 'overview' as const : 'core_mechanic' as const,
            targetArchetypeIds: [],
          })) ??
          [],
    commonErrors:
      techniqueEntry?.commonErrors.length
        ? techniqueEntry.commonErrors.map((item) => getTechniqueNoteText(item))
        : mappedNode?.commonErrors ?? [],
    subtitle: planNode.label || techniqueEntry?.subtitle || mappedNode?.subtitle,
  }
}

function buildVideoKey(nodeId: string, index: number) {
  return `${nodeId}-video-${index}`
}

function getOrderedVideosForNode(
  nodeId: string,
  videos: { title: string; url: string; creator: string; role?: ExternalSourceRole; clipId?: string | null; displayOrder?: number; contentType?: ClipContentType; learningPhase?: ClipLearningPhase; targetArchetypeIds?: string[]; description?: string | null; hashtags?: string[] }[],
  events: QueueEvent[],
  statuses?: TrainingClipStatus[]
) {
  if (!videos.length) return []

  const videosWithKeys = videos.map((video, index) => ({
    ...video,
    index,
    key: buildVideoKey(nodeId, index),
    role: video.role ?? ('main_reference' as ExternalSourceRole),
    displayOrder: video.displayOrder ?? index,
    contentType: normalizeClipContentType(video.contentType),
    learningPhase: normalizeClipLearningPhase(video.learningPhase, index === 0 ? 'overview' : 'core_mechanic'),
    targetArchetypeIds: video.targetArchetypeIds ?? [],
  }))
  const statusByKey = getStatusLookup(statuses)
  const currentStep = events.length
  const latestRelevantEvent = events.find((event) => event.node_id === nodeId)
  const latestMiss = events.find((event) => event.node_id === nodeId && event.result === 'not_yet')
  const nextSequentialCore = videosWithKeys.find((video) => isCoreRole(video.role) && !statusByKey.get(video.key)?.seen_count)
  const hasSeenBasicCore = videosWithKeys.some((video) => {
    const status = statusByKey.get(video.key)
    return isCoreRole(video.role) && status && status.seen_count > 0 && (video.learningPhase === 'overview' || video.learningPhase === 'core_mechanic')
  })
  const hasAlternative = videosWithKeys.length > 1

  const scoredVideos = videosWithKeys.map((video) => {
    const status = statusByKey.get(video.key)
    const learningStatus = getLearningStatus(status)
    const isDue = Boolean(status && status.next_review_step <= currentStep)
    const wasShownVeryRecently = hasAlternative && latestRelevantEvent?.clip_key === video.key
    const isSupportAfterMiss =
      latestMiss &&
      latestMiss.clip_key !== video.key &&
      (video.role === 'drill_reference' || video.role === 'counter_reference')
    const scoreReasons: QueueScoreReason[] = []

    if (status?.last_result === 'not_yet') {
      scoreReasons.push({ label: 'Schwaeche', value: 100, description: 'Zuletzt mit Kann ich nicht bewertet.' })
    }
    if (isSupportAfterMiss) {
      scoreReasons.push({ label: 'Hilfsclip', value: 90, description: 'Nach einem Fehlschlag kommt zuerst ein Drill oder Counter.' })
    }
    if (isDue) {
      scoreReasons.push({ label: 'Review faellig', value: 70, description: 'next_review_step ist erreicht.' })
    }
    if (!status || status.seen_count === 0) {
      scoreReasons.push({ label: 'Neu', value: 40, description: 'Dieser Clip wurde noch nicht gesehen.' })
    }
    if (isCoreRole(video.role)) {
      scoreReasons.push({ label: 'Core', value: 25, description: 'main_reference zaehlt als Core-Video.' })
    }
    if ((video.learningPhase === 'overview' || video.learningPhase === 'core_mechanic') && (!status || status.seen_count === 0)) {
      scoreReasons.push({ label: 'Basics zuerst', value: 45, description: 'Overview/Core Mechanic kommt vor tiefem Material.' })
    }
    if ((video.contentType === 'sparring_footage' || video.contentType === 'competition_footage') && !hasSeenBasicCore) {
      scoreReasons.push({ label: 'Footage spaeter', value: -60, description: 'Live- oder Kampfmaterial kommt erst nach den Basics.' })
    }
    if (video.learningPhase === 'advanced' && !hasSeenBasicCore) {
      scoreReasons.push({ label: 'Advanced spaeter', value: -40, description: 'Advanced Clips werden vor den Basics gebremst.' })
    }
    if (nextSequentialCore?.key === video.key) {
      scoreReasons.push({ label: 'Naechster Core', value: 30, description: 'Naechstes ungesehenes Core-Video in didaktischer Reihenfolge.' })
    }
    if (wasShownVeryRecently) {
      scoreReasons.push({ label: 'Anti-Nerv-Gap', value: -80, description: 'Der Clip wurde gerade eben gezeigt.' })
    }
    if (learningStatus === 'MASTERED') {
      scoreReasons.push({ label: 'Mastered', value: -50, description: 'Stabile Clips werden nach hinten geschoben.' })
    }

    return {
      ...video,
      priorityScore: scoreReasons.reduce((total, reason) => total + reason.value, 0),
      scoreReasons,
    }
  })

  return scoredVideos.sort((a, b) => {
    const diff = b.priorityScore - a.priorityScore
    if (diff !== 0) return diff
    return a.displayOrder - b.displayOrder
  })
}

export function buildStartQueue(
  completedIds: string[],
  events: QueueEvent[],
  plan?: ResolvedGameplan | null,
  clipGroupsByNodeId?: Record<string, Partial<QueueClipGroups> | undefined>,
  statuses?: TrainingClipStatus[]
): QueueCard[] {
  if (!plan) {
    return []
  }

  const mappedActivePlanNode = plan.unlockSummary.currentNodeId ? plan.nodes[plan.unlockSummary.currentNodeId] : null
  const currentTechniqueSource = mappedActivePlanNode ? buildQueueSourceFromPlanNode(mappedActivePlanNode, clipGroupsByNodeId) : null
  const planPathNodes = plan.mainPath
    .map((nodeId) => plan.nodes[nodeId])
    .filter((node): node is NonNullable<typeof node> => Boolean(node))
  const mappedPlanNodes = planPathNodes.map((node) => ({ planNode: node, source: buildQueueSourceFromPlanNode(node, clipGroupsByNodeId) }))

  if (!mappedActivePlanNode && planPathNodes.length === 0) {
    return []
  }

  const validationPending = Boolean(
    plan.unlockSummary.validationPendingNodeId &&
    plan.unlockSummary.currentSourceNodeId === (currentTechniqueSource?.id ?? mappedActivePlanNode?.sourceNodeId ?? mappedActivePlanNode?.id)
  )

  if (!currentTechniqueSource || mappedPlanNodes.length === 0) {
    const activePlanNode = mappedActivePlanNode ?? planPathNodes[0]
    if (!activePlanNode) {
      return []
    }

    const previousPlanNode =
      [...planPathNodes]
        .reverse()
        .find((node) => completedIds.includes(node.sourceNodeId ?? node.id) && (node.sourceNodeId ?? node.id) !== (activePlanNode.sourceNodeId ?? activePlanNode.id)) ?? null

    const cards: QueueCard[] = [
      createPlanFallbackCard(
        activePlanNode,
        'main',
        validationPending ? 'Heute - Validierung' : 'Heute - Pflicht',
        validationPending
          ? 'Dieser Schritt ist fast fertig. Es fehlt nur noch die Validierung fuer den naechsten Unlock.'
          : 'Diese Technik ist gerade dein naechster Schritt im aktiven Gameplan.'
      ),
      createPlanFallbackCard(
        activePlanNode,
        'fix',
        'Fehler-Fix',
        'Solange noch kein Startseiten-Clip hinterlegt ist, zeigt dir die App hier den gleichen Gameplan-Schritt als Fokuskarte.'
      ),
    ]

    if (previousPlanNode) {
      cards.push(
        createPlanFallbackCard(
          previousPlanNode,
          'review',
          'Review',
          'Wiederholung aus deinem bereits aufgebauten Gameplan.'
        )
      )
    }

    return cards.slice(0, 3)
  }

  if (!currentTechniqueSource || !mappedActivePlanNode) {
    return []
  }

  const activeNode = currentTechniqueSource
  const nodeStatuses = (statuses ?? []).filter((status) => status.node_id === activeNode.id)
  const statusByKey = getStatusLookup(nodeStatuses)
  const currentStep = events.length
  const orderedVideos = getOrderedVideosForNode(activeNode.id, activeNode.videos, events, nodeStatuses)
  const videoKeys = orderedVideos.map((video) => video.key)
  const coreVideoKeys = orderedVideos.filter((video) => isCoreRole(video.role)).map((video) => video.key)

  if (!orderedVideos.length) {
    return [
      createPlanFallbackCard(
        mappedActivePlanNode,
        'main',
        validationPending ? 'Heute - Validierung' : 'Heute - Pflicht',
        validationPending
          ? 'Dieser Schritt ist fast fertig. Es fehlt nur noch die Validierung fuer den naechsten Unlock.'
          : 'Diese Technik ist gerade dein naechster Schritt im aktiven Gameplan.'
      ),
    ]
  }

  const activeCards = orderedVideos.map((video, queueIndex): QueueCard => {
    const status = statusByKey.get(video.key)
    const learningStatus = getLearningStatus(status)
    const isDue = Boolean(status && status.next_review_step <= currentStep)
    const isCore = isCoreRole(video.role)
    const progressCreditEarned = Boolean(status && ((status.can_count ?? 0) > 0 || status.last_result === 'known'))

    return {
      id: video.key,
      nodeId: activeNode.id,
      type: 'main',
      videoKey: video.key,
      videoKeys,
      coreVideoKeys,
      clipId: video.clipId ?? null,
      contentType: video.contentType,
      learningPhase: video.learningPhase,
      targetArchetypeIds: video.targetArchetypeIds,
      videoIndex: video.index,
      totalVideos: orderedVideos.length,
      badge: status?.last_result === 'not_yet' ? 'Fehler-Fix' : isDue ? 'Review' : validationPending ? 'Heute - Validierung' : 'Heute - Pflicht',
      title: activeNode.title,
      principle: activeNode.why,
      drill: activeNode.drill,
      sparringGoal: activeNode.sparringFocus,
      clipTitle: video.title ?? activeNode.title,
      clipDescription: video.description ?? null,
      clipHashtags: video.hashtags ?? [],
      clipUrl: video.url ?? '',
      clipSource: getClipSource(video.url ?? ''),
      clipWindow: '',
      categoryTag: getPhaseCategory(activeNode.title),
      levelTag: learningStatus === 'NEW' ? 'Neu' : learningStatus === 'UNSTABLE' ? 'Fix' : isDue ? 'Review' : validationPending ? 'Validierung' : 'Gameplan',
      description: activeNode.why,
      keyPoints: queueIndex === 0 ? [{ label: 'Gameplan', items: [mappedActivePlanNode.label || mappedActivePlanNode.title] }] : [],
      comments: [],
      helperText:
        orderedVideos.length > 1
          ? `Video ${queueIndex + 1} von ${orderedVideos.length} fuer ${activeNode.title}.`
          : 'Die App zeigt dir genau das naechste Video fuer deinen aktuellen Fokus.',
      learningStatus,
      confidenceScore: status?.confidence_score ?? 0,
      progressCreditEarned,
      isDue,
      isCore,
      nextReviewStep: status?.next_review_step,
      priorityScore: video.priorityScore,
      scoreReasons: video.scoreReasons,
    }
  })

  const reviewCards = mappedPlanNodes
    .filter(({ planNode }) => {
      const sourceNodeId = planNode.sourceNodeId ?? planNode.id
      const activeSourceNodeId = mappedActivePlanNode.sourceNodeId ?? mappedActivePlanNode.id
      const isUnlockedPastNode =
        planNode.state === 'completed' ||
        plan.unlockSummary.unlockedNodeIds.includes(planNode.id) ||
        completedIds.includes(sourceNodeId)

      return sourceNodeId !== activeSourceNodeId && isUnlockedPastNode
    })
    .flatMap(({ planNode, source }): QueueCard[] => {
      const sourceNodeId = planNode.sourceNodeId ?? planNode.id
      const reviewNodeStatuses = (statuses ?? []).filter((status) => status.node_id === sourceNodeId)
      const reviewVideos = getOrderedVideosForNode(sourceNodeId, source.videos, events, reviewNodeStatuses)
      const reviewVideo = reviewVideos[0]

      if (!reviewVideo) {
        return [
          createPlanFallbackCard(
            planNode,
            'review',
            'Review',
            'Diese Technik bleibt in deinem aktiven Gameplan verfuegbar.'
          ),
        ]
      }

      const status = getStatusLookup(reviewNodeStatuses).get(reviewVideo.key)
      const learningStatus = getLearningStatus(status)
      const isDue = Boolean(status && status.next_review_step <= currentStep)
      const progressCreditEarned = Boolean(status && ((status.can_count ?? 0) > 0 || status.last_result === 'known'))

      return [
        {
          id: `${reviewVideo.key}-review`,
          nodeId: sourceNodeId,
          type: 'review',
          videoKey: reviewVideo.key,
          videoKeys: reviewVideos.map((video) => video.key),
          coreVideoKeys: reviewVideos.filter((video) => isCoreRole(video.role)).map((video) => video.key),
          clipId: reviewVideo.clipId ?? null,
          contentType: reviewVideo.contentType,
          learningPhase: reviewVideo.learningPhase,
          targetArchetypeIds: reviewVideo.targetArchetypeIds,
          videoIndex: reviewVideo.index,
          totalVideos: reviewVideos.length,
          badge: isDue ? 'Review faellig' : 'Review',
          title: source.title,
          principle: source.why,
          drill: source.drill,
          sparringGoal: source.sparringFocus,
          clipTitle: reviewVideo.title ?? source.title,
          clipDescription: reviewVideo.description ?? null,
          clipHashtags: reviewVideo.hashtags ?? [],
          clipUrl: reviewVideo.url ?? '',
          clipSource: getClipSource(reviewVideo.url ?? ''),
          clipWindow: '',
          categoryTag: getPhaseCategory(source.title),
          levelTag: isDue ? 'Review' : learningStatus === 'MASTERED' ? 'Mastered' : 'Aktiv',
          description: source.why,
          keyPoints: [{ label: 'Aktiv', items: [planNode.label || planNode.title] }],
          comments: [],
          helperText: 'Diese Technik bleibt aktiv und kann weiter wiederholt werden.',
          learningStatus,
          confidenceScore: status?.confidence_score ?? 0,
          progressCreditEarned,
          isDue,
          isCore: isCoreRole(reviewVideo.role),
          nextReviewStep: status?.next_review_step,
          priorityScore: reviewVideo.priorityScore,
          scoreReasons: reviewVideo.scoreReasons,
        },
      ]
    })

  return [...activeCards, ...reviewCards]
}
