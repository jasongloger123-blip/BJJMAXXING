import type { ResolvedGameplan } from '@/lib/gameplans'
import { getNodeById } from '@/lib/nodes'

export type ClipResult = 'relevant' | 'not_yet' | 'known' | 'later' | 'irrelevant'

export type QueueEvent = {
  node_id: string
  clip_key: string
  clip_type: string
  result: ClipResult
  created_at: string
}

export type QueueCard = {
  id: string
  nodeId: string
  type: 'main' | 'fix' | 'review'
  badge: string
  title: string
  principle: string
  drill: string
  sparringGoal: string
  clipTitle: string
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
}

function getClipSource(url: string): QueueCard['clipSource'] {
  if (url.includes('instagram.com')) {
    return 'instagram'
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube'
  }

  return 'external'
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
    badge,
    title: type === 'fix' ? `Fix: ${planNode.title}` : planNode.title,
    principle:
      type === 'fix'
        ? `Arbeite heute gezielt an den typischen Fehlern in ${planNode.title}.`
        : planNode.outcome || planNode.description || `${planNode.title} sauber in deinen Plan integrieren.`,
    drill: planNode.description || 'Diese Technik als naechsten Schritt im Gameplan aufbauen.',
    sparringGoal: planNode.outcome || `Suche ${planNode.title} bewusst in deinen Runden.`,
    clipTitle: planNode.title,
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
  }
}

export function buildStartQueue(completedIds: string[], events: QueueEvent[], plan?: ResolvedGameplan | null) {
  if (!plan) {
    return []
  }

  const mappedActivePlanNode = plan.unlockSummary.currentNodeId ? plan.nodes[plan.unlockSummary.currentNodeId] : null
  const mappedCurrentNode = mappedActivePlanNode ? getNodeById(mappedActivePlanNode.sourceNodeId ?? mappedActivePlanNode.id) : null
  const planPathNodes = plan.mainPath
    .map((nodeId) => plan.nodes[nodeId])
    .filter((node): node is NonNullable<typeof node> => Boolean(node))
  const mappedPlanNodes = plan
    ? planPathNodes
        .map((node) => getNodeById(node.sourceNodeId ?? node.id))
        .filter((node): node is NonNullable<typeof node> => Boolean(node))
    : []

  if (!mappedActivePlanNode && planPathNodes.length === 0) {
    return []
  }

  const validationPending = Boolean(
    plan.unlockSummary.validationPendingNodeId &&
    plan.unlockSummary.currentSourceNodeId === (mappedCurrentNode?.id ?? mappedActivePlanNode?.sourceNodeId ?? mappedActivePlanNode?.id)
  )

  if (!mappedCurrentNode || mappedPlanNodes.length === 0) {
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

  const planNodes = mappedPlanNodes
  const currentNode = mappedCurrentNode
  const reviewAnchorNode =
    [...planNodes].reverse().find((node) => completedIds.includes(node.id)) ?? planNodes[planNodes.length - 1]
  const activeNode = currentNode ?? reviewAnchorNode

  if (!activeNode) {
    return []
  }

  const previousNode = [...planNodes]
    .reverse()
    .find((node) => completedIds.includes(node.id) && node.id !== activeNode.id)

  const latestNodeEvent = events.find((event) => event.node_id === activeNode.id)
  const latestFailedEvent = events.find(
    (event) => event.node_id === activeNode.id && (event.result === 'not_yet' || event.result === 'irrelevant')
  )
  const mainClipUrl = activeNode.videos[0]?.url ?? ''
  const fixClipUrl = activeNode.videos[1]?.url ?? activeNode.videos[0]?.url ?? ''

  const cards: QueueCard[] = [
    {
      id: `${activeNode.id}-main`,
      nodeId: activeNode.id,
      type: 'main',
      badge: validationPending ? 'Heute - Validierung' : currentNode ? 'Heute - Pflicht' : 'Heute - Review',
      title: activeNode.title,
      principle: activeNode.why,
      drill: activeNode.drill,
      sparringGoal: activeNode.sparringFocus,
      clipTitle: activeNode.videos[0]?.title ?? activeNode.title,
      clipUrl: mainClipUrl,
      clipSource: getClipSource(mainClipUrl),
      clipWindow: '',
      categoryTag: getPhaseCategory(activeNode.title),
      levelTag: validationPending ? 'Validierung' : currentNode ? 'Anfaenger' : 'Review',
      description: activeNode.why,
      keyPoints:
        activeNode.id === 'node-1-guard-identity'
          ? [
              {
                label: 'Zielposition',
                items: ['Shin-to-Shin (Schienbein auf Schienbein) + Brustdruck aufs Knie'],
              },
              {
                label: 'Entry',
                items: ['Bewegungsmuster lesen -> unbelastetes Bein angreifen'],
              },
              {
                label: 'Sofort setzen',
                items: ['Hook sofort setzen', 'Ellenbogen eng -> Distanz killen'],
              },
              {
                label: 'Knie-Regel',
                items: ['Knie immer auf gleicher Brustseite wie Arm, sonst Pass-Gefahr'],
              },
              {
                label: 'Kontrolle',
                items: [
                  'Hook nie verlieren',
                  'Gegnerbein aktiv wegdruecken -> Gewicht verlagern',
                  'Immer eng bleiben, sonst Backstep oder Escape',
                ],
              },
              {
                label: 'Haupt-Hub',
                items: [
                  'Ashigarami',
                  'Knie vor Huefte bringen',
                  'Huefte hoch, Ferse auf Huefte',
                  'Knie schuetzt Position und stabilisiert',
                ],
              },
              {
                label: 'Option 1',
                items: ['Sweep', 'Knie manipulieren oder beide Beine kontrollieren', 'Direkt aufstehen und passen'],
              },
              {
                label: 'Option 2',
                items: ['Footlock', 'Aus Ashigarami ohne Positionswechsel', 'Ellenbogen nach hinten, Lat + Schulter fuers Finish'],
              },
              {
                label: 'Option 3',
                items: ['Backtake', 'Wenn Gegner Gewicht tief haelt', 'Hook wechseln -> in Turtle zwingen -> Ruecken nehmen'],
              },
              {
                label: 'Kernprinzip',
                items: ['Entry -> Shin-to-Shin -> Ashigarami -> Entscheidung: Sweep / Submission / Back'],
              },
            ]
          : [],
      comments: [],
      helperText: currentNode
        ? validationPending
          ? 'Dein aktueller Schritt ist inhaltlich fertig, jetzt fehlt noch die Validierung fuer den naechsten Unlock.'
          : 'Die App zeigt dir genau das naechste Reel fuer deinen aktuellen Fokus.'
        : 'Dein A-Plan ist durch. Jetzt bleibt dein Feed im Wiederholungs- und Vertiefungsmodus aktiv.',
    },
  ]

  cards.push({
    id: `${activeNode.id}-fix`,
    nodeId: activeNode.id,
    type: 'fix',
    badge: currentNode ? 'Fehler-Fix' : 'Variation',
    title: latestFailedEvent ? `Fix: ${activeNode.title}` : `Fix: ${activeNode.commonErrors[0] ?? activeNode.title}`,
    principle: latestFailedEvent
      ? 'Du korrigierst sofort den letzten Fehler, statt neue Techniken zu sammeln.'
      : 'Ein kurzer Fix-Clip fuer den haeufigsten Fehler in diesem Node.',
    drill: activeNode.drill,
    sparringGoal: `Achte heute besonders auf: ${activeNode.commonErrors[0] ?? activeNode.subtitle}`,
    clipTitle: activeNode.videos[1]?.title ?? activeNode.videos[0]?.title ?? activeNode.title,
    clipUrl: fixClipUrl,
    clipSource: getClipSource(fixClipUrl),
      clipWindow: '',
    categoryTag: getPhaseCategory(activeNode.title),
    levelTag: currentNode ? 'Fix' : 'Variation',
    description: latestFailedEvent
      ? 'Direkter Korrektur-Clip fuer deinen letzten Fehler.'
      : 'Vorbeugender Fehler-Clip fuer den haeufigsten Breakdown in diesem Node.',
    keyPoints: [],
    comments: [],
    helperText: latestNodeEvent ? `Letzte Einordnung: ${latestNodeEvent.result}` : 'Noch kein Fix noetig gewesen.',
  })

  if (previousNode) {
    const reviewClipUrl = previousNode.videos[0]?.url ?? ''
    cards.push({
      id: `${previousNode.id}-review`,
      nodeId: previousNode.id,
      type: 'review',
      badge: 'Review',
      title: previousNode.title,
      principle: 'Kurze Reaktivierung, damit dein Gameplan stabil bleibt.',
      drill: previousNode.drill,
      sparringGoal: previousNode.sparringFocus,
      clipTitle: previousNode.videos[0]?.title ?? previousNode.title,
      clipUrl: reviewClipUrl,
      clipSource: getClipSource(reviewClipUrl),
      clipWindow: '',
      categoryTag: getPhaseCategory(previousNode.title),
      levelTag: 'Review',
      description: 'Kurze Wiederholung aus deinem bereits gelernten Path, damit nichts wieder wegbricht.',
      keyPoints: [],
      comments: [],
      helperText: 'Wiederholung aus deinem bereits aufgebauten Lernuniversum.',
    })
  }

  return cards.slice(0, 3)
}
