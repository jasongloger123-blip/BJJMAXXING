'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, ChevronDown, CirclePlay, Lock, Target } from 'lucide-react'
import { GameplanClipDeck } from '@/components/gameplan/GameplanClipDeck'
import { getCuratedClipsForNode, type CuratedClip } from '@/lib/curated-clips'
import { clipArchiveToCuratedClip, type ClipArchiveRecord } from '@/lib/clip-archive'
import { readCustomTechniques } from '@/lib/custom-techniques'
import { type ResolvedGameplan as RemoteGameplan } from '@/lib/gameplans'
import { getTechniqueCatalogEntryForPlanNode } from '@/lib/technique-catalog'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'
import { calculateClipProgressForNode, getClipProgressLookupIds } from '@/lib/clip-progress'

type StageKey = 'position' | 'pass' | 'submission'
type PlanId = 'a-plan' | 'b-plan' | 'c-plan'
type NodeState = 'completed' | 'current' | 'available' | 'locked' | 'silhouette'

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
  sourceNodeId?: string | null
  progressPercent?: number
  progressCompletedRules?: number
  progressTotalRules?: number
}

type PlanConfig = {
  id: PlanId
  title: string
  headline: string
  creatorName: string
  creatorRole: string
  creatorInitials: string
  creatorProfileHref: string
  mainPath: string[]
  nodes: Record<string, PlanNode>
}

type TreeNodeMeta = {
  id: string
  tier?: number | null
  lane?: number | null
  size: 'main' | 'branch' | 'future'
  x?: number | null
  y?: number | null
}

type TreeEdge = {
  from: string
  to: string
}

type APlanVariant = 'default' | 'technical'

type CreatorProfile = {
  name: string
  role: string
  initials: string
  avatarUrl: string | null
}

const STAGE_ORDER: StageKey[] = ['position', 'pass', 'submission']
const PLAN_TITLE_MAX_LENGTH = 80
const GAMEPLAN_UNLOCK_EVENT_KEY = 'bjjmaxxing:pending-gameplan-unlock'

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
  position: {
    title: 'Position',
    pill: 'text-[#89afff]',
    border: 'border-[#3d5fa5]/70',
    surface: 'from-[#121d31] via-[#151b2a] to-[#131721]',
    glow: 'shadow-[0_0_0_1px_rgba(93,136,255,0.22),0_22px_52px_rgba(20,39,86,0.16)]',
    accent: 'bg-[#6b94ff]',
    line: 'from-[#6b94ff]/70 to-[#6b94ff]/15',
  },
  pass: {
    title: 'Pass',
    pill: 'text-[#f0b37a]',
    border: 'border-[#8d532c]/70',
    surface: 'from-[#241813] via-[#1c1714] to-[#171418]',
    glow: 'shadow-[0_0_0_1px_rgba(201,122,66,0.22),0_22px_52px_rgba(108,53,20,0.18)]',
    accent: 'bg-[#cf8648]',
    line: 'from-[#cf8648]/70 to-[#cf8648]/15',
  },
  submission: {
    title: 'Submission',
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

function normalizePlanHeadline(value: string) {
  return value.slice(0, PLAN_TITLE_MAX_LENGTH)
}

function getStateIcon(state: NodeState) {
  if (state === 'completed') return CheckCircle2
  if (state === 'locked' || state === 'silhouette') return Lock
  return CirclePlay
}

function shouldMaskNodeInOverview(node: PlanNode, showAllNodes: boolean, knownVisibleIds: Set<string>) {
  return showAllNodes && !knownVisibleIds.has(node.id) && (node.state === 'locked' || node.state === 'silhouette')
}

function getNodeTone(node: PlanNode, active: boolean, compact: boolean) {
  const meta = STAGE_META[node.stage]

  if (node.state === 'locked' || node.state === 'silhouette') {
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
  if (typeof meta.x === 'number' && typeof meta.y === 'number') {
    return {
      left: meta.x,
      top: meta.y,
      width: dims.width,
      height: dims.minHeight,
    }
  }
  return {
    left: TREE_ORIGIN_X + (meta.tier ?? 0) * TREE_COL_WIDTH,
    top: TREE_ORIGIN_Y + (meta.lane ?? 0) * TREE_ROW_HEIGHT,
    width: dims.width,
    height: dims.minHeight,
  }
}

function getTreeLayout(planId: PlanId, aPlanVariant: APlanVariant = 'default') {
  if (planId === 'a-plan' && aPlanVariant === 'technical') {
    return {
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
      ] satisfies TreeNodeMeta[],
      edges: [
        { from: 'leg-entry', to: 'leg-control' },
        { from: 'leg-control', to: 'leg-isolation' },
        { from: 'leg-isolation', to: 'knee-submission' },
        { from: 'leg-entry', to: 'shin-to-shin-kuzushi' },
        { from: 'leg-control', to: 'ankle-switch' },
        { from: 'leg-isolation', to: 'wrestle-up' },
        { from: 'ankle-switch', to: 'finish-details' },
        { from: 'wrestle-up', to: 'single-leg-finish' },
      ] satisfies TreeEdge[],
    }
  }

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
      { id: 'stand-up', tier: 0, lane: 1, size: 'main' },
      { id: 'closed-guard', tier: 1, lane: 1, size: 'main' },
      { id: 'backtake', tier: 2, lane: 1, size: 'main' },
      { id: 'rear-naked-choke', tier: 3, lane: 1, size: 'main' },
      { id: 'off-balance', tier: 2, lane: 3, size: 'branch' },
      { id: 'hip-bump-sweep', tier: 1, lane: 3, size: 'branch' },
      { id: 'guillotine', tier: 1, lane: 4, size: 'branch' },
      { id: 'backtake-from-closed-guard', tier: 1, lane: 5, size: 'branch' },
      { id: 'kuzushi-details', tier: 2, lane: 4, size: 'branch' },
      { id: 'front-headlock', tier: 2, lane: 4, size: 'branch' },
      { id: 'wrestle-up', tier: 2, lane: 5, size: 'branch' },
      { id: 'triangle-path', tier: 3, lane: 4, size: 'future' },
      { id: 'mounted-guillotine', tier: 3, lane: 5, size: 'future' },
      { id: 'single-leg-finish', tier: 3, lane: 3, size: 'future' },
      { id: 'seatbelt-control', tier: 3, lane: 2, size: 'future' },
      { id: 'back-crucifix', tier: 4, lane: 2, size: 'future' },
      { id: 'triangle-finish', tier: 4, lane: 4, size: 'future' },
    ] satisfies TreeNodeMeta[],
    edges: [
      { from: 'stand-up', to: 'closed-guard' },
      { from: 'closed-guard', to: 'backtake' },
      { from: 'backtake', to: 'rear-naked-choke' },
      { from: 'stand-up', to: 'hip-bump-sweep' },
      { from: 'stand-up', to: 'guillotine' },
      { from: 'stand-up', to: 'backtake-from-closed-guard' },
      { from: 'closed-guard', to: 'hip-bump-sweep' },
      { from: 'closed-guard', to: 'guillotine' },
      { from: 'closed-guard', to: 'backtake-from-closed-guard' },
      { from: 'closed-guard', to: 'off-balance' },
      { from: 'hip-bump-sweep', to: 'kuzushi-details' },
      { from: 'guillotine', to: 'front-headlock' },
      { from: 'off-balance', to: 'wrestle-up' },
      { from: 'kuzushi-details', to: 'backtake' },
      { from: 'front-headlock', to: 'mounted-guillotine' },
      { from: 'backtake-from-closed-guard', to: 'triangle-path' },
      { from: 'triangle-path', to: 'triangle-finish' },
      { from: 'wrestle-up', to: 'single-leg-finish' },
      { from: 'backtake', to: 'seatbelt-control' },
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

function getVisibleLayoutBounds(visibleIds: Set<string>, layoutNodes: TreeNodeMeta[]) {
  const visibleNodes = layoutNodes.filter((node) => visibleIds.has(node.id))
  if (visibleNodes.length === 0) {
    return null
  }

  let minLeft = Number.POSITIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY

  visibleNodes.forEach((node) => {
    const slot = getSlotPosition(node, node.size)
    minLeft = Math.min(minLeft, slot.left)
    minTop = Math.min(minTop, slot.top)
    maxRight = Math.max(maxRight, slot.left + slot.width)
    maxBottom = Math.max(maxBottom, slot.top + slot.height)
  })

  return {
    minLeft,
    minTop,
    maxRight,
    maxBottom,
    width: Math.max(1, maxRight - minLeft),
    height: Math.max(1, maxBottom - minTop),
  }
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
        state === 'locked' || state === 'silhouette' ? 'h-14 w-14' : 'h-11 w-11'
      }`}
    >
      <Icon className={`${state === 'locked' || state === 'silhouette' ? 'h-6 w-6' : 'h-4 w-4'} ${state === 'locked' || state === 'silhouette' ? 'text-white/55' : state === 'completed' ? 'text-[#91e6b6]' : 'text-[#f0d18f]'}`} />
    </span>
  )
}

function UnlockParticles({ className = 'gameplan-unlock-particle' }: { className?: string }) {
  const particles = [
    ['-50px', '-40px'],
    ['50px', '-45px'],
    ['-60px', '30px'],
    ['45px', '50px'],
    ['0px', '-70px'],
    ['-80px', '0px'],
    ['70px', '20px'],
    ['20px', '80px'],
  ] as const

  return (
    <>
      {particles.map(([dx, dy], index) => (
        <span
          key={`${dx}-${dy}-${index}`}
          className={className}
          style={{ '--dx': dx, '--dy': dy } as CSSProperties}
        />
      ))}
    </>
  )
}

function MainPathCard({
  node,
  active,
  onClick,
  showArrow,
  masked = false,
}: {
  node: PlanNode
  active: boolean
  onClick: (nodeId: string) => void
  showArrow?: boolean
  masked?: boolean
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
        <h3 className="mt-4 text-[2.35rem] font-black leading-[0.94] text-white">{masked ? '???' : node.title}</h3>
        {!masked && typeof node.progressPercent === 'number' ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/48">
              <span>Unlock Progress</span>
              <span>{node.progressCompletedRules ?? 0}/{node.progressTotalRules ?? 0}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#d99f5c,#f0c27b)]" style={{ width: `${node.progressPercent}%` }} />
            </div>
          </div>
        ) : null}
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
  masked = false,
}: {
  node: PlanNode
  active: boolean
  onClick: (nodeId: string) => void
  incoming?: boolean
  outgoing?: boolean
  masked?: boolean
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
        <h4 className="mt-2.5 text-[1.35rem] font-black leading-[1] text-white">{masked ? '?' : node.title}</h4>
        {!masked && typeof node.progressPercent === 'number' ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/42">
              <span>Unlock</span>
              <span>{node.progressCompletedRules ?? 0}/{node.progressTotalRules ?? 0}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#d99f5c,#f0c27b)]" style={{ width: `${node.progressPercent}%` }} />
            </div>
          </div>
        ) : null}
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
  masked = false,
  unlockTarget = false,
}: {
  node: PlanNode
  meta: TreeNodeMeta
  size: TreeNodeMeta['size']
  active: boolean
  focused: boolean
  dimmed: boolean
  onClick: (nodeId: string) => void
  masked?: boolean
  unlockTarget?: boolean
}) {
  const dimensions = getNodeDimensions(size)
  const main = size === 'main'
  const locked = node.state === 'locked' || node.state === 'silhouette'
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
      className={`fluid-node group relative w-full rounded-[1.7rem] border text-left transition duration-200 hover:-translate-y-0.5 ${getNodeTone(node, active || focused, !main)} ${opacityClass} ${locked ? 'pointer-events-none grayscale' : ''} ${emphasisClass} ${unlockTarget ? 'gameplan-unlock-card-target z-20' : ''}`}
      style={{ minHeight: dimensions.minHeight, padding: main ? '1.35rem' : '1rem' }}
    >
      {unlockTarget ? (
        <span className="gameplan-unlock-lock-target absolute -right-3 -top-3 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/18 bg-[linear-gradient(180deg,rgba(21,27,39,0.96),rgba(15,19,28,0.96))] shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
          <Lock className="h-6 w-6 text-white/55" />
          <UnlockParticles />
        </span>
      ) : (
        <StatusBadge state={node.state} />
      )}
      <p className={`${main ? 'text-[0.74rem]' : 'text-[0.62rem]'} font-black uppercase tracking-[0.24em] ${STAGE_META[node.stage].pill}`}>
        {STAGE_META[node.stage].title}
      </p>
      <h3 className={`${main ? 'mt-4 text-[2rem]' : 'mt-3 text-[1.28rem]'} font-black leading-[0.96] text-white`}>{masked ? '?' : node.title}</h3>
      {!masked && typeof node.progressPercent === 'number' ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/40">
            <span>Unlock</span>
            <span>{node.progressCompletedRules ?? 0}/{node.progressTotalRules ?? 0}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#d99f5c,#f0c27b)]" style={{ width: `${node.progressPercent}%` }} />
          </div>
        </div>
      ) : null}
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

function isTechnicalGuardArchetype(archetypeId?: string | null) {
  return archetypeId === 'flexible-guard-technician' || archetypeId === 'long-technical-guard-player'
}

function getEdgeKey(from: string, to: string) {
  return `${from}->${to}`
}

function getConnectionClips(fromId: string, toId: string) {
  return [...getCuratedClipsForNode(fromId).slice(0, 1), ...getCuratedClipsForNode(toId)].slice(0, 4)
}

function getConnectionDetails(fromNode: PlanNode, toNode: PlanNode) {
  const isStandUpToGuard = fromNode.id === 'stand-up' && toNode.id === 'closed-guard'

  return {
    title: `${fromNode.title} -> ${toNode.title}`,
    label: isStandUpToGuard ? 'Uebergang in die Guard' : 'Connection Videos',
    description: isStandUpToGuard
      ? 'Dieser Pfeil zeigt dir den Uebergang aus dem Stand in die Closed Guard mit Material aus der vorherigen Technik und aus der Zieltechnik.'
      : `Hier siehst du den Uebergang aus ${fromNode.title} in ${toNode.title} mit Videos vom vorherigen Schritt und der Zieltechnik.`,
    outcome: isStandUpToGuard
      ? 'Macht den Weg von Stand Up in Closed Guard direkt im Gameplan sichtbar.'
      : `Zeigt dir den konkreten naechsten Schritt von ${fromNode.title} nach ${toNode.title}.`,
    focus: [
      `Einstieg aus ${fromNode.title} sauber lesen`,
      `Timing fuer den Wechsel in ${toNode.title}`,
      `Videos fuer ${toNode.title} direkt im Plan weiter oeffnen`,
    ],
  }
}

const DEFAULT_A_PLAN_CONFIG: PlanConfig = {
  id: 'a-plan',
  title: 'A-Plan',
  headline: 'Long Flexible Guard Player',
  creatorName: 'FGES',
  creatorRole: 'Fight School',
  creatorInitials: 'FG',
  creatorProfileHref: '/profile',
  mainPath: ['stand-up', 'closed-guard', 'backtake', 'rear-naked-choke'],
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
      title: 'Closed Guard',
      stage: 'position',
      label: 'Kontrolle & Grips',
      description: 'Hier baust du Kontrolle, Griffkampf und Winkel auf, bevor du den Gegner wirklich kippst.',
      outcome: 'Gibt dir stabile Struktur fuer Kuzushi, Backtakes und Sweep-Druck.',
      focus: ['Knie geschlossen halten', 'Kopfhaltung stoeren', 'Sauberen Zug an Arm oder Schulter holen'],
      mistakes: ['Zu flach unter dem Gegner bleiben', 'Guard oeffnen ohne Grund', 'Keine aktive Griffkontrolle'],
      state: 'completed',
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
}

const TECHNICAL_A_PLAN_CONFIG: PlanConfig = {
  id: 'a-plan',
  title: 'A-Plan',
  headline: 'Long Technical Guard Player',
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
}

const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  'a-plan': DEFAULT_A_PLAN_CONFIG,
  'b-plan': {
    id: 'b-plan',
    title: 'B-Plan',
    headline: 'Half Guard Pressure Builder',
    creatorName: 'BJJMAXXING',
    creatorRole: 'Core System',
    creatorInitials: 'BM',
    creatorProfileHref: '/profile',
    mainPath: ['half-guard-entry', 'knee-shield', 'underhook-rise', 'sweep-finish'],
    nodes: {
      'half-guard-entry': {
        id: 'half-guard-entry',
        title: 'Half Guard',
        stage: 'position',
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
        stage: 'pass',
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
        stage: 'pass',
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
        stage: 'pass',
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
    headline: 'Leglock Entry Accelerator',
    creatorName: 'BJJMAXXING',
    creatorRole: 'Core System',
    creatorInitials: 'BM',
    creatorProfileHref: '/profile',
    mainPath: ['open-guard-entry', 'inside-position', 'ashi-entry', 'leglock-finish'],
    nodes: {
      'open-guard-entry': {
        id: 'open-guard-entry',
        title: 'Open Guard',
        stage: 'position',
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
        stage: 'pass',
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
        stage: 'submission',
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
        stage: 'pass',
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
        stage: 'submission',
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
  const router = useRouter()
  const supabase = createClient()
  const planId = 'a-plan'
  const [creatorArchetypeId, setCreatorArchetypeId] = useState<string | null>(null)
  const [remotePlan, setRemotePlan] = useState<RemoteGameplan | null>(null)
  const [availablePlans, setAvailablePlans] = useState<RemoteGameplan[]>([])
  const [disabledPlanIds, setDisabledPlanIds] = useState<string[]>([])
  const [persistedActivePlanId, setPersistedActivePlanId] = useState<string | null>(null)
  const [disabledPlanIdsLoaded, setDisabledPlanIdsLoaded] = useState(false)
  const [showPlanSelector, setShowPlanSelector] = useState(false)
  const [remotePlanLoaded, setRemotePlanLoaded] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [forceOverview, setForceOverview] = useState(false)
  const aPlanVariant: APlanVariant = planId === 'a-plan' && isTechnicalGuardArchetype(creatorArchetypeId) ? 'technical' : 'default'
  const fallbackPlan = planId === 'a-plan' && aPlanVariant === 'technical' ? TECHNICAL_A_PLAN_CONFIG : PLAN_CONFIGS[planId]
  const visiblePlans = useMemo(
    () => availablePlans.filter((entry) => !disabledPlanIds.includes(entry.id)),
    [availablePlans, disabledPlanIds]
  )

  const basePlan = (remotePlan as unknown as PlanConfig | null) ?? fallbackPlan
  const baseMainNodes = basePlan.mainPath.map((nodeId) => basePlan.nodes[nodeId]).filter(Boolean)
  const baseFallbackNode = baseMainNodes[0] ?? Object.values(basePlan.nodes)[0] ?? null
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [clipProgressByNodeId, setClipProgressByNodeId] = useState<Record<string, { completed: number; total: number; percent: number }>>({})

  const [activeNodeId, setActiveNodeId] = useState(basePlan.mainPath[0])
  const [detailNodeId, setDetailNodeId] = useState(basePlan.mainPath[0])
  const [detailEdgeKey, setDetailEdgeKey] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [showAllNodes, setShowAllNodes] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [userAdjusted, setUserAdjusted] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [planHeadline, setPlanHeadline] = useState(basePlan.headline)
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null)
  const [connectionClipOverrides, setConnectionClipOverrides] = useState<Record<string, CuratedClip[]>>({})
  const [nodeClipOverrides, setNodeClipOverrides] = useState<Record<string, CuratedClip[]>>({})
  const [gameplanUnlockAnimation, setGameplanUnlockAnimation] = useState<{ previousTitle?: string; nextTitle: string; nextLabel: string } | null>(null)
  const progressUnlockReloadRef = useRef<string | null>(null)
  const panRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 })
  const offsetRef = useRef(offset)
  const scaleRef = useRef(scale)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const plan = useMemo<PlanConfig>(() => {
    const patchedNodes = Object.fromEntries(
      Object.entries(basePlan.nodes).map(([nodeId, node]) => {
        const sourceNodeId = node.sourceNodeId ?? node.id
        const progress = clipProgressByNodeId[node.id] ?? clipProgressByNodeId[sourceNodeId]
        if (!progress) return [nodeId, node]

        return [
          nodeId,
          {
            ...node,
            progressCompletedRules: progress.completed,
            progressTotalRules: progress.total,
            progressPercent: progress.percent,
          },
        ]
      })
    ) as Record<string, PlanNode>

    const remoteCurrentNodeId = remotePlan?.unlockSummary.currentNodeId ?? null
    const remoteCurrentIndex = remoteCurrentNodeId ? basePlan.mainPath.indexOf(remoteCurrentNodeId) : -1
    const remoteCurrentNode = remoteCurrentNodeId ? patchedNodes[remoteCurrentNodeId] ?? null : null
    const shouldAdvanceLocally =
      remoteCurrentIndex >= 0 &&
      Boolean(remoteCurrentNode?.progressTotalRules && remoteCurrentNode.progressTotalRules > 0) &&
      (remoteCurrentNode?.progressCompletedRules ?? 0) >= (remoteCurrentNode?.progressTotalRules ?? 0)

    if (shouldAdvanceLocally) {
      const localCurrentNodeId = basePlan.mainPath[remoteCurrentIndex + 1] ?? null
      const localNextNodeId = basePlan.mainPath[remoteCurrentIndex + 2] ?? null

      basePlan.mainPath.forEach((nodeId, index) => {
        const node = patchedNodes[nodeId]
        if (!node) return

        if (index <= remoteCurrentIndex) {
          patchedNodes[nodeId] = { ...node, state: 'completed' }
          return
        }

        if (nodeId === localCurrentNodeId) {
          patchedNodes[nodeId] = { ...node, state: 'current' }
          return
        }

        if (nodeId === localNextNodeId) {
          patchedNodes[nodeId] = { ...node, state: 'locked' }
          return
        }
      })
    }

    return {
      ...basePlan,
      nodes: patchedNodes,
    }
  }, [basePlan, clipProgressByNodeId, remotePlan?.unlockSummary.currentNodeId])
  const mainNodes = plan.mainPath.map((nodeId) => plan.nodes[nodeId]).filter(Boolean)
  const fallbackNode = mainNodes[0] ?? Object.values(plan.nodes)[0] ?? baseFallbackNode

  // Check if a plan is currently selected (either from DB or local)
  const hasSelectedPlan = selectedPlanId !== null
  const hasMultiplePlans = visiblePlans.length > 1
  const shouldRenderSelectedPlan =
    !forceOverview && (hasSelectedPlan || (remotePlanLoaded && visiblePlans.length === 1 && Boolean(remotePlan)))
  const shouldRenderOverview = remotePlanLoaded && !shouldRenderSelectedPlan && availablePlans.length > 0
  const shouldRenderEmptyState = remotePlanLoaded && !shouldRenderSelectedPlan && availablePlans.length === 0

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('gameplan-layout-mode', {
        detail: { detailMode: shouldRenderSelectedPlan },
      })
    )

    return () => {
      window.dispatchEvent(
        new CustomEvent('gameplan-layout-mode', {
          detail: { detailMode: false },
        })
      )
    }
  }, [shouldRenderSelectedPlan])

  useEffect(() => {
    if (!shouldRenderSelectedPlan) return

    try {
      const raw = window.localStorage.getItem(GAMEPLAN_UNLOCK_EVENT_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as { previousTitle?: string; nextTitle?: string; nextLabel?: string }
      if (!parsed.nextTitle) {
        window.localStorage.removeItem(GAMEPLAN_UNLOCK_EVENT_KEY)
        return
      }

      setGameplanUnlockAnimation({
        previousTitle: parsed.previousTitle,
        nextTitle: parsed.nextTitle,
        nextLabel: parsed.nextLabel ?? 'Neue Technik',
      })
      window.localStorage.removeItem(GAMEPLAN_UNLOCK_EVENT_KEY)

      const timeout = window.setTimeout(() => {
        setGameplanUnlockAnimation(null)
      }, 2600)

      return () => window.clearTimeout(timeout)
    } catch {
      window.localStorage.removeItem(GAMEPLAN_UNLOCK_EVENT_KEY)
    }
  }, [shouldRenderSelectedPlan])

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  function applyZoomAtPoint(nextScale: number, pointerX: number, pointerY: number) {
    const currentScale = scaleRef.current
    const currentOffset = offsetRef.current
    const clampedScale = Math.min(1.35, Math.max(0.6, Number(nextScale.toFixed(3))))

    if (clampedScale === currentScale) {
      return
    }

    const worldX = (pointerX - currentOffset.x) / currentScale
    const worldY = (pointerY - currentOffset.y) / currentScale
    const nextOffset = {
      x: Math.round(pointerX - worldX * clampedScale),
      y: Math.round(pointerY - worldY * clampedScale),
    }

    scaleRef.current = clampedScale
    offsetRef.current = nextOffset
    setScale(clampedScale)
    setOffset(nextOffset)
  }

  useEffect(() => {
    if (!remotePlanLoaded) return
    const remoteCurrentNodeId = remotePlan?.unlockSummary.currentNodeId ?? null
    const remoteCurrentIndex = remoteCurrentNodeId ? plan.mainPath.indexOf(remoteCurrentNodeId) : -1
    const remoteCurrentNode = remoteCurrentNodeId ? plan.nodes[remoteCurrentNodeId] ?? null : null
    const shouldAdvanceLocally =
      remoteCurrentIndex >= 0 &&
      Boolean(remoteCurrentNode?.progressTotalRules && remoteCurrentNode.progressTotalRules > 0) &&
      (remoteCurrentNode?.progressCompletedRules ?? 0) >= (remoteCurrentNode?.progressTotalRules ?? 0)
    const preferredNodeId =
      shouldAdvanceLocally
        ? plan.mainPath[remoteCurrentIndex + 1] ?? remoteCurrentNodeId ?? plan.mainPath[0]
        : remoteCurrentNodeId ?? plan.mainPath[0]

    if (detailOpen || userAdjusted) {
      setPlanHeadline(normalizePlanHeadline(plan.headline))
      return
    }

    setActiveNodeId(preferredNodeId)
    setDetailNodeId(preferredNodeId)
    setDetailEdgeKey(null)
    setDetailOpen(false)
    setUserAdjusted(false)
    setPlanHeadline(normalizePlanHeadline(plan.headline))
  }, [detailOpen, plan.headline, plan.mainPath, remotePlan, remotePlanLoaded, userAdjusted])

  const activeNode = plan.nodes[activeNodeId] ?? fallbackNode
  const detailNode = plan.nodes[detailNodeId] ?? activeNode ?? fallbackNode
  const detailEdge = useMemo(() => {
    if (!detailEdgeKey) return null
    const [from, to] = detailEdgeKey.split('->')
    if (!from || !to || !plan.nodes[from] || !plan.nodes[to]) return null
    return { from, to }
  }, [detailEdgeKey, plan.nodes])
  const detailConnection = useMemo(() => {
    if (!detailEdge) return null
    return getConnectionDetails(plan.nodes[detailEdge.from], plan.nodes[detailEdge.to])
  }, [detailEdge, plan.nodes])
  const detailClips = useMemo(() => {
    if (detailEdge) {
      const key = getEdgeKey(detailEdge.from, detailEdge.to)
      return connectionClipOverrides[key] ?? getConnectionClips(detailEdge.from, detailEdge.to)
    }
    if (!detailNode) return []
    const nodeKey = detailNode.sourceNodeId ?? detailNode.id
    if (nodeClipOverrides[nodeKey]) {
      return nodeClipOverrides[nodeKey]
    }
    return getCuratedClipsForNode(nodeKey)
  }, [connectionClipOverrides, detailEdge, detailNode, nodeClipOverrides])
  const progressSummary = remotePlan?.unlockSummary ?? null
  const unlockedTechniqueProgress = useMemo(() => {
    const total = progressSummary ? progressSummary.coreTotalCount + progressSummary.expansionTotalCount : 0
    const unlocked = progressSummary ? progressSummary.unlockedNodeIds.length : 0
    return {
      completed: Math.min(unlocked, total),
      total,
    }
  }, [progressSummary])
  const unlockTargetTitle = gameplanUnlockAnimation?.nextTitle?.trim().toLowerCase() ?? null
  const unlockTargetNodeId = useMemo(() => {
    if (!unlockTargetTitle) return null
    return (
      Object.values(plan.nodes).find((node) => node.title.trim().toLowerCase() === unlockTargetTitle)?.id ??
      null
    )
  }, [plan.nodes, unlockTargetTitle])
  const knownVisibleNodeIds = useMemo(() => new Set(progressSummary?.visibleNodeIds ?? []), [progressSummary])
  const localAdvanceNodeIds = useMemo(() => {
    const remoteCurrentNodeId = remotePlan?.unlockSummary.currentNodeId ?? null
    const remoteCurrentIndex = remoteCurrentNodeId ? basePlan.mainPath.indexOf(remoteCurrentNodeId) : -1
    const remoteCurrentNode = remoteCurrentNodeId ? plan.nodes[remoteCurrentNodeId] ?? null : null
    const shouldAdvance =
      remoteCurrentIndex >= 0 &&
      Boolean(remoteCurrentNode?.progressTotalRules && remoteCurrentNode.progressTotalRules > 0) &&
      (remoteCurrentNode?.progressCompletedRules ?? 0) >= (remoteCurrentNode?.progressTotalRules ?? 0)

    if (!shouldAdvance) {
      return []
    }

    return [remoteCurrentNodeId, basePlan.mainPath[remoteCurrentIndex + 1], basePlan.mainPath[remoteCurrentIndex + 2]].filter(
      (nodeId): nodeId is string => Boolean(nodeId)
    )
  }, [basePlan.mainPath, plan.nodes, remotePlan?.unlockSummary.currentNodeId])
  const treeLayout = useMemo(() => remotePlan?.layout ?? getTreeLayout(planId, aPlanVariant), [aPlanVariant, planId, remotePlan])
  const directlyRelatedIds = useMemo(() => activeNode ? getDirectlyRelatedIds(activeNode.id, treeLayout.edges) : new Set<string>(), [activeNode, treeLayout.edges])
  const visibleTreeIds = useMemo(() => {
    if (!remotePlanLoaded) {
      return new Set<string>()
    }
    if (showAllNodes) {
      return new Set(Object.keys(plan.nodes))
    }
    if (progressSummary) {
      // Combine visibleNodeIds with unlockedNodeIds (completed nodes should always be visible)
      const visible = new Set(progressSummary.visibleNodeIds)
      progressSummary.unlockedNodeIds.forEach((id) => visible.add(id))
      localAdvanceNodeIds.forEach((id) => visible.add(id))
      return visible
    }
    if (!detailOpen) {
      return new Set(plan.mainPath)
    }
    return getVisibleTreeIdsWithContext(activeNodeId, plan.nodes, plan.mainPath)
  }, [activeNodeId, detailOpen, localAdvanceNodeIds, plan.mainPath, plan.nodes, progressSummary, remotePlanLoaded, showAllNodes])
  useEffect(() => {
    if (!remotePlanLoaded || visibleTreeIds.size === 0) return

    let active = true
    async function loadVisibleClipProgress() {
      const user = await waitForAuthenticatedUser(supabase)
      if (!user || !active) return

      const [{ data: events }, { data: statuses }] = await Promise.all([
        supabase
          .from('training_clip_events')
          .select('node_id, clip_key')
          .eq('user_id', user.id)
          .eq('result', 'known'),
        supabase
          .from('training_clip_status')
          .select('node_id, clip_key, clip_id, can_count, cannot_count, last_result')
          .eq('user_id', user.id),
      ])

      const knownEvents = events ?? []
      const customTechniques = readCustomTechniques()
      const nextProgress: Record<string, { completed: number; total: number; percent: number }> = {}
      const aliasPlans = availablePlans.length > 0 ? availablePlans : [basePlan]

      await Promise.all(
        Array.from(visibleTreeIds).map(async (nodeId) => {
          const node = basePlan.nodes[nodeId]
          if (!node) return

          const sourceNodeId = node.sourceNodeId ?? node.id
          const lookupIds = getClipProgressLookupIds(node, aliasPlans, customTechniques)

          const clipRefs: { id?: string | null; url: string }[] = []
          const pushClipRef = (clip: { id?: string | null; url?: string | null }) => {
            const url = clip.url ?? ''
            if (url && !clipRefs.some((entry) => entry.url === url)) {
              clipRefs.push({ id: clip.id ?? null, url })
            }
          }

          try {
            const aliasIds = lookupIds.filter((id) => id !== sourceNodeId)
            const aliasParam = aliasIds.length > 0 ? `&aliasIds=${encodeURIComponent(aliasIds.join(','))}` : ''
            const response = await fetch(`/api/node-clips?nodeId=${encodeURIComponent(sourceNodeId)}${aliasParam}`, { cache: 'no-store' })
            const payload = (await response.json()) as {
              groups?: {
                main_reference?: { id?: string | null; video_url?: string | null; source_url?: string | null }[]
                counter_reference?: { id?: string | null; video_url?: string | null; source_url?: string | null }[]
                drill_reference?: { id?: string | null; video_url?: string | null; source_url?: string | null }[]
                related_reference?: { id?: string | null; video_url?: string | null; source_url?: string | null }[]
              }
            }
            const groups = payload.groups
            if (response.ok && groups) {
              ;[
                ...(groups.main_reference ?? []),
                ...(groups.counter_reference ?? []),
                ...(groups.drill_reference ?? []),
                ...(groups.related_reference ?? []),
              ].forEach((clip) => {
                const url = clip.video_url ?? clip.source_url ?? ''
                pushClipRef({ id: clip.id, url })
              })
            }
          } catch {
            // Fallback below keeps the Gameplan progress usable without archive clips.
          }

          if (clipRefs.length === 0) {
            const catalogEntry = getTechniqueCatalogEntryForPlanNode(node)
            ;(catalogEntry?.videos ?? []).forEach((video) => {
              pushClipRef({ url: video.url })
            })
          }

          if (clipRefs.length === 0) {
            const fallbackClips = getCuratedClipsForNode(sourceNodeId)
            const nodeFallbackClips = sourceNodeId === node.id ? [] : getCuratedClipsForNode(node.id)
            ;[...fallbackClips, ...nodeFallbackClips].forEach((clip) => {
              pushClipRef({ url: clip.sourceUrl })
            })
          }

          const progress = calculateClipProgressForNode({
            node,
            lookupIds,
            clipRefs,
            knownEvents,
            statuses: statuses ?? [],
          })
          if (!progress) return

          nextProgress[node.id] = progress
          nextProgress[sourceNodeId] = progress
        })
      )

      if (!active) return
      setClipProgressByNodeId((current) => {
        const currentSerialized = JSON.stringify(current)
        const nextSerialized = JSON.stringify(nextProgress)
        return currentSerialized === nextSerialized ? current : nextProgress
      })
    }

    void loadVisibleClipProgress()
    return () => {
      active = false
    }
  }, [availablePlans, basePlan.nodes, remotePlanLoaded, supabase, visibleTreeIds])
  const expansionDepths = useMemo(() => getExpansionDepthMap(activeNode, plan.nodes), [activeNode, plan.nodes])
  const highlightNodeId = detailOpen ? activeNodeId : null
  const activeEdgeKey = detailEdge ? getEdgeKey(detailEdge.from, detailEdge.to) : null
  const mainPathEdgeSet = useMemo(() => {
    const edges = new Set<string>()
    plan.mainPath.forEach((nodeId, index) => {
      const next = plan.mainPath[index + 1]
      if (next) edges.add(getEdgeKey(nodeId, next))
    })
    return edges
  }, [plan.mainPath])
  const reviewPlanNodes = useMemo(() => plan.mainPath.map((nodeId) => plan.nodes[nodeId]).filter(Boolean), [plan])
  const reviewUnlocked = useMemo(
    () => (remotePlan ? remotePlan.unlockSummary.coreValidated : reviewPlanNodes.length > 0 && reviewPlanNodes.every((node) => completedIds.includes(node.id))),
    [completedIds, remotePlan, reviewPlanNodes]
  )
  const resolvedCreatorName = remotePlan ? plan.creatorName : creatorProfile?.name ?? plan.creatorName
  const resolvedCreatorRole = remotePlan ? plan.creatorRole : creatorProfile?.role ?? 'Dein A-Plan'
  const resolvedCreatorInitials = remotePlan ? plan.creatorInitials : creatorProfile?.initials ?? plan.creatorInitials
  const resolvedCreatorAvatarUrl = remotePlan ? null : creatorProfile?.avatarUrl ?? null

  useEffect(() => {
    if (!disabledPlanIdsLoaded) return
    if (!remotePlan) return
    if (disabledPlanIds.includes(remotePlan.id)) {
      setRemotePlan(null)
      setSelectedPlanId(null)
      setForceOverview(true)
      setShowPlanSelector(false)
    }
  }, [disabledPlanIds, disabledPlanIdsLoaded, remotePlan])

  async function getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers = new Headers()
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
    return headers
  }

  useEffect(() => {
    if (!remotePlan?.unlockSummary.currentNodeId) return

    const currentNodeId = remotePlan.unlockSummary.currentNodeId
    const currentNode = plan.nodes[currentNodeId]
    if (!currentNode?.progressTotalRules || currentNode.progressTotalRules <= 0) return
    if ((currentNode.progressCompletedRules ?? 0) < currentNode.progressTotalRules) return

    const reloadKey = `${remotePlan.id}:${currentNodeId}:${currentNode.progressCompletedRules}/${currentNode.progressTotalRules}`
    if (progressUnlockReloadRef.current === reloadKey) return
    progressUnlockReloadRef.current = reloadKey

    let active = true
    async function reloadActivePlanAfterClipCompletion() {
      try {
        const response = await fetch('/api/gameplan/active', { cache: 'no-store', headers: await getAuthHeaders() })
        const payload = await response.json()
        const refreshedPlan = (payload.plan ?? null) as RemoteGameplan | null
        if (!active || !response.ok || !refreshedPlan) return

        const nextCurrentNodeId = refreshedPlan.unlockSummary.currentNodeId
        const nextCurrentNode = nextCurrentNodeId ? refreshedPlan.nodes[nextCurrentNodeId] ?? null : null

        setAvailablePlans((current) =>
          current.some((entry) => entry.id === refreshedPlan.id)
            ? current.map((entry) => (entry.id === refreshedPlan.id ? refreshedPlan : entry))
            : [refreshedPlan, ...current]
        )
        setRemotePlan(refreshedPlan)
        setSelectedPlanId(refreshedPlan.id)

        if (nextCurrentNode && nextCurrentNodeId !== currentNodeId) {
          setGameplanUnlockAnimation({
            previousTitle: currentNode.title,
            nextTitle: nextCurrentNode.title,
            nextLabel: nextCurrentNode.label,
          })
          window.setTimeout(() => {
            if (active) setGameplanUnlockAnimation(null)
          }, 2600)
        } else {
          progressUnlockReloadRef.current = null
        }
      } catch (error) {
        progressUnlockReloadRef.current = null
        console.error('Failed to refresh gameplan unlock state:', error)
      }
    }

    void reloadActivePlanAfterClipCompletion()
    return () => {
      active = false
    }
  }, [plan.nodes, remotePlan])

  useEffect(() => {
    let active = true

    async function ensureAuthenticated() {
      const user = await waitForAuthenticatedUser(supabase)
      if (!active) return

      if (!user) {
        router.push('/login?next=/gameplan')
      }
    }

    void ensureAuthenticated()

    return () => {
      active = false
    }
  }, [router, supabase])

    useEffect(() => {
      async function loadAvailablePlans() {
        async function fallbackToActivePlan() {
          const activeResponse = await fetch('/api/gameplan/active', { cache: 'no-store', headers: await getAuthHeaders() })
          const activePayload = await activeResponse.json()
          const activePlan = (activePayload.plan ?? null) as RemoteGameplan | null
          const fallbackPlans = activePlan ? [activePlan] : []
          setAvailablePlans(fallbackPlans)

          if (fallbackPlans.length === 1) {
            setForceOverview(false)
            setSelectedPlanId(fallbackPlans[0].id)
            setRemotePlan(fallbackPlans[0])
          }
        }

        try {
          const response = await fetch('/api/gameplan/list', { cache: 'no-store', headers: await getAuthHeaders() })
          const payload = await response.json()
          if (!response.ok) {
            console.error('Failed to load gameplans:', payload.error)
            await fallbackToActivePlan()
            return
          }
          
          const plans = (payload.plans ?? []) as RemoteGameplan[]
          const persistedDisabledPlanIds = Array.isArray(payload.disabledPlanIds)
            ? payload.disabledPlanIds.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
            : []
          const activePlanId = typeof payload.activePlanId === 'string' ? payload.activePlanId : null
          setDisabledPlanIds(persistedDisabledPlanIds)
          setPersistedActivePlanId(activePlanId)
          setDisabledPlanIdsLoaded(true)
          if (plans.length > 0) {
            setAvailablePlans(plans)
          } else {
            await fallbackToActivePlan()
            return
          }
          
          // Don't auto-select a plan - let user choose from overview
          // Only set selectedPlanId if there's exactly one plan (backward compatibility)
          const enabledPlans = plans.filter((plan) => !persistedDisabledPlanIds.includes(plan.id))
          const preferredPlan =
            enabledPlans.find((plan) => plan.id === activePlanId) ??
            (enabledPlans.length === 1 ? enabledPlans[0] : null)
          if (preferredPlan) {
            setForceOverview(false)
            setSelectedPlanId(preferredPlan.id)
            setRemotePlan(preferredPlan)
          }
        } catch (error) {
          console.error('Error loading gameplans:', error)
          try {
            await fallbackToActivePlan()
          } catch (fallbackError) {
            console.error('Failed to load active gameplan fallback:', fallbackError)
            setAvailablePlans([])
          }
          setDisabledPlanIdsLoaded(true)
        } finally {
          setRemotePlanLoaded(true)
        }
    }

    void loadAvailablePlans()
  }, [])

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
    if (!detailEdge) return
    const edge = detailEdge

    let active = true
    async function loadConnectionClips() {
      const fromNodeId = plan.nodes[edge.from]?.sourceNodeId ?? edge.from
      const toNodeId = plan.nodes[edge.to]?.sourceNodeId ?? edge.to
      try {
        const response = await fetch(`/api/node-clips?nodeId=${encodeURIComponent(fromNodeId)}`, { cache: 'no-store' })
        const payload = (await response.json()) as {
          groups?: {
            related_reference?: ClipArchiveRecord[]
          }
        }
        const followUpClips = payload.groups?.related_reference ?? []
        if (!active || !response.ok) return

        const mapped = [
          ...followUpClips.map((clip) =>
            clipArchiveToCuratedClip(clip, { nodeId: toNodeId, category: 'Connection', levelLabel: 'Archiv' })
          ),
          ...getCuratedClipsForNode(toNodeId),
        ].filter((clip, index, array) => array.findIndex((entry) => entry.sourceUrl === clip.sourceUrl) === index)

        if (mapped.length === 0) return

        setConnectionClipOverrides((current) => ({
          ...current,
          [getEdgeKey(edge.from, edge.to)]: mapped,
        }))
      } catch {
        if (!active) return
      }
    }

    void loadConnectionClips()
    return () => {
      active = false
    }
  }, [detailEdge, plan.nodes])

  useEffect(() => {
    if (detailEdge || !detailNode) return
    const sourceNodeId = detailNode.sourceNodeId ?? detailNode.id

    if (nodeClipOverrides[sourceNodeId]) return

    const curatedClips = getCuratedClipsForNode(sourceNodeId)
    const aliasIds: string[] = []
    if (detailNode.sourceNodeId && detailNode.sourceNodeId !== detailNode.id) {
      aliasIds.push(detailNode.sourceNodeId)
    }
    const matchingTitle = detailNode.title.trim().toLowerCase()
    const customTechniques = readCustomTechniques()
    for (const ct of customTechniques) {
      if (ct.title.trim().toLowerCase() === matchingTitle) {
        aliasIds.push(ct.id)
      }
    }

    let active = true
    async function loadNodeClips() {
      try {
        const aliasParam = aliasIds.length > 0 ? `&aliasIds=${encodeURIComponent(aliasIds.join(','))}` : ''
        const response = await fetch(`/api/node-clips?nodeId=${encodeURIComponent(sourceNodeId)}${aliasParam}`, { cache: 'no-store' })
        const payload = (await response.json()) as {
          groups?: {
            main_reference?: ClipArchiveRecord[]
            counter_reference?: ClipArchiveRecord[]
            drill_reference?: ClipArchiveRecord[]
            related_reference?: ClipArchiveRecord[]
          }
        }
        if (!active || !response.ok) return

        const groups = payload.groups
        if (!groups) return

        const allArchiveClips = [
          ...(groups.main_reference ?? []),
          ...(groups.counter_reference ?? []),
          ...(groups.drill_reference ?? []),
          ...(groups.related_reference ?? []),
        ]

        const archiveMapped = allArchiveClips.map((clip) =>
          clipArchiveToCuratedClip(clip, { nodeId: sourceNodeId, category: detailNode.title, levelLabel: 'Archiv' })
        )

        if (archiveMapped.length === 0 && curatedClips.length === 0) return

        const seen = new Set<string>()
        const merged: CuratedClip[] = []
        for (const clip of [...curatedClips, ...archiveMapped]) {
          if (seen.has(clip.sourceUrl)) continue
          seen.add(clip.sourceUrl)
          merged.push(clip)
        }

        setNodeClipOverrides((current) => ({
          ...current,
          [sourceNodeId]: merged,
        }))
      } catch {
        if (!active) return
      }
    }

    void loadNodeClips()
    return () => {
      active = false
    }
  }, [detailEdge, detailNode, nodeClipOverrides])

  useEffect(() => {
    async function loadCreatorProfile() {
      const user = await waitForAuthenticatedUser(supabase)
      if (!user) return

      const profileResult = await supabase
        .from('user_profiles')
        .select('username, full_name, avatar_url, gym_name, gym_unlisted_name, primary_archetype')
        .eq('id', user.id)
        .maybeSingle()

      const profile = profileResult.data as {
        username?: string | null
        full_name?: string | null
        avatar_url?: string | null
        gym_name?: string | null
        gym_unlisted_name?: string | null
        primary_archetype?: string | null
      } | null

      const name = profile?.username ?? profile?.full_name ?? user.email?.split('@')[0] ?? 'BJJ Athlete'
      const initials = name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

      setCreatorProfile({
        name,
        role: profile?.gym_name ?? profile?.gym_unlisted_name ?? 'Dein A-Plan',
        initials: initials || 'BJ',
        avatarUrl: profile?.avatar_url ?? null,
      })
      setCreatorArchetypeId(profile?.primary_archetype ?? null)
    }

    void loadCreatorProfile()
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
      const paddingX = 40
      const paddingY = 40
      const availableWidth = Math.max(1, viewport.clientWidth - paddingX * 2)
      const availableHeight = Math.max(1, viewport.clientHeight - paddingY * 2)
      const bounds = getVisibleLayoutBounds(visibleTreeIds, treeLayout.nodes)

      if (!bounds) return

      const scaleX = availableWidth / bounds.width
      const scaleY = availableHeight / bounds.height
      const nextScale = Math.min(1.08, Math.max(0.32, Math.min(scaleX, scaleY)))
      const scaledWidth = bounds.width * nextScale
      const scaledHeight = bounds.height * nextScale
      const nextOffset = {
        x: Math.round((viewport.clientWidth - scaledWidth) / 2 - bounds.minLeft * nextScale),
        y: Math.round((viewport.clientHeight - scaledHeight) / 2 - bounds.minTop * nextScale),
      }
      scaleRef.current = nextScale
      offsetRef.current = nextOffset
      setScale(nextScale)
      setOffset(nextOffset)
    }

    fitToViewport()
    window.addEventListener('resize', fitToViewport)
    return () => window.removeEventListener('resize', fitToViewport)
  }, [treeLayout.nodes, userAdjusted, visibleTreeIds])

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setUserAdjusted(true)
    const viewport = viewportRef.current
    if (!viewport) return

    const rect = viewport.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const delta = event.deltaY > 0 ? -0.08 : 0.08
    applyZoomAtPoint(scaleRef.current + delta, pointerX, pointerY)
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
    const nextOffset = {
      x: x + (event.clientX - startX),
      y: y + (event.clientY - startY),
    }
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  function handleNodeClick(nodeId: string) {
    const node = plan.nodes[nodeId]
    if (!node) return

    if (detailOpen && detailNodeId === nodeId) {
      setDetailOpen(false)
      setActiveNodeId(plan.mainPath[0])
      setDetailNodeId(plan.mainPath[0])
      setDetailEdgeKey(null)
      setUserAdjusted(false)
      return
    }

    setDetailNodeId(nodeId)
    setDetailEdgeKey(null)
    setDetailOpen(true)
    setActiveNodeId(nodeId)
    setUserAdjusted(true)
  }

  function handleEdgeClick(fromId: string, toId: string) {
    if (!plan.nodes[fromId] || !plan.nodes[toId]) return
    const fromNode = plan.nodes[fromId]
    const toNode = plan.nodes[toId]
    const edgeLocked =
      fromNode.state === 'locked' ||
      fromNode.state === 'silhouette' ||
      toNode.state === 'locked' ||
      toNode.state === 'silhouette'
    if (edgeLocked) return

    setActiveNodeId(fromId)
    setDetailNodeId(toId)
    setDetailEdgeKey(getEdgeKey(fromId, toId))
    setDetailOpen(true)
    setUserAdjusted(true)
  }

  function handleZoomOut(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    const viewport = viewportRef.current
    if (!viewport) return
    setUserAdjusted(true)
    const pointerX = viewport.clientWidth / 2
    const pointerY = viewport.clientHeight / 2
    applyZoomAtPoint(scaleRef.current - 0.1, pointerX, pointerY)
  }

  function handleZoomIn(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    const viewport = viewportRef.current
    if (!viewport) return
    setUserAdjusted(true)
    const pointerX = viewport.clientWidth / 2
    const pointerY = viewport.clientHeight / 2
    applyZoomAtPoint(scaleRef.current + 0.1, pointerX, pointerY)
  }

  async function handleSelectPlan(plan: RemoteGameplan) {
    const nextDisabledPlanIds = availablePlans.filter((entry) => entry.id !== plan.id).map((entry) => entry.id)

    setForceOverview(false)
    setPersistedActivePlanId(plan.id)
    setDisabledPlanIds(nextDisabledPlanIds)
    setSelectedPlanId(plan.id)
    setRemotePlan(plan)
    // Reset view state for new plan
    setActiveNodeId(plan.mainPath[0])
    setDetailNodeId(plan.mainPath[0])
    setDetailEdgeKey(null)
    setDetailOpen(false)
    setUserAdjusted(false)
    setShowAllNodes(false)

    // Reload plans in background to get updated states
    try {
      const response = await fetch('/api/gameplan/list', { cache: 'no-store', headers: await getAuthHeaders() })
      if (response.ok) {
        const payload = await response.json()
        const plans = (payload.plans ?? []) as RemoteGameplan[]
        const refreshedPlan = plans.find((p) => p.id === plan.id)
        if (refreshedPlan) {
          setRemotePlan(refreshedPlan)
        }
        setAvailablePlans(plans)
      }
    } catch (error) {
      console.error('Error refreshing gameplans:', error)
    }

    void (async () => {
      try {
        const authHeaders = await getAuthHeaders()
        const response = await fetch('/api/gameplan/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(authHeaders.entries()),
          },
          body: JSON.stringify({ disabledPlanIds: nextDisabledPlanIds, activePlanId: plan.id }),
        })

        if (!response.ok) {
          throw new Error('Failed to persist active gameplan')
        }
      } catch (error) {
        console.error('Failed to persist active gameplan:', error)
      }
    })()
  }

  async function handleBackToOverview() {
    setForceOverview(true)
    setSelectedPlanId(null)
    setRemotePlan(null)
    setDetailOpen(false)
    setShowAllNodes(false)
    setUserAdjusted(false)

    // Reload plans to get updated progress/unlock states
    try {
      const response = await fetch('/api/gameplan/list', { cache: 'no-store', headers: await getAuthHeaders() })
      if (response.ok) {
        const payload = await response.json()
        const plans = (payload.plans ?? []) as RemoteGameplan[]
        const persistedDisabledPlanIds = Array.isArray(payload.disabledPlanIds)
          ? payload.disabledPlanIds.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
          : []
        const activePlanId = typeof payload.activePlanId === 'string' ? payload.activePlanId : null
        setDisabledPlanIds(persistedDisabledPlanIds)
        setPersistedActivePlanId(activePlanId)
        setAvailablePlans(plans)
      }
    } catch (error) {
      console.error('Error reloading gameplans:', error)
    }
  }

  function togglePlanEnabled(planId: string) {
    const previousDisabledPlanIds = disabledPlanIds
    const isCurrentlyDisabled = disabledPlanIds.includes(planId)
    const nextDisabledPlanIds = isCurrentlyDisabled
      ? availablePlans.filter((entry) => entry.id !== planId).map((entry) => entry.id)
      : [...disabledPlanIds, planId]
    const nextActivePlanId =
      isCurrentlyDisabled ? planId : planId === persistedActivePlanId && nextDisabledPlanIds.includes(planId) ? null : persistedActivePlanId

    setDisabledPlanIds(nextDisabledPlanIds)
    setPersistedActivePlanId(nextActivePlanId)

    void (async () => {
      try {
        const authHeaders = await getAuthHeaders()
        const response = await fetch('/api/gameplan/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(authHeaders.entries()),
          },
          body: JSON.stringify({ disabledPlanIds: nextDisabledPlanIds, activePlanId: nextActivePlanId }),
        })

        if (!response.ok) {
          throw new Error('Failed to persist disabled gameplans')
        }
      } catch (error) {
        console.error('Failed to persist disabled gameplans:', error)
        setDisabledPlanIds(previousDisabledPlanIds)
        setPersistedActivePlanId(persistedActivePlanId)
      }
    })()
  }

  // Format date helper
  function formatDate(value?: string) {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(value))
    } catch {
      return value
    }
  }

  return (
    <div className={`${shouldRenderSelectedPlan ? 'fixed inset-0 z-10 bg-transparent lg:static lg:inset-auto lg:z-auto' : 'min-h-screen bg-transparent px-3 py-4 md:px-5 md:py-5'}`}>
      {gameplanUnlockAnimation ? (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <div className="start-home-unlock-vignette absolute inset-0" />
          <div className="absolute inset-x-4 top-24 flex justify-center md:inset-x-8">
            <div className="start-home-unlock-banner max-w-xl rounded-full border border-bjj-gold/20 bg-[rgba(12,16,24,0.82)] px-5 py-3 text-center backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bjj-gold/75">Neue Technik im Gameplan freigeschaltet</p>
              <p className="mt-2 text-lg font-black text-white md:text-xl">{gameplanUnlockAnimation.nextTitle}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{gameplanUnlockAnimation.nextLabel}</p>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="start-home-unlock-lock-icon relative">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-bjj-gold/60">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div className="start-home-unlock-particle" style={{ '--dx': '-50px', '--dy': '-40px' } as React.CSSProperties} />
              <div className="start-home-unlock-particle" style={{ '--dx': '50px', '--dy': '-45px' } as React.CSSProperties} />
              <div className="start-home-unlock-particle" style={{ '--dx': '-60px', '--dy': '30px' } as React.CSSProperties} />
              <div className="start-home-unlock-particle" style={{ '--dx': '45px', '--dy': '50px' } as React.CSSProperties} />
              <div className="start-home-unlock-particle" style={{ '--dx': '0px', '--dy': '-70px' } as React.CSSProperties} />
              <div className="start-home-unlock-particle" style={{ '--dx': '-80px', '--dy': '0px' } as React.CSSProperties} />
              <div className="start-home-unlock-particle" style={{ '--dx': '70px', '--dy': '20px' } as React.CSSProperties} />
              <div className="start-home-unlock-particle" style={{ '--dx': '20px', '--dy': '80px' } as React.CSSProperties} />
            </div>
          </div>
          <div className="absolute bottom-24 inset-x-8 flex justify-center md:inset-x-16">
            <div className="start-home-unlock-progress-bar w-full max-w-md">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.25em] text-white/40">
                <span>{gameplanUnlockAnimation.previousTitle ?? 'Vorherige Technik'}</span>
                <span className="text-bjj-gold start-home-unlock-count">{gameplanUnlockAnimation.nextTitle}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10 border border-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 start-home-unlock-progress-fill-bar" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full h-full">
        <section className={shouldRenderSelectedPlan ? 'h-full' : 'space-y-6'}>
          {/* Header Section */}
          <div className={`relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-[linear-gradient(135deg,rgba(17,20,30,0.98),rgba(11,14,21,0.94))] shadow-[0_28px_70px_rgba(0,0,0,0.28)] ${hasSelectedPlan || !remotePlanLoaded ? 'hidden' : ''}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,191,88,0.3),transparent_24%),radial-gradient(circle_at_74%_20%,rgba(122,162,255,0.28),transparent_26%),radial-gradient(circle_at_68%_72%,rgba(238,98,149,0.22),transparent_24%),linear-gradient(135deg,rgba(24,29,42,0.16),rgba(8,11,17,0.08))]" />
            <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.02)_22%,transparent_22%),linear-gradient(145deg,transparent_0%,transparent_54%,rgba(255,255,255,0.08)_54%,rgba(255,255,255,0.01)_74%,transparent_74%)] mix-blend-screen" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,8,13,0.84)_0%,rgba(8,11,17,0.72)_34%,rgba(8,11,17,0.38)_58%,rgba(8,11,17,0.08)_100%)]" />

            <div className="relative px-6 py-6 sm:px-7 sm:py-6 lg:px-8 lg:py-6">
                <div className="flex max-w-[64rem] flex-col gap-4 lg:gap-4">
                <div className="flex flex-col gap-4 text-white sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 overflow-hidden">
                    <h1 className="min-w-0 whitespace-nowrap pb-1 font-display text-[clamp(2.35rem,5.2vw,4.8rem)] font-black leading-[1.08] text-white">
                      {'Gamepläne'}
                    </h1>
                  </div>
                  {!hasSelectedPlan ? (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center justify-center rounded-full border border-bjj-gold/35 bg-bjj-gold/12 px-5 py-2.5 text-sm font-semibold text-bjj-gold transition hover:bg-bjj-gold/18"
                    >
                      Gameplan erstellen
                    </button>
                  ) : null}
                </div>

                {!hasSelectedPlan ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-white/78">
                    <span className="text-white/55">Wähle einen Gameplan aus, um zu starten</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-white/78">
                    <Link href={plan.creatorProfileHref} className="inline-flex items-center gap-3 transition hover:text-white">
                      {resolvedCreatorAvatarUrl ? (
                        <img src={resolvedCreatorAvatarUrl} alt={resolvedCreatorName} className="h-10 w-10 rounded-full border border-white/12 object-cover" />
                      ) : (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-[12px] font-black uppercase tracking-[0.18em] text-white">
                          {resolvedCreatorInitials}
                        </span>
                      )}
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold text-white">{resolvedCreatorName}</span>
                        <span className="text-xs text-white/55">{resolvedCreatorRole}</span>
                      </span>
                    </Link>
                    {reviewUnlocked ? (
                      <Link
                        href="/review"
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-bjj-gold/35 bg-bjj-gold/12 px-4 py-2 text-sm font-semibold text-bjj-gold transition hover:bg-bjj-gold/18"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Review freigeschaltet
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Plan Selection Overview - Show when no plan selected */}
          {!hasSelectedPlan ? (
            <div className="space-y-5">
              {!remotePlanLoaded ? (
                <div className="flex min-h-[60vh] items-center justify-center">
                  <div className="rounded-full border border-white/10 bg-[rgba(10,14,22,0.78)] px-5 py-3 text-sm font-semibold text-white/72 backdrop-blur-md">
                    Gamepläne werden geladen...
                  </div>
                </div>
              ) : availablePlans.length === 0 ? (
                <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,25,36,0.96),rgba(12,16,24,0.95))] p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
                    <Target className="h-7 w-7 text-white/40" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white">Keine Gamepläne verfügbar</h3>
                  <p className="mt-2 text-sm text-white/55">Es sind noch keine Gamepläne für dich freigeschaltet.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {availablePlans.map((plan) => {
                    const enabled = !disabledPlanIds.includes(plan.id)

                    return (
                    <article
                      key={plan.id}
                      role={enabled ? 'button' : undefined}
                      tabIndex={enabled ? 0 : undefined}
                      onClick={enabled ? () => handleSelectPlan(plan) : undefined}
                      onKeyDown={
                        enabled
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleSelectPlan(plan)
                              }
                            }
                          : undefined
                      }
                      className={`group relative overflow-hidden rounded-[1.6rem] border bg-[linear-gradient(180deg,rgba(19,25,36,0.96),rgba(12,16,24,0.95))] text-left transition ${
                        enabled
                          ? 'cursor-pointer border-white/10 hover:-translate-y-0.5 hover:border-bjj-gold/30 focus:outline-none focus:ring-2 focus:ring-bjj-gold/50 focus:ring-offset-0'
                          : 'border-white/8 opacity-70'
                      }`}
                    >
                      <div 
                        className="h-36 w-full bg-[linear-gradient(135deg,rgba(255,177,86,0.08),rgba(24,31,46,0.18))] bg-cover bg-center" 
                        style={plan.heroImageUrl ? { backgroundImage: `linear-gradient(135deg,rgba(10,14,22,0.22),rgba(10,14,22,0.72)), url(${plan.heroImageUrl})` } : undefined} 
                      />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-black text-white">{plan.title}</p>
                            <p className="mt-1 text-sm text-white/58">{plan.headline}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/62">{plan.status}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                togglePlanEnabled(plan.id)
                              }}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                enabled
                                  ? 'bg-bjj-gold/10 text-bjj-gold transition hover:bg-bjj-gold/18'
                                  : 'bg-white/[0.05] text-white/52 transition hover:bg-white/[0.09] hover:text-white/70'
                              }`}
                            >
                              {enabled ? 'Aktiv' : 'Inaktiv'}
                            </button>
                          </div>
                        </div>
                        <Link
                          href={plan.creatorProfileHref}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-4 flex items-center gap-3 rounded-xl transition hover:text-white"
                        >
                          {plan.creatorAvatarUrl ? (
                            <img src={plan.creatorAvatarUrl} alt={plan.creatorName} className="h-8 w-8 rounded-full border border-white/10 object-cover" />
                          ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[10px] font-black text-white/70">
                              {plan.creatorInitials}
                            </span>
                          )}
                          <span className="text-sm text-white/60">{plan.creatorName}</span>
                        </Link>
                        {plan.unlockSummary && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                              <span>Fortschritt</span>
                              <span>{plan.unlockSummary.coreCompletedCount + plan.unlockSummary.expansionCompletedCount}/{plan.unlockSummary.coreTotalCount + plan.unlockSummary.expansionTotalCount}</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div 
                                className="h-full rounded-full bg-[linear-gradient(90deg,#d99f5c,#f0c27b)]" 
                                style={{ 
                                  width: `${Math.max(0, Math.round(((plan.unlockSummary.coreCompletedCount + plan.unlockSummary.expansionCompletedCount) / Math.max(1, plan.unlockSummary.coreTotalCount + plan.unlockSummary.expansionTotalCount)) * 100))}%` 
                                }} 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  )})}
                </div>
              )}
            </div>
          ) : (
            /* Selected Plan View */
            <div className="h-screen lg:h-auto">
              <div
                ref={viewportRef}
                className="relative h-full min-h-screen overflow-auto border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(217,137,88,0.08),transparent_22%),radial-gradient(circle_at_top_right,rgba(109,128,255,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(150,108,255,0.06),transparent_24%),linear-gradient(180deg,rgba(12,16,24,0.94),rgba(11,15,23,0.92))] select-none lg:h-auto lg:min-h-screen lg:overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsPanning(false)}
                onMouseLeave={() => setIsPanning(false)}
                style={{ cursor: isPanning ? 'grabbing' : 'grab', overscrollBehavior: 'contain' }}
              >
                <div
                  className="absolute top-5 z-20 flex flex-col gap-2 transition-[left] duration-300"
                  style={{ left: 'calc(var(--app-sidebar-width, 96px) - var(--app-sidebar-collapsed-width, 96px) + 1.25rem)' }}
                >
                  <div className="flex items-center gap-3">
                    {false && (
                      <div className="relative">
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => setShowPlanSelector((current) => !current)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-[rgba(10,14,22,0.78)] px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:bg-[rgba(18,23,33,0.88)]"
                        >
                          <span className="max-w-[150px] truncate">{remotePlan?.title ?? 'Gameplan'}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${showPlanSelector ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showPlanSelector && (
                          <div className="absolute left-0 top-full mt-2 w-72 rounded-[1.2rem] border border-white/10 bg-[#131823] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                            <p className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.16em] text-white/40">Verfügbare Gamepläne</p>
                            {availablePlans.map((plan) => {
                              const enabled = !disabledPlanIds.includes(plan.id)
                              return (
                              <div
                                key={plan.id}
                                className={`mb-2 rounded-xl border px-3 py-3 text-left transition ${
                                  remotePlan?.id === plan.id && enabled
                                    ? 'border-bjj-gold/30 bg-bjj-gold/10'
                                    : 'border-transparent hover:bg-white/[0.05]'
                                } ${enabled ? '' : 'opacity-55'}`}
                              >
                                <div className="flex items-center gap-3">
                                  {plan.heroImageUrl ? (
                                    <img src={plan.heroImageUrl} alt={plan.title} className="h-10 w-10 rounded-lg object-cover" />
                                  ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-bjj-gold/20 to-bjj-gold/5">
                                      <span className="text-xs font-bold text-bjj-gold">{plan.creatorInitials}</span>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-white">{plan.title}</p>
                                    <p className="truncate text-xs text-white/50">{plan.headline}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      togglePlanEnabled(plan.id)
                                    }}
                                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                      enabled ? 'border-bjj-gold/25 text-bjj-gold' : 'border-white/10 text-white/62'
                                    }`}
                                  >
                                    {enabled ? 'Aktiv' : 'Inaktiv'}
                                  </button>
                                </div>
                                {enabled ? (
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={() => {
                                      handleSelectPlan(plan)
                                      setShowPlanSelector(false)
                                    }}
                                    className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:border-bjj-gold/30 hover:text-bjj-gold"
                                  >
                                    Oeffnen
                                  </button>
                                ) : null}
                              </div>
                            )})}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={handleBackToOverview}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(10,14,22,0.78)] px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md transition hover:bg-[rgba(18,23,33,0.88)]"
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                      Zurück zur Übersicht
                    </button>
                  </div>
                </div>
                {progressSummary ? (
                  <div className={`absolute left-1/2 top-6 z-20 w-[min(28rem,calc(100%-9rem))] -translate-x-1/2 px-2 text-white/88 ${gameplanUnlockAnimation ? 'gameplan-progress-celebrate' : ''}`}>
                    <p className="text-center text-[1.1rem] font-black uppercase tracking-[0.08em] text-white sm:text-[1.45rem]">
                      {planHeadline}
                    </p>
                    <div className="relative mt-3 flex items-center gap-4">
                      {gameplanUnlockAnimation ? (
                        <>
                          <span className="gameplan-progress-sparkle" style={{ '--tx': '-40px', '--ty': '-30px' } as CSSProperties} />
                          <span className="gameplan-progress-sparkle" style={{ '--tx': '40px', '--ty': '-35px' } as CSSProperties} />
                          <span className="gameplan-progress-sparkle" style={{ '--tx': '-50px', '--ty': '20px' } as CSSProperties} />
                          <span className="gameplan-progress-sparkle" style={{ '--tx': '50px', '--ty': '25px' } as CSSProperties} />
                          <span className="gameplan-progress-sparkle" style={{ '--tx': '0px', '--ty': '-50px' } as CSSProperties} />
                        </>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#d99f5c,#f0c27b)]"
                            style={{
                              width: `${Math.max(
                                unlockedTechniqueProgress.completed > 0 ? 8 : 0,
                                Math.round(
                                  (unlockedTechniqueProgress.completed /
                                    Math.max(unlockedTechniqueProgress.total, 1)) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-[0.78rem] font-black uppercase tracking-[0.22em] text-white/66 sm:text-[0.84rem]">
                        {unlockedTechniqueProgress.completed}/{Math.max(unlockedTechniqueProgress.total, 1)}
                      </div>
                    </div>
                  </div>
                ) : null}
                {!detailOpen ? (
                  <div className="absolute right-5 top-5 z-20 flex items-center gap-3">
                    <button
                      type="button"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => setShowAllNodes((current) => !current)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
                        showAllNodes
                          ? 'border-bjj-gold/40 bg-bjj-gold/15 text-bjj-gold'
                          : 'border-white/10 bg-[rgba(10,14,22,0.78)] text-white/90 backdrop-blur-md'
                      }`}
                    >
                      {showAllNodes ? 'Alle Techniken aktiv' : 'Alle Techniken anzeigen'}
                    </button>
                  </div>
                ) : null}

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
                        <path d="M0,0 L6,3 L0,6 Z" fill="rgba(240,171,60,0.76)" />
                      </marker>
                      <marker id="arrow-main-active" markerWidth="6" markerHeight="6" refX="5.6" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill="rgba(240,171,60,1)" />
                      </marker>
                      <marker id="arrow-branch" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto">
                        <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(240,171,60,0.36)" />
                      </marker>
                      <marker id="arrow-branch-active" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto">
                        <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(240,171,60,1)" />
                      </marker>
                      <marker id="arrow-locked" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto">
                        <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(148,163,184,0.34)" />
                      </marker>
                    </defs>
                    {treeLayout.edges
                      .filter((edge) => visibleTreeIds.has(edge.from) && visibleTreeIds.has(edge.to))
                      .map((edge) => {
                        const fromMeta = treeLayout.nodes.find((entry) => entry.id === edge.from)
                        const toMeta = treeLayout.nodes.find((entry) => entry.id === edge.to)
                        if (!fromMeta || !toMeta) return null
                        const edgeKey = getEdgeKey(edge.from, edge.to)

                        const fromSlot = getSlotPosition(fromMeta, fromMeta.size)
                        const toSlot = getSlotPosition(toMeta, toMeta.size)
                        const fromCenterX = fromSlot.left + fromSlot.width / 2
                        const fromCenterY = fromSlot.top + fromSlot.height / 2
                        const fromRightX = fromSlot.left + fromSlot.width
                        const fromBottomY = fromSlot.top + fromSlot.height
                        const toCenterY = toSlot.top + toSlot.height / 2
                        const toLeftX = toSlot.left

                        const isMainEdge = mainPathEdgeSet.has(edgeKey)
                        const isClosedGuardBranch =
                          edge.from === 'closed-guard' && !isMainEdge
                        const edgeLocked =
                          plan.nodes[edge.from]?.state === 'locked' ||
                          plan.nodes[edge.from]?.state === 'silhouette' ||
                          plan.nodes[edge.to]?.state === 'locked' ||
                          plan.nodes[edge.to]?.state === 'silhouette'
                        const activeEdge = !edgeLocked && activeEdgeKey === edgeKey

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
                        const highlighted = !edgeLocked && (edge.from === activeNode?.id || edge.to === activeNode?.id)

                        return (
                          <g key={`${edge.from}-${edge.to}`}>
                            <path
                              d={path}
                              fill="none"
                              stroke={
                                edgeLocked
                                  ? 'rgba(148,163,184,0.26)'
                                  : activeEdge
                                  ? 'rgba(240,171,60,0.98)'
                                  : isMainEdge
                                  ? 'rgba(240,171,60,0.88)'
                                  : highlighted
                                    ? 'rgba(240,171,60,0.42)'
                                    : 'rgba(240,171,60,0.16)'
                              }
                              strokeWidth={edgeLocked ? (isMainEdge ? 2.4 : 1.6) : activeEdge ? 4.8 : isMainEdge ? 3.4 : highlighted ? 2.1 : 1.2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              markerEnd={
                                edgeLocked
                                  ? 'url(#arrow-locked)'
                                  : activeEdge
                                  ? isMainEdge
                                    ? 'url(#arrow-main-active)'
                                    : 'url(#arrow-branch-active)'
                                  : isMainEdge
                                    ? 'url(#arrow-main)'
                                    : 'url(#arrow-branch)'
                              }
                            />
                            {activeEdge ? (
                              <path
                                d={path}
                                fill="none"
                                stroke="rgba(240,171,60,0.14)"
                                strokeWidth={8}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            ) : null}
                            <path
                              d={path}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={18}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={edgeLocked ? 'cursor-default' : 'cursor-pointer'}
                              onMouseDown={edgeLocked ? undefined : (event) => event.stopPropagation()}
                              onClick={edgeLocked ? undefined : () => handleEdgeClick(edge.from, edge.to)}
                            />
                          </g>
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
                            masked={shouldMaskNodeInOverview(node, showAllNodes, knownVisibleNodeIds)}
                            unlockTarget={unlockTargetNodeId === node.id}
                          />
                        </div>
                      )
                    })}
                </div>

                {detailOpen ? (
                  <aside className="pointer-events-auto absolute right-5 top-5 z-30 w-[360px] max-w-[calc(100%-2.5rem)]">
                    <div className="fluid-surface rounded-[1.25rem] bg-[linear-gradient(180deg,rgba(18,23,33,0.82),rgba(14,18,26,0.8))] p-3 shadow-[0_12px_26px_rgba(0,0,0,0.2)]">
                      <div className="flex items-center justify-between">
                        <p className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-bjj-gold">Videos</p>
                        <button
                          type="button"
                          onClick={() => setDetailOpen(false)}
                          className="text-xs font-black text-white/60 hover:text-white"
                        >
                          Schliessen
                        </button>
                      </div>
                      <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-white">{detailConnection?.title ?? detailNode.title}</h2>
                      <p className="mt-1 text-xs text-white/65">{detailConnection?.label ?? detailNode.label}</p>

                      <div className="mt-4">
                        <GameplanClipDeck
                          clips={detailClips}
                          detailHref={
                            detailEdge
                              ? `/node/${plan.nodes[detailEdge.to]?.sourceNodeId ?? detailNode.sourceNodeId ?? detailNode.id}`
                              : `/node/${detailNode.sourceNodeId ?? detailNode.id}`
                          }
                          detailCtaLabel="Technik oeffnen"
                        />
                      </div>
                    </div>
                  </aside>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
