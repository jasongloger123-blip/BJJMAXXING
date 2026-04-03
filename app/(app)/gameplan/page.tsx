'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle2, CirclePlay, Lock, Play, Settings2, Target } from 'lucide-react'
import { getCuratedClipsForNode } from '@/lib/curated-clips'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'
import { getPlanNodes } from '@/lib/nodes'

type StageKey = 'setup' | 'position' | 'transition' | 'finish'
type PlanId = 'a-plan' | 'b-plan' | 'c-plan'
type NodeState = 'completed' | 'current' | 'available' | 'locked'

type PlanNode = {
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
}

type PlanConfig = {
  id: PlanId
  title: string
  mainPath: string[]
  nodes: Record<string, PlanNode>
}

type TreeNodeMeta = {
  id: string
  tier: 0 | 1 | 2 | 3 | 4
  lane: 0 | 1 | 2 | 3 | 4 | 5
  size: 'main' | 'branch' | 'future'
}

type TreeEdge = {
  from: string
  to: string
}

const STAGE_ORDER: StageKey[] = ['setup', 'position', 'transition', 'finish']

const STAGE_META: Record<
  StageKey,
  {
    title: string
    pill: string
    border: string
    surface: string
    glow: string
    accent: string
    line: string
  }
> = {
  setup: {
    title: 'Setup',
    pill: 'text-[#f0b37a]',
    border: 'border-[#8d532c]/70',
    surface: 'from-[#241813] via-[#1c1714] to-[#171418]',
    glow: 'shadow-[0_0_0_1px_rgba(201,122,66,0.22),0_22px_52px_rgba(108,53,20,0.18)]',
    accent: 'bg-[#cf8648]',
    line: 'from-[#cf8648]/70 to-[#cf8648]/15',
  },
  position: {
    title: 'Position',
    pill: 'text-[#89afff]',
    border: 'border-[#3d5fa5]/70',
    surface: 'from-[#121d31] via-[#151b2a] to-[#131721]',
    glow: 'shadow-[0_0_0_1px_rgba(93,136,255,0.22),0_22px_52px_rgba(20,39,86,0.16)]',
    accent: 'bg-[#6b94ff]',
    line: 'from-[#6b94ff]/70 to-[#6b94ff]/15',
  },
  transition: {
    title: 'Transition',
    pill: 'text-[#c391ff]',
    border: 'border-[#70439a]/70',
    surface: 'from-[#21152f] via-[#1d1628] to-[#17151d]',
    glow: 'shadow-[0_0_0_1px_rgba(165,103,255,0.22),0_22px_52px_rgba(58,24,92,0.16)]',
    accent: 'bg-[#af78ff]',
    line: 'from-[#af78ff]/70 to-[#af78ff]/15',
  },
  finish: {
    title: 'Finish',
    pill: 'text-[#a9d9a6]',
    border: 'border-[#456d45]/70',
    surface: 'from-[#142216] via-[#141d17] to-[#131816]',
    glow: 'shadow-[0_0_0_1px_rgba(111,185,111,0.2),0_22px_52px_rgba(26,61,31,0.16)]',
    accent: 'bg-[#79bf79]',
    line: 'from-[#79bf79]/70 to-[#79bf79]/15',
  },
}

function extractYoutubeId(url?: string | null) {
  if (!url) return null

  const short = url.match(/youtu\.be\/([^?&]+)/)
  if (short?.[1]) return short[1]

  const long = url.match(/[?&]v=([^&]+)/)
  if (long?.[1]) return long[1]

  return null
}

function getPreviewImage(url?: string | null) {
  const youtubeId = extractYoutubeId(url)
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
  }

  return null
}

function getStageIndex(stage: StageKey) {
  return STAGE_ORDER.indexOf(stage)
}

function getStateIcon(state: NodeState) {
  if (state === 'completed') return CheckCircle2
  if (state === 'locked') return Lock
  return CirclePlay
}

function getNodeTone(node: PlanNode, active: boolean, compact: boolean) {
  const meta = STAGE_META[node.stage]

  if (node.state === 'locked') {
    return 'border-white/[0.04] bg-[linear-gradient(180deg,rgba(17,20,28,0.92),rgba(12,15,22,0.9))] text-white/52 shadow-[0_14px_34px_rgba(0,0,0,0.16)]'
  }

  if (active) {
    return `${meta.border} bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.0)),linear-gradient(180deg,var(--tw-gradient-stops))] ${meta.surface} ${compact ? 'shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_16px_36px_rgba(0,0,0,0.2)]' : meta.glow}`
  }

  return `${meta.border} bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.0)),linear-gradient(180deg,var(--tw-gradient-stops))] ${meta.surface} shadow-[0_16px_34px_rgba(0,0,0,0.16)]`
}

const TREE_COL_WIDTH = 320
const TREE_ROW_HEIGHT = 170
const TREE_ORIGIN_X = 24
const TREE_ORIGIN_Y = 16

function getSlotPosition(meta: TreeNodeMeta, size: TreeNodeMeta['size']) {
  const dims = getNodeDimensions(size)
  return {
    left: TREE_ORIGIN_X + meta.tier * TREE_COL_WIDTH,
    top: TREE_ORIGIN_Y + meta.lane * TREE_ROW_HEIGHT,
    width: dims.width,
    height: dims.minHeight,
  }
}

function getTreeLayout(planId: PlanId) {
  if (planId === 'b-plan') {
    return {
      width: 1240,
      height: 620,
      nodes: [
        { id: 'half-guard-entry', tier: 0, lane: 1, size: 'main' },
        { id: 'knee-shield', tier: 1, lane: 1, size: 'main' },
        { id: 'underhook-rise', tier: 2, lane: 1, size: 'main' },
        { id: 'sweep-finish', tier: 3, lane: 1, size: 'main' },
        { id: 'dogfight', tier: 1, lane: 3, size: 'branch' },
        { id: 'single-leg-finish', tier: 3, lane: 3, size: 'future' },
      ] satisfies TreeNodeMeta[],
      edges: [
        { from: 'half-guard-entry', to: 'knee-shield' },
        { from: 'knee-shield', to: 'underhook-rise' },
        { from: 'underhook-rise', to: 'sweep-finish' },
        { from: 'half-guard-entry', to: 'dogfight' },
        { from: 'knee-shield', to: 'dogfight' },
        { from: 'dogfight', to: 'single-leg-finish' },
        { from: 'underhook-rise', to: 'single-leg-finish' },
      ] satisfies TreeEdge[],
    }
  }

  if (planId === 'c-plan') {
    return {
      width: 1300,
      height: 620,
      nodes: [
        { id: 'open-guard-entry', tier: 0, lane: 1, size: 'main' },
        { id: 'inside-position', tier: 1, lane: 1, size: 'main' },
        { id: 'ashi-entry', tier: 2, lane: 1, size: 'main' },
        { id: 'leglock-finish', tier: 3, lane: 1, size: 'main' },
        { id: 'shin-on-shin', tier: 1, lane: 3, size: 'branch' },
        { id: 'single-leg-x', tier: 2, lane: 3, size: 'branch' },
        { id: 'outside-heel-hook', tier: 3, lane: 3, size: 'future' },
      ] satisfies TreeNodeMeta[],
      edges: [
        { from: 'open-guard-entry', to: 'inside-position' },
        { from: 'inside-position', to: 'ashi-entry' },
        { from: 'ashi-entry', to: 'leglock-finish' },
        { from: 'open-guard-entry', to: 'shin-on-shin' },
        { from: 'inside-position', to: 'single-leg-x' },
        { from: 'shin-on-shin', to: 'single-leg-x' },
        { from: 'single-leg-x', to: 'outside-heel-hook' },
        { from: 'ashi-entry', to: 'outside-heel-hook' },
      ] satisfies TreeEdge[],
    }
  }

  return {
    width: 1680,
    height: 1180,
    nodes: [
      { id: 'pull-guard', tier: 0, lane: 1, size: 'main' },
      { id: 'closed-guard', tier: 1, lane: 1, size: 'main' },
      { id: 'off-balance', tier: 2, lane: 1, size: 'main' },
      { id: 'backtake', tier: 3, lane: 1, size: 'main' },
      { id: 'hip-bump-sweep', tier: 1, lane: 3, size: 'branch' },
      { id: 'guillotine', tier: 1, lane: 4, size: 'branch' },
      { id: 'backtake-from-closed-guard', tier: 1, lane: 5, size: 'branch' },
      { id: 'kuzushi-details', tier: 2, lane: 3, size: 'branch' },
      { id: 'front-headlock', tier: 2, lane: 4, size: 'branch' },
      { id: 'wrestle-up', tier: 2, lane: 5, size: 'branch' },
      { id: 'triangle-path', tier: 3, lane: 4, size: 'future' },
      { id: 'mounted-guillotine', tier: 3, lane: 5, size: 'future' },
      { id: 'single-leg-finish', tier: 3, lane: 3, size: 'future' },
      { id: 'seatbelt-control', tier: 4, lane: 1, size: 'future' },
      { id: 'rear-naked-choke', tier: 4, lane: 2, size: 'future' },
      { id: 'back-crucifix', tier: 4, lane: 3, size: 'future' },
      { id: 'triangle-finish', tier: 4, lane: 4, size: 'future' },
    ] satisfies TreeNodeMeta[],
    edges: [
      { from: 'pull-guard', to: 'closed-guard' },
      { from: 'closed-guard', to: 'off-balance' },
      { from: 'off-balance', to: 'backtake' },
      { from: 'pull-guard', to: 'hip-bump-sweep' },
      { from: 'pull-guard', to: 'guillotine' },
      { from: 'pull-guard', to: 'backtake-from-closed-guard' },
      { from: 'closed-guard', to: 'hip-bump-sweep' },
      { from: 'closed-guard', to: 'guillotine' },
      { from: 'closed-guard', to: 'backtake-from-closed-guard' },
      { from: 'hip-bump-sweep', to: 'kuzushi-details' },
      { from: 'guillotine', to: 'front-headlock' },
      { from: 'off-balance', to: 'wrestle-up' },
      { from: 'kuzushi-details', to: 'backtake' },
      { from: 'front-headlock', to: 'mounted-guillotine' },
      { from: 'backtake-from-closed-guard', to: 'triangle-path' },
      { from: 'triangle-path', to: 'triangle-finish' },
      { from: 'wrestle-up', to: 'single-leg-finish' },
      { from: 'backtake', to: 'seatbelt-control' },
      { from: 'backtake', to: 'rear-naked-choke' },
      { from: 'backtake', to: 'back-crucifix' },
    ] satisfies TreeEdge[],
  }
}

function getNodeDimensions(size: TreeNodeMeta['size']) {
  if (size === 'main') {
    return { width: 260, minHeight: 206 }
  }

  if (size === 'branch') {
    return { width: 220, minHeight: 136 }
  }

  return { width: 200, minHeight: 120 }
}

function getDirectlyRelatedIds(activeNodeId: string, edges: TreeEdge[]) {
  const ids = new Set<string>([activeNodeId])

  edges.forEach((edge) => {
    if (edge.from === activeNodeId || edge.to === activeNodeId) {
      ids.add(edge.from)
      ids.add(edge.to)
    }
  })

  return ids
}

function getDirectChildren(activeNode: PlanNode | undefined, allNodes: Record<string, PlanNode>) {
  const children: PlanNode[] = []

  if (!activeNode?.expansionPaths?.length) {
    return children
  }

  activeNode.expansionPaths.forEach((path) => {
    const childId = path[0]
    const child = childId ? allNodes[childId] : null

    if (!child) return

    if (!children.some((entry) => entry.id === child.id)) {
      children.push(child)
    }
  })

  return children
}

function getVisibleTreeIdsWithContext(
  activeNodeId: string,
  allNodes: Record<string, PlanNode>,
  mainPathIds: string[]
) {
  const ids = new Set<string>(mainPathIds)
  const activeNode = allNodes[activeNodeId]
  if (!activeNode) return ids

  ids.add(activeNodeId)

  Object.values(allNodes).forEach((parent) => {
    parent.expansionPaths?.forEach((path) => {
      const idx = path.indexOf(activeNodeId)
      if (idx === -1) return

      ids.add(parent.id)

      const endIndex = Math.min(idx + 1, path.length - 1)
      for (let i = 0; i <= endIndex; i += 1) {
        const nodeId = path[i]
        if (allNodes[nodeId]) ids.add(nodeId)
      }
    })
  })

  activeNode.expansionPaths?.forEach((path) => {
    path.forEach((nodeId, index) => {
      if (!allNodes[nodeId]) return
      if (index <= 1) ids.add(nodeId)
    })
  })

  return ids
}

function getExpansionDepthMap(activeNode: PlanNode | undefined, allNodes: Record<string, PlanNode>) {
  const depthMap = new Map<string, number>()

  if (!activeNode?.expansionPaths?.length) {
    return depthMap
  }

  activeNode.expansionPaths.forEach((path) => {
    path.forEach((nodeId, index) => {
      if (!allNodes[nodeId]) return
      const depth = index + 1
      const current = depthMap.get(nodeId)
      if (!current || depth < current) {
        depthMap.set(nodeId, depth)
      }
    })
  })

  return depthMap
}

function StatusBadge({ state }: { state: NodeState }) {
  const Icon = getStateIcon(state)

  return (
    <span
      className={`absolute -right-3 -top-3 z-10 inline-flex items-center justify-center rounded-full border border-white/18 bg-[linear-gradient(180deg,rgba(21,27,39,0.96),rgba(15,19,28,0.96))] shadow-[0_12px_30px_rgba(0,0,0,0.28)] ${
        state === 'locked' ? 'h-14 w-14' : 'h-11 w-11'
      }`}
    >
      <Icon className={`${state === 'locked' ? 'h-6 w-6' : 'h-4 w-4'} ${state === 'locked' ? 'text-white/55' : state === 'completed' ? 'text-[#91e6b6]' : 'text-[#f0d18f]'}`} />
    </span>
  )
}

function MainPathCard({
  node,
  active,
  onClick,
  showArrow,
}: {
  node: PlanNode
  active: boolean
  onClick: (nodeId: string) => void
  showArrow?: boolean
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onClick(node.id)}
        className={`fluid-node group relative w-full rounded-[2rem] border p-6 text-left transition duration-200 hover:-translate-y-0.5 ${getNodeTone(node, active, false)}`}
      >
        <StatusBadge state={node.state} />
        <p className={`text-[0.78rem] font-black uppercase tracking-[0.28em] ${STAGE_META[node.stage].pill}`}>{STAGE_META[node.stage].title}</p>
        <h3 className="mt-4 text-[2.35rem] font-black leading-[0.94] text-white">{node.title}</h3>
        <p className="mt-4 max-w-[11rem] text-[0.95rem] leading-8 text-white/82">{node.label}</p>
      </button>
      {showArrow ? (
        <div className="pointer-events-none absolute left-full top-1/2 z-10 hidden h-px w-6 -translate-y-1/2 xl:block">
          <div className={`h-px w-full bg-gradient-to-r ${STAGE_META[node.stage].line}`} />
          <ArrowRight className="absolute -right-1 -top-2 h-4 w-4 text-white/36" />
        </div>
      ) : null}
    </div>
  )
}

function ExpansionCard({
  node,
  active,
  onClick,
  incoming,
  outgoing,
}: {
  node: PlanNode
  active: boolean
  onClick: (nodeId: string) => void
  incoming?: boolean
  outgoing?: boolean
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onClick(node.id)}
        className={`fluid-node group relative w-full rounded-[1.45rem] border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${getNodeTone(node, active, true)}`}
      >
        <StatusBadge state={node.state} />
        <p className={`text-[0.64rem] font-black uppercase tracking-[0.22em] ${STAGE_META[node.stage].pill}`}>{STAGE_META[node.stage].title}</p>
        <h4 className="mt-2.5 text-[1.35rem] font-black leading-[1] text-white">{node.title}</h4>
        <p className="mt-2 text-sm leading-6 text-white/72">{node.label}</p>
      </button>
      {incoming ? (
        <div className="pointer-events-none absolute right-full top-1/2 z-10 hidden h-px w-5 -translate-y-1/2 xl:block">
          <div className={`h-px w-full bg-gradient-to-r ${STAGE_META[node.stage].line}`} />
          <ArrowRight className="absolute -right-1 -top-2 h-4 w-4 text-white/24" />
        </div>
      ) : null}
      {outgoing ? (
        <div className="pointer-events-none absolute left-full top-1/2 z-10 hidden h-px w-6 -translate-y-1/2 xl:block">
          <div className={`h-px w-full bg-gradient-to-r ${STAGE_META[node.stage].line}`} />
          <ArrowRight className="absolute -right-1 -top-2 h-4 w-4 text-white/28" />
        </div>
      ) : null}
    </div>
  )
}

function TreeNodeCard({
  node,
  meta,
  size,
  active,
  focused,
  dimmed,
  onClick,
}: {
  node: PlanNode
  meta: TreeNodeMeta
  size: TreeNodeMeta['size']
  active: boolean
  focused: boolean
  dimmed: boolean
  onClick: (nodeId: string) => void
}) {
  const dimensions = getNodeDimensions(size)
  const main = size === 'main'
  const locked = node.state === 'locked'
  const branchMuted = !main && !focused && !active
  const opacityClass = locked
    ? 'opacity-12'
    : dimmed
      ? 'opacity-25'
      : branchMuted
        ? 'opacity-65'
        : main
          ? 'opacity-100'
          : 'opacity-92'
  const emphasisClass = active
    ? 'scale-[1.05] ring-2 ring-bjj-gold/60 shadow-[0_0_0_1px_rgba(217,159,92,0.45),0_30px_80px_rgba(0,0,0,0.38)]'
    : main
      ? 'ring-1 ring-white/18 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_rgba(0,0,0,0.3)]'
      : ''

  return (
    <button
      type="button"
      onClick={() => onClick(node.id)}
      className={`fluid-node group relative w-full rounded-[1.7rem] border text-left transition duration-200 hover:-translate-y-0.5 ${getNodeTone(node, active || focused, !main)} ${opacityClass} ${locked ? 'pointer-events-none grayscale' : ''} ${emphasisClass}`}
      style={{ minHeight: dimensions.minHeight, padding: main ? '1.35rem' : '1rem' }}
    >
      <StatusBadge state={node.state} />
      <p className={`${main ? 'text-[0.74rem]' : 'text-[0.62rem]'} font-black uppercase tracking-[0.24em] ${STAGE_META[node.stage].pill}`}>
        {STAGE_META[node.stage].title}
      </p>
      <h3 className={`${main ? 'mt-4 text-[2rem]' : 'mt-3 text-[1.28rem]'} font-black leading-[0.96] text-white`}>{node.title}</h3>
      <p className={`${main ? 'mt-4 text-[0.98rem] leading-7' : 'mt-2 text-sm leading-6'} text-white/78`}>{node.label}</p>
    </button>
  )
}

function MobilePath({
  nodes,
  activeNodeId,
  onClick,
}: {
  nodes: PlanNode[]
  activeNodeId: string
  onClick: (nodeId: string) => void
}) {
  return (
    <div className="space-y-3 xl:hidden">
      {nodes.map((node, index) => (
        <div key={node.id} className="space-y-3">
          <MainPathCard node={node} active={activeNodeId === node.id} onClick={onClick} />
          {index < nodes.length - 1 ? (
            <div className="flex justify-center">
              <ArrowRight className="h-4 w-4 rotate-90 text-white/28" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function getExpandedColumns(
  activeNode: PlanNode | undefined,
  allNodes: Record<string, PlanNode>,
  mainPathIds: string[]
) {
  const grouped: Partial<Record<StageKey, PlanNode[]>> = {}
  const mainPathSet = new Set(mainPathIds)

  if (!activeNode?.expansionPaths?.length) {
    return grouped
  }

  const activeStageIndex = getStageIndex(activeNode.stage)

  activeNode.expansionPaths.forEach((path) => {
    path.forEach((nodeId) => {
      const node = allNodes[nodeId]

      if (!node) return

      if (getStageIndex(node.stage) <= activeStageIndex) {
        return
      }

      if (mainPathSet.has(node.id)) {
        return
      }

      if (!grouped[node.stage]) {
        grouped[node.stage] = []
      }

      if (!grouped[node.stage]!.some((entry) => entry.id === node.id)) {
        grouped[node.stage]!.push(node)
      }
    })
  })

  STAGE_ORDER.forEach((stage) => {
    if (grouped[stage]?.length) {
      grouped[stage] = grouped[stage]!.slice(0, 3)
    }
  })

  return grouped
}

function getRouteSummaries(
  activeNode: PlanNode | undefined,
  allNodes: Record<string, PlanNode>,
  mainPathIds: string[]
) {
  if (!activeNode?.expansionPaths?.length) {
    return []
  }

  const mainPathSet = new Set(mainPathIds)
  const activeStageIndex = getStageIndex(activeNode.stage)
  const seen = new Set<string>()

  return activeNode.expansionPaths
    .map((path) =>
      path
        .map((nodeId) => allNodes[nodeId])
        .filter((node): node is PlanNode => Boolean(node))
        .filter((node) => getStageIndex(node.stage) > activeStageIndex)
        .filter((node) => !mainPathSet.has(node.id))
        .slice(0, 3)
    )
    .filter((path) => path.length > 0)
    .filter((path) => {
      const key = path.map((node) => node.id).join('>')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)
}

const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  'a-plan': {
    id: 'a-plan',
    title: 'A-Plan',
    mainPath: ['pull-guard', 'closed-guard', 'off-balance', 'backtake'],
    nodes: {
      'pull-guard': {
        id: 'pull-guard',
        title: 'Pull Guard',
        stage: 'setup',
        label: 'Grundlagen & Varianten',
        description: 'Zieht dich sauber in deinen Guard und setzt den Rest des Pfads auf.',
        outcome: 'Bringt dich kontrolliert in deine Guard-Arbeit.',
        focus: ['Griff setzen', 'Huefte reinziehen', 'Sofort Winkel sichern'],
        mistakes: ['Zu viel Distanz', 'Rueckwaerts fallen', 'Passiver erster Kontakt'],
        state: 'completed',
        expansionPaths: [
          ['closed-guard', 'off-balance', 'backtake'],
          ['hip-bump-sweep', 'kuzushi-details', 'backtake'],
          ['guillotine', 'front-headlock', 'mounted-guillotine'],
          ['backtake-from-closed-guard', 'triangle-path', 'triangle-finish'],
        ],
      },
      'closed-guard': {
        id: 'closed-guard',
        title: 'Closed Guard',
        stage: 'position',
        label: 'Kontrolle & Grips',
        description: 'Du schliesst die Distanz und kontrollierst Haltung, Arme und Winkel.',
        outcome: 'Stellt Grips und Zug fuer deine Off-Balance-Optionen her.',
        focus: ['Knie schliessen', 'Griffwechsel sauber halten', 'Kopfhaltung brechen'],
        mistakes: ['Offene Huefte', 'Zu hohes Ziehen', 'Keine Schulterkontrolle'],
        state: 'completed',
        expansionPaths: [
          ['off-balance', 'backtake'],
          ['hip-bump-sweep', 'kuzushi-details', 'backtake'],
          ['guillotine', 'front-headlock', 'mounted-guillotine'],
          ['backtake-from-closed-guard', 'triangle-path', 'triangle-finish'],
        ],
      },
      'off-balance': {
        id: 'off-balance',
        title: 'Off-Balance',
        stage: 'transition',
        label: 'Gleichgewicht brechen',
        description: 'Hier kippst du den Gegner aus der Linie und oeffnest den Ruecken.',
        outcome: 'Erzeugt die echte Oeffnung fuer Backtake oder Folgefinish.',
        focus: ['Timing auf den Zug', 'Winkel statt Kraft', 'Kopf ueber Schulter ziehen'],
        mistakes: ['Zu frueh ziehen', 'Gerade Linie behalten', 'Beine nicht nachladen'],
        state: 'current',
        expansionPaths: [
          ['backtake'],
          ['wrestle-up', 'single-leg-finish'],
          ['kuzushi-details', 'backtake'],
        ],
      },
      backtake: {
        id: 'backtake',
        title: 'Backtake',
        stage: 'finish',
        label: 'Position sichern',
        description: 'Du sicherst den Ruecken und bereitest Kontrolle plus Finish vor.',
        outcome: 'Rueckenkontrolle mit klarer Finish-Option.',
        focus: ['Seatbelt zuerst', 'Haken sauber setzen', 'Brustkontakt halten'],
        mistakes: ['Zu frueher Choke-Versuch', 'Kein Brustkontakt', 'Offene Schulterlinie'],
        state: 'available',
        expansionPaths: [['seatbelt-control'], ['rear-naked-choke'], ['back-crucifix']],
      },
      'hip-bump-sweep': {
        id: 'hip-bump-sweep',
        title: 'Hip Bump Sweep',
        stage: 'position',
        label: 'Sweep-Option',
        description: 'Alternative aus der Guard, wenn der Gegner Gewicht nach vorne gibt.',
        outcome: 'Oeffnet Transition in Top-Position oder Back Exposes.',
        focus: ['Hand posten lassen', 'Huefte explosiv anheben'],
        mistakes: ['Zu gerade bleiben', 'Kein Winkel vor dem Bump'],
        state: 'available',
        expansionPaths: [['kuzushi-details', 'backtake']],
      },
      guillotine: {
        id: 'guillotine',
        title: 'Guillotine',
        stage: 'position',
        label: 'Submission-Drohung',
        description: 'Submission-Linie, wenn der Kopf vorne bleibt.',
        outcome: 'Erzwingt Reaktion und oeffnet neue Front-Headlock-Pfade.',
        focus: ['Kinn einschliessen', 'Brust hochhalten'],
        mistakes: ['Nur mit Armen ziehen', 'Huefte faellt zurueck'],
        state: 'available',
        expansionPaths: [['front-headlock', 'mounted-guillotine']],
      },
      'backtake-from-closed-guard': {
        id: 'backtake-from-closed-guard',
        title: 'Backtake from Closed Guard',
        stage: 'position',
        label: 'Alternative Route',
        description: 'Rueckenlinie direkt aus der Guard, wenn die Schulter frei wird.',
        outcome: 'Direkter Weg in Finish-Druck ohne klassischen Kuzushi-Zyklus.',
        focus: ['Schulter blockieren', 'Winkel frueh wechseln'],
        mistakes: ['Zu spaet um die Ecke', 'Kein Kontrollgriff'],
        state: 'available',
        expansionPaths: [['triangle-path', 'triangle-finish']],
      },
      'kuzushi-details': {
        id: 'kuzushi-details',
        title: 'Kuzushi Details',
        stage: 'transition',
        label: 'Methoden & Timing',
        description: 'Feinabstimmung fuer Timing, Richtung und Folgegriff.',
        outcome: 'Macht deinen Weg in Backtake oder Sweep stabiler.',
        focus: ['Timing lesen', 'Zugrichtung wechseln'],
        mistakes: ['Immer gleich ziehen', 'Zu statisch am Gegner haengen'],
        state: 'completed',
        expansionPaths: [['backtake']],
      },
      'front-headlock': {
        id: 'front-headlock',
        title: 'Front Headlock',
        stage: 'transition',
        label: 'Kontrollpunkt',
        description: 'Bindet den Kopf und erzeugt Submission- oder Snapdown-Druck.',
        outcome: 'Leitet in Finish oder Dominanzwechsel.',
        focus: ['Ellbogen eng', 'Schulterdruck hoch'],
        mistakes: ['Zu offen stehen', 'Keine Kopfhoehe kontrollieren'],
        state: 'available',
        expansionPaths: [['mounted-guillotine']],
      },
      'triangle-path': {
        id: 'triangle-path',
        title: 'Triangle Path',
        stage: 'transition',
        label: 'Unlock Route',
        description: 'Spezialisierter Pfad fuer Triangle-Angriffe.',
        outcome: 'Neuer Finish-Zweig aus derselben Guard-Logik.',
        focus: ['Bein hoch ueber Schulter', 'Winkel schliessen'],
        mistakes: ['Knie offen', 'Kein Winkel vor dem Schliessen'],
        state: 'locked',
        expansionPaths: [['triangle-finish']],
      },
      'mounted-guillotine': {
        id: 'mounted-guillotine',
        title: 'Mounted Guillotine',
        stage: 'finish',
        label: 'Finish',
        description: 'Abschluss aus Front-Headlock-Pressure.',
        outcome: 'Submission-Endpunkt fuer die Guillotine-Linie.',
        focus: ['Wristline fixieren', 'Brustdruck halten'],
        mistakes: ['Arme statt Rumpf', 'Zu viel Raum lassen'],
        state: 'locked',
      },
      'triangle-finish': {
        id: 'triangle-finish',
        title: 'Triangle Finish',
        stage: 'finish',
        label: 'Finish',
        description: 'Abschluss aus dem freigeschalteten Triangle-Pfad.',
        outcome: 'Submission-Endpunkt fuer die Side-Route.',
        focus: ['Winkel maximieren', 'Knie zusammenziehen'],
        mistakes: ['Zu frueh ziehen', 'Kein Kopfzug'],
        state: 'locked',
      },
      'wrestle-up': {
        id: 'wrestle-up',
        title: 'Wrestle Up',
        stage: 'transition',
        label: 'Alternative Transition',
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
        stage: 'finish',
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
        stage: 'finish',
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
        stage: 'finish',
        label: 'Submission',
        description: 'Klassischer Abschluss aus stabiler Rueckenkontrolle.',
        outcome: 'High-value Finish des A-Plans.',
        focus: ['Kinnlinie lesen', 'Ellbogen nach hinten ziehen'],
        mistakes: ['Zu viel squeeze ohne Position', 'Schulter nicht hinter dem Kopf'],
        state: 'locked',
      },
      'back-crucifix': {
        id: 'back-crucifix',
        title: 'Back Crucifix',
        stage: 'finish',
        label: 'Alternative Finish',
        description: 'Wechsel auf eine kontrollierte Arm-Isolation vom Ruecken.',
        outcome: 'Alternative Endroute, wenn der Choke blockiert wird.',
        focus: ['Arm einklemmen', 'Huefte dicht halten'],
        mistakes: ['Zu locker am Oberkoerper', 'Winkel verlieren'],
        state: 'locked',
      },
    },
  },
  'b-plan': {
    id: 'b-plan',
    title: 'B-Plan',
    mainPath: ['half-guard-entry', 'knee-shield', 'underhook-rise', 'sweep-finish'],
    nodes: {
      'half-guard-entry': {
        id: 'half-guard-entry',
        title: 'Half Guard',
        stage: 'setup',
        label: 'Entry',
        description: 'Kontrollierter Einstieg in den B-Plan.',
        outcome: 'Stellt den Shield und die Underhook-Arbeit her.',
        focus: ['Knie innen', 'Frame zuerst'],
        mistakes: ['Flach liegen', 'Kein Ellbogenraum'],
        state: 'completed',
        expansionPaths: [['knee-shield', 'underhook-rise', 'sweep-finish'], ['dogfight', 'single-leg-finish']],
      },
      'knee-shield': {
        id: 'knee-shield',
        title: 'Knee Shield',
        stage: 'position',
        label: 'Shield',
        description: 'Haltet Distanz und baut den Underhook auf.',
        outcome: 'Sichert Struktur fuer den Aufstieg.',
        focus: ['Knie aktiv', 'Unterarm laenger machen'],
        mistakes: ['Zu flach', 'Kein Kopfrahmen'],
        state: 'current',
        expansionPaths: [['underhook-rise', 'sweep-finish'], ['dogfight', 'single-leg-finish']],
      },
      'underhook-rise': {
        id: 'underhook-rise',
        title: 'Underhook Rise',
        stage: 'transition',
        label: 'Rise',
        description: 'Der eigentliche Aufstieg aus Half Guard.',
        outcome: 'Fuehrt in Sweep oder Takedown.',
        focus: ['Kopf hoch', 'Huefte unter den Gegner'],
        mistakes: ['Zu tief bleiben', 'Kein Winkel'],
        state: 'available',
        expansionPaths: [['sweep-finish'], ['single-leg-finish']],
      },
      'sweep-finish': {
        id: 'sweep-finish',
        title: 'Sweep',
        stage: 'finish',
        label: 'Top sichern',
        description: 'Sauberer Abschluss in Top-Position.',
        outcome: 'Bringt dich direkt in dominante Top-Control.',
        focus: ['Oben bleiben', 'Crossface sichern'],
        mistakes: ['Zu frueh loslassen', 'Kein Base nach dem Sweep'],
        state: 'locked',
      },
      dogfight: {
        id: 'dogfight',
        title: 'Dogfight',
        stage: 'position',
        label: 'Alternative Position',
        description: 'Wird aktiv, wenn der Underhook scramble-lastig wird.',
        outcome: 'Alternative Entry in denselben Abschluss.',
        focus: ['Kopfposition gewinnen'],
        mistakes: ['Zu weit nach hinten sitzen'],
        state: 'available',
        expansionPaths: [['single-leg-finish']],
      },
      'single-leg-finish': {
        id: 'single-leg-finish',
        title: 'Single Leg Finish',
        stage: 'finish',
        label: 'Takedown',
        description: 'Finish der alternativen Half-Guard-Linie.',
        outcome: 'Top-Position ueber Takedown.',
        focus: ['Winkel laufen'],
        mistakes: ['Gerade stehen bleiben'],
        state: 'available',
      },
    },
  },
  'c-plan': {
    id: 'c-plan',
    title: 'C-Plan',
    mainPath: ['open-guard-entry', 'inside-position', 'ashi-entry', 'leglock-finish'],
    nodes: {
      'open-guard-entry': {
        id: 'open-guard-entry',
        title: 'Open Guard',
        stage: 'setup',
        label: 'Entry',
        description: 'Offene Guard mit Distanzkontrolle als Start.',
        outcome: 'Bereitet Inside Position vor.',
        focus: ['Fuesse aktiv', 'Hand-Fight frueh'],
        mistakes: ['Zu statisch', 'Zu gerade vor dem Gegner'],
        state: 'completed',
        expansionPaths: [['inside-position', 'ashi-entry', 'leglock-finish'], ['shin-on-shin', 'single-leg-x', 'outside-heel-hook']],
      },
      'inside-position': {
        id: 'inside-position',
        title: 'Inside Position',
        stage: 'position',
        label: 'Kontrolle',
        description: 'Kontrolliert die innere Linie und macht Ashi moeglich.',
        outcome: 'Verbindet Distanzkontrolle mit Beinangriff.',
        focus: ['Knie innen', 'Hips mobil halten'],
        mistakes: ['Beine zu weit weg', 'Kein Frame auf den Schultern'],
        state: 'current',
        expansionPaths: [['ashi-entry', 'leglock-finish'], ['single-leg-x', 'outside-heel-hook']],
      },
      'ashi-entry': {
        id: 'ashi-entry',
        title: 'Ashi Entry',
        stage: 'transition',
        label: 'Entry',
        description: 'Der eigentliche Einstieg in die Leglock-Struktur.',
        outcome: 'Sichert die Beinlinie fuer den Finish.',
        focus: ['Knie klemmen', 'Ferse kontrollieren'],
        mistakes: ['Zu lose Beine', 'Keine Hueftnahe'],
        state: 'available',
        expansionPaths: [['leglock-finish'], ['outside-heel-hook']],
      },
      'leglock-finish': {
        id: 'leglock-finish',
        title: 'Leglock',
        stage: 'finish',
        label: 'Finish',
        description: 'Abschluss des C-Plans.',
        outcome: 'Submissions aus kontrollierter Beinlinie.',
        focus: ['Knie trennen', 'Ferse verstecken lassen'],
        mistakes: ['Zu viel Ruecklage', 'Keine Knieklemme'],
        state: 'locked',
      },
      'shin-on-shin': {
        id: 'shin-on-shin',
        title: 'Shin on Shin',
        stage: 'position',
        label: 'Alternative Position',
        description: 'Alternative Inside-Entry fuer offene Guard.',
        outcome: 'Fuehrt in dieselbe Legline mit anderem Timing.',
        focus: ['Schienbein aktiv'],
        mistakes: ['Kein Zug am Fuss'],
        state: 'available',
        expansionPaths: [['single-leg-x', 'outside-heel-hook']],
      },
      'single-leg-x': {
        id: 'single-leg-x',
        title: 'Single Leg X',
        stage: 'transition',
        label: 'Ashi Variation',
        description: 'Alternative Ashi-Variante.',
        outcome: 'Druckvoller Entry in den Finish.',
        focus: ['Knie nach aussen', 'Fusslinie halten'],
        mistakes: ['Zu offen unterm Gegner'],
        state: 'available',
        expansionPaths: [['outside-heel-hook']],
      },
      'outside-heel-hook': {
        id: 'outside-heel-hook',
        title: 'Outside Heel Hook',
        stage: 'finish',
        label: 'Alternative Finish',
        description: 'Alternative Leglock-Endroute.',
        outcome: 'Sekundaerer Endpunkt fuer den C-Plan.',
        focus: ['Knie kontrollieren'],
        mistakes: ['Fersenlinie verlieren'],
        state: 'locked',
      },
    },
  },
}

export default function GameplanPage() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const requestedPlan = (searchParams.get('plan') ?? 'a-plan') as PlanId
  const planId = requestedPlan in PLAN_CONFIGS ? requestedPlan : 'a-plan'
  const plan = PLAN_CONFIGS[planId]
  const mainNodes = plan.mainPath.map((nodeId) => plan.nodes[nodeId]).filter(Boolean)
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const [activeNodeId, setActiveNodeId] = useState(plan.mainPath[0])
  const [detailNodeId, setDetailNodeId] = useState(plan.mainPath[0])
  const [detailOpen, setDetailOpen] = useState(false)
  const [showAllNodes, setShowAllNodes] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [userAdjusted, setUserAdjusted] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 })
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveNodeId(plan.mainPath[0])
    setDetailNodeId(plan.mainPath[0])
    setDetailOpen(false)
    setUserAdjusted(false)
  }, [planId, plan.mainPath])

  const activeNode = plan.nodes[activeNodeId] ?? mainNodes[0]
  const detailNode = plan.nodes[detailNodeId] ?? activeNode
  const detailClips = useMemo(() => getCuratedClipsForNode(detailNode.id), [detailNode.id])
  const previewImage = getPreviewImage(detailClips[0]?.sourceUrl)
  const treeLayout = useMemo(() => getTreeLayout(planId), [planId])
  const directlyRelatedIds = useMemo(() => getDirectlyRelatedIds(activeNode.id, treeLayout.edges), [activeNode.id, treeLayout.edges])
  const visibleTreeIds = useMemo(() => {
    if (showAllNodes) {
      return new Set(Object.keys(plan.nodes))
    }
    if (!detailOpen) {
      return new Set(plan.mainPath)
    }
    return getVisibleTreeIdsWithContext(activeNodeId, plan.nodes, plan.mainPath)
  }, [activeNodeId, plan.nodes, plan.mainPath, showAllNodes, detailOpen])
  const expansionDepths = useMemo(() => getExpansionDepthMap(activeNode, plan.nodes), [activeNode, plan.nodes])
  const headerClip = useMemo(() => getCuratedClipsForNode(plan.mainPath[0])[0], [plan.mainPath])
  const headerImage = getPreviewImage(headerClip?.sourceUrl)
  const highlightNodeId = detailOpen ? activeNodeId : null
  const mainPathEdgeSet = useMemo(() => {
    const edges = new Set<string>()
    plan.mainPath.forEach((nodeId, index) => {
      const next = plan.mainPath[index + 1]
      if (next) edges.add(`${nodeId}->${next}`)
    })
    return edges
  }, [plan.mainPath])
  const reviewPlanNodes = useMemo(() => getPlanNodes().slice(0, 4), [])
  const reviewUnlocked = useMemo(
    () => reviewPlanNodes.length > 0 && reviewPlanNodes.every((node) => completedIds.includes(node.id)),
    [completedIds, reviewPlanNodes]
  )

  useEffect(() => {
    async function loadProgress() {
      const user = await waitForAuthenticatedUser(supabase)
      if (!user) return

      const { data } = await supabase.from('progress').select('node_id').eq('user_id', user.id).eq('completed', true)
      setCompletedIds(data?.map((entry) => entry.node_id) ?? [])
    }

    void loadProgress()
  }, [supabase])

  useEffect(() => {
    function stopPan() {
      setIsPanning(false)
    }

    if (isPanning) {
      window.addEventListener('mouseup', stopPan)
      window.addEventListener('mouseleave', stopPan)
    }

    return () => {
      window.removeEventListener('mouseup', stopPan)
      window.removeEventListener('mouseleave', stopPan)
    }
  }, [isPanning])

  useEffect(() => {
    function fitToViewport() {
      const viewport = viewportRef.current
      if (!viewport || userAdjusted) return
      const padding = 24
      const width = Math.max(1, viewport.clientWidth - padding * 2)
      const height = Math.max(1, viewport.clientHeight - padding * 2)
      const scaleX = width / treeLayout.width
      const scaleY = height / treeLayout.height
      const nextScale = Math.min(1.08, scaleX, scaleY)
      const scaledWidth = treeLayout.width * nextScale
      const scaledHeight = treeLayout.height * nextScale
      const nextOffset = {
        x: Math.round((viewport.clientWidth - scaledWidth) / 2),
        y: Math.round((viewport.clientHeight - scaledHeight) / 2),
      }
      setScale(nextScale)
      setOffset(nextOffset)
    }

    fitToViewport()
    window.addEventListener('resize', fitToViewport)
    return () => window.removeEventListener('resize', fitToViewport)
  }, [treeLayout.width, treeLayout.height, userAdjusted])

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const delta = Math.sign(event.deltaY) * -0.08
    setUserAdjusted(true)
    setScale((current) => Math.min(1.35, Math.max(0.6, current + delta)))
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    setUserAdjusted(true)
    setIsPanning(true)
    panRef.current = {
      x: offset.x,
      y: offset.y,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!isPanning) return
    const { x, y, startX, startY } = panRef.current
    setOffset({
      x: x + (event.clientX - startX),
      y: y + (event.clientY - startY),
    })
  }

  function handleNodeClick(nodeId: string) {
    const node = plan.nodes[nodeId]
    if (!node) return

    if (detailOpen && detailNodeId === nodeId) {
      setDetailOpen(false)
      setActiveNodeId(plan.mainPath[0])
      setDetailNodeId(plan.mainPath[0])
      setUserAdjusted(false)
      return
    }

    setDetailNodeId(nodeId)
    setDetailOpen(true)
    if (!detailOpen) {
      setOffset((current) => ({ ...current, x: current.x - 70 }))
    }

    setActiveNodeId(nodeId)
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1680px]">
        <section className="fluid-panel rounded-[2.3rem] border border-white/[0.055] bg-[linear-gradient(180deg,rgba(17,22,32,0.96),rgba(13,17,25,0.93))] p-5 sm:p-7">
          <div className="mt-6">
            <div className="relative overflow-hidden rounded-[1.4rem]">
              <div className="absolute inset-0">
                {headerImage ? (
                  <img src={headerImage} alt="Gameplan Header" className="h-full w-full object-cover opacity-70" />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%),linear-gradient(90deg,#1b2232,#121826)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f16]/95 via-[#0b0f16]/70 to-transparent" />
              </div>
              <div className="relative grid gap-6 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div>
                  <h2 className="mt-3 text-3xl font-black leading-tight text-white">
                    LONG FLEXIBLE GUARD PLAYER
                    <span className="mt-2 block text-2xl font-black text-white/85">A-PLAN</span>
                  </h2>
                  <div className="mt-4 flex items-center gap-3 text-sm font-semibold text-white/80">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] font-black text-white">
                      CJ
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">Craig Jones</span>
                      <span className="text-xs text-white/60">Competition System</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAllNodes((current) => !current)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                        showAllNodes
                          ? 'border-bjj-gold/40 bg-bjj-gold/15 text-bjj-gold'
                          : 'border-white/10 bg-white/[0.06] text-white/90'
                      }`}
                    >
                      {showAllNodes ? 'Alle Nodes aktiv' : 'Alle Nodes zeigen'}
                    </button>
                    <button className="inline-flex items-center justify-center gap-2 rounded-full border border-[#7fd1a0]/35 bg-[#1a2b22]/80 px-4 py-2 text-sm font-semibold text-[#91e6b6]">
                      <CheckCircle2 className="h-4 w-4" />
                      Plan aktiv
                    </button>
                    {reviewUnlocked ? (
                      <Link
                        href="/review"
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-bjj-gold/35 bg-bjj-gold/12 px-4 py-2 text-sm font-semibold text-bjj-gold transition hover:bg-bjj-gold/18"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Review freigeschaltet
                      </Link>
                    ) : null}
                    <button className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/90">
                      <Settings2 className="h-4 w-4" />
                      Plan anpassen
                    </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div
              ref={viewportRef}
              className="relative h-[780px] overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(217,137,88,0.08),transparent_22%),radial-gradient(circle_at_top_right,rgba(109,128,255,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(150,108,255,0.06),transparent_24%),linear-gradient(180deg,rgba(12,16,24,0.94),rgba(11,15,23,0.92))] select-none"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            >
              <div className="pointer-events-none absolute right-5 top-5 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setUserAdjusted(true); setScale((current) => Math.max(0.6, current - 0.1)) }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
                  >
                    -
                  </button>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80">
                    Zoom {Math.round(scale * 100)}%
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUserAdjusted(true); setScale((current) => Math.min(1.35, current + 0.1)) }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
                  >
                    +
                  </button>
              </div>

              <div
                className="absolute left-0 top-0"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'top left',
                  width: treeLayout.width,
                  height: treeLayout.height,
                }}
              >
                <svg className="absolute inset-0 z-0" width={treeLayout.width} height={treeLayout.height}>
                  <defs>
                    <marker id="arrow-main" markerWidth="6" markerHeight="6" refX="5.6" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="rgba(245,248,255,0.72)" />
                    </marker>
                    <marker id="arrow-branch" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto">
                      <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(182,192,214,0.32)" />
                    </marker>
                  </defs>
                  {treeLayout.edges
                    .filter((edge) => visibleTreeIds.has(edge.from) && visibleTreeIds.has(edge.to))
                    .map((edge) => {
                      const fromMeta = treeLayout.nodes.find((entry) => entry.id === edge.from)
                      const toMeta = treeLayout.nodes.find((entry) => entry.id === edge.to)
                      if (!fromMeta || !toMeta) return null

                      const fromSlot = getSlotPosition(fromMeta, fromMeta.size)
                      const toSlot = getSlotPosition(toMeta, toMeta.size)
                      const fromCenterX = fromSlot.left + fromSlot.width / 2
                      const fromCenterY = fromSlot.top + fromSlot.height / 2
                      const fromRightX = fromSlot.left + fromSlot.width
                      const fromBottomY = fromSlot.top + fromSlot.height
                      const toCenterY = toSlot.top + toSlot.height / 2
                      const toLeftX = toSlot.left

                      const isMainEdge = mainPathEdgeSet.has(`${edge.from}->${edge.to}`)
                      const isClosedGuardBranch =
                        edge.from === 'closed-guard' && !isMainEdge

                      let path = ''

                      if (isMainEdge) {
                        path = `M ${fromRightX} ${fromCenterY} L ${toLeftX} ${toCenterY}`
                      } else if (isClosedGuardBranch) {
                        const trunkY = toCenterY
                        path = `M ${fromCenterX} ${fromBottomY} L ${fromCenterX} ${trunkY} L ${toLeftX} ${toCenterY}`
                      } else {
                        const midX = (fromRightX + toLeftX) / 2
                        path = `M ${fromRightX} ${fromCenterY} L ${midX} ${fromCenterY} L ${midX} ${toCenterY} L ${toLeftX} ${toCenterY}`
                      }
                      const highlighted = edge.from === activeNode.id || edge.to === activeNode.id

                      return (
                        <path
                          key={`${edge.from}-${edge.to}`}
                          d={path}
                          fill="none"
                          stroke={
                            isMainEdge
                              ? 'rgba(245,248,255,0.78)'
                              : highlighted
                                ? 'rgba(218,228,255,0.48)'
                                : 'rgba(182,192,214,0.12)'
                          }
                          strokeWidth={isMainEdge ? 3.1 : highlighted ? 1.85 : 0.9}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd={isMainEdge ? 'url(#arrow-main)' : 'url(#arrow-branch)'}
                        />
                      )
                    })}
                </svg>

                  {treeLayout.nodes
                    .filter((meta) => visibleTreeIds.has(meta.id))
                  .map((meta) => {
                      const node = plan.nodes[meta.id]
                      if (!node) return null
                      const focused = directlyRelatedIds.has(node.id)
                      const depth = expansionDepths.get(node.id) ?? 0
                      const dimmed = depth >= 2
                      const slot = getSlotPosition(meta, meta.size)

                    return (
                      <div
                        key={node.id}
                        className="absolute"
                        style={{ left: slot.left, top: slot.top, width: slot.width }}
                      >
                        <TreeNodeCard
                          node={node}
                          meta={meta}
                          size={meta.size}
                          active={highlightNodeId === node.id}
                          focused={focused}
                          dimmed={dimmed}
                          onClick={handleNodeClick}
                        />
                      </div>
                    )
                  })}
              </div>

              {detailOpen ? (
                <aside className="pointer-events-auto absolute right-5 top-5 z-30 w-[238px]">
                  <div className="fluid-surface rounded-[1.25rem] border border-white/[0.04] bg-[linear-gradient(180deg,rgba(18,23,33,0.82),rgba(14,18,26,0.8))] p-3 shadow-[0_12px_26px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-bjj-gold">Details</p>
                      <button
                        type="button"
                        onClick={() => setDetailOpen(false)}
                        className="text-xs font-black text-white/60 hover:text-white"
                      >
                        Schliessen
                      </button>
                    </div>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-white">{detailNode.title}</h2>
                    <p className="mt-1 text-xs text-white/65">{detailNode.label}</p>

                    <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(26,32,45,0.92),rgba(14,18,27,0.95))]">
                      {previewImage ? (
                        <img src={previewImage} alt={detailNode.title} className="aspect-video w-full object-cover" />
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_50%),linear-gradient(180deg,#272f3f,#131924)]">
                          <Play className="h-10 w-10 text-white/65" />
                        </div>
                      )}
                      <div className="border-t border-white/8 px-4 py-3">
                        <p className="text-sm font-semibold text-white">{detailClips[0]?.title ?? detailNode.title}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1.2rem] border border-[#5c925f]/20 bg-[linear-gradient(180deg,rgba(21,38,24,0.85),rgba(15,24,18,0.82))] p-3.5">
                      <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-[#9dd59a]">Ergebnis</p>
                      <p className="mt-2 text-base font-black text-white">{detailNode.outcome}</p>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-bjj-gold">Zweck</p>
                        <p className="mt-2 text-sm leading-7 text-white/84">{detailNode.description}</p>
                      </div>

                      <div>
                        <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-bjj-gold">Fokus</p>
                        <div className="mt-2 space-y-1.5">
                          {detailNode.focus.slice(0, 3).map((item) => (
                            <div key={item} className="flex items-start gap-2 text-white/84">
                              <Target className="mt-1 h-3.5 w-3.5 shrink-0 text-bjj-gold" />
                              <span className="text-sm">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Link
                        href={`/?focus=${detailNode.id}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#c97842,#b96835)] px-4 py-3 text-sm font-black text-white shadow-[0_18px_36px_rgba(125,58,21,0.26)] transition hover:brightness-105"
                      >
                        Jetzt trainieren
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/gameplan"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/16"
                      >
                        Im Gameplan vertiefen
                      </Link>
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
