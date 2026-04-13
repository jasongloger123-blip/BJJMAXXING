'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Minus, Plus, Save, Search, X } from 'lucide-react'
import { ARCHETYPES } from '@/lib/archetypes'
import { CUSTOM_TECHNIQUES_EVENT, readCustomTechniques, type CustomTechniqueRecord } from '@/lib/custom-techniques'
import { createEmptyAdminPlan, type GameplanAdminNode, type GameplanAdminPlan, type GameplanProfileOption } from '@/lib/gameplans'
import { uploadGameplanHeroImage } from '@/lib/supabase/storage'
import { createClient } from '@/lib/supabase/client'

const NODE_WIDTH = { main: 264, branch: 224, future: 206 } as const
const NODE_HEIGHT = { main: 158, branch: 136, future: 122 } as const
const ADMIN_CANVAS_MIN_WIDTH = 4200
const ADMIN_CANVAS_MIN_HEIGHT = 1200
const ADMIN_CANVAS_PAD_X = 5200
const ADMIN_CANVAS_PAD_Y = 3200
const SIZE_LABELS = { main: 'A-Plan', branch: 'B-Plan', future: 'Extra' } as const
const TRACK_LABELS = { foundation: 'Foundation', secondary: 'Secondary', 'top-game': 'Top Game' } as const
const DEFAULT_SECTIONS = ['plans', 'settings', 'technique', 'connections', 'assignments'] as const
const STAGE_META = {
  position: {
    title: 'Position',
    border: 'border-[#3d5fa5]/70',
    surface: 'from-[#121d31] via-[#151b2a] to-[#131721]',
    pill: 'text-[#89afff]',
    line: 'from-[#6b94ff]/70 to-[#6b94ff]/15',
  },
  pass: {
    title: 'Pass',
    border: 'border-[#8d532c]/70',
    surface: 'from-[#241813] via-[#1c1714] to-[#171418]',
    pill: 'text-[#f0b37a]',
    line: 'from-[#cf8648]/70 to-[#cf8648]/15',
  },
  submission: {
    title: 'Submission',
    border: 'border-[#456d45]/70',
    surface: 'from-[#142216] via-[#141d17] to-[#131816]',
    pill: 'text-[#a9d9a6]',
    line: 'from-[#79bf79]/70 to-[#79bf79]/15',
  },
} as const
type SectionKey = (typeof DEFAULT_SECTIONS)[number]
type TechniqueTrack = CustomTechniqueRecord['track']
type PickerTechnique = {
  id: string
  title: string
  subtitle: string
  description: string
  stage: GameplanAdminNode['stage']
  track: TechniqueTrack
  level: number
  sourceNodeId: string | null
  outcome: string
  focus: string[]
  mistakes: string[]
  recommendedArchetypeIds: string[]
}

const asLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean)
const formatDate = (value: string) => { try { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value } }
const centerOf = (node: GameplanAdminNode) => ({
  x: ADMIN_CANVAS_PAD_X + node.x + NODE_WIDTH[node.size] / 2,
  y: ADMIN_CANVAS_PAD_Y + node.y + NODE_HEIGHT[node.size] / 2,
})

function deriveMainPath(plan: GameplanAdminPlan) {
  const mainIds = plan.nodes
    .filter((node) => node.unlockPhase === 'core')
    .sort((a, b) => (a.unlockOrder ?? Number.MAX_SAFE_INTEGER) - (b.unlockOrder ?? Number.MAX_SAFE_INTEGER) || a.orderIndex - b.orderIndex)
    .map((node) => node.id)
  return mainIds.length > 0 ? mainIds : plan.mainPathNodeIds
}

function getCoreNodes(plan: GameplanAdminPlan) {
  return plan.nodes
    .filter((node) => node.unlockPhase === 'core')
    .sort((a, b) => (a.unlockOrder ?? Number.MAX_SAFE_INTEGER) - (b.unlockOrder ?? Number.MAX_SAFE_INTEGER) || a.orderIndex - b.orderIndex)
}

function getIncomingParentMap(plan: GameplanAdminPlan) {
  const map = new Map<string, string>()
  plan.edges.forEach((edge) => {
    if (!map.has(edge.toNodeId)) {
      map.set(edge.toNodeId, edge.fromNodeId)
    }
  })
  return map
}

function relayoutPlan(plan: GameplanAdminPlan) {
  const coreNodes = getCoreNodes(plan)
  const incomingParentMap = getIncomingParentMap(plan)
  const coreIndexMap = new Map(coreNodes.map((node, index) => [node.id, index]))
  const coreY = 240
  const coreStartX = 160
  const coreGap = 340
  const branchOffsetX = 56
  const branchOffsetY = 220
  const futureOffsetY = 380
  const groupedExpansionMap = new Map<string, GameplanAdminNode[]>()

  plan.nodes
    .filter((node) => node.unlockPhase !== 'core')
    .forEach((node) => {
      const fallbackCoreParentId = coreNodes[Math.max(0, coreNodes.length - 1)]?.id ?? null
      const parentId = node.unlockParentNodeId ?? incomingParentMap.get(node.id) ?? fallbackCoreParentId
      const key = parentId ?? '__unparented__'
      const bucket = groupedExpansionMap.get(key) ?? []
      bucket.push(node)
      groupedExpansionMap.set(key, bucket)
    })

  groupedExpansionMap.forEach((nodes) => {
    nodes.sort((a, b) => (a.unlockOrder ?? Number.MAX_SAFE_INTEGER) - (b.unlockOrder ?? Number.MAX_SAFE_INTEGER) || a.orderIndex - b.orderIndex)
  })

  const positionedNodes = plan.nodes.map((node) => {
    if (node.unlockPhase === 'core') {
      const index = coreNodes.findIndex((entry) => entry.id === node.id)
      return {
        ...node,
        size: 'main' as const,
        x: coreStartX + Math.max(0, index) * coreGap,
        y: coreY,
      }
    }

    const fallbackCoreParentId = coreNodes[Math.max(0, coreNodes.length - 1)]?.id ?? null
    const parentId = node.unlockParentNodeId ?? incomingParentMap.get(node.id) ?? fallbackCoreParentId
    const bucket = groupedExpansionMap.get(parentId ?? '__unparented__') ?? [node]
    const indexInBucket = Math.max(0, bucket.findIndex((entry) => entry.id === node.id))
    const parentCoreIndex =
      parentId && coreIndexMap.has(parentId)
        ? (coreIndexMap.get(parentId) ?? 0)
        : Math.max(0, coreNodes.length - 1)
    const row = Math.floor(indexInBucket / 2)
    const isUpper = indexInBucket % 2 === 0
    const parentX = coreStartX + parentCoreIndex * coreGap

    return {
      ...node,
      x: parentX + branchOffsetX + row * 26,
      y: node.size === 'future'
        ? coreY + futureOffsetY + row * 34
        : coreY + (isUpper ? -branchOffsetY : branchOffsetY) + row * 34,
    }
  })

  const maxRight = positionedNodes.reduce((max, node) => Math.max(max, node.x + NODE_WIDTH[node.size]), 1200)
  const maxBottom = positionedNodes.reduce((max, node) => Math.max(max, node.y + NODE_HEIGHT[node.size]), 760)

  return {
    ...plan,
    nodes: positionedNodes,
    canvasWidth: Math.max(2400, maxRight + 220),
    canvasHeight: Math.max(1400, maxBottom + 220),
  }
}

function edgeExists(plan: GameplanAdminPlan, fromNodeId: string, toNodeId: string) {
  return plan.edges.some((edge) =>
    (edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId) ||
    (edge.fromNodeId === toNodeId && edge.toNodeId === fromNodeId)
  )
}

function customTechniqueToPickerTechnique(node: CustomTechniqueRecord): PickerTechnique {
  return {
    id: node.id,
    title: node.title,
    subtitle: node.subtitle,
    description: node.description,
    stage: node.stage,
    track: node.track,
    level: node.level,
    sourceNodeId: node.id,
    outcome: `${node.title} sauber in deinen Plan integrieren.`,
    focus: [],
    mistakes: [],
    recommendedArchetypeIds: node.recommendedArchetypeIds ?? [],
  }
}

function pickerTechniqueToPlanNode(node: PickerTechnique, size: GameplanAdminNode['size'], index: number, x: number, y: number): GameplanAdminNode {
  return {
    id: `technique-${crypto.randomUUID().slice(0, 8)}`,
    title: node.title,
    stage: node.stage,
    label: node.subtitle,
    description: node.description,
    outcome: node.outcome,
    focus: node.focus,
    mistakes: node.mistakes,
    state: size === 'main' ? 'current' : 'available',
    expansionPaths: [],
    sourceNodeId: node.sourceNodeId,
    unlockPhase: size === 'main' ? 'core' : 'expansion',
    unlockOrder: index + 1,
    requiresValidation: false,
    unlockParentNodeId: null,
    x,
    y,
    tier: null,
    lane: null,
    size,
    orderIndex: index,
  }
}

function getStageTone(stage: GameplanAdminNode['stage'], active: boolean) {
  const meta = STAGE_META[stage]
  if (active) {
    return `${meta.border} bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.0)),linear-gradient(180deg,var(--tw-gradient-stops))] ${meta.surface} shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_16px_36px_rgba(0,0,0,0.2)]`
  }

  return `${meta.border} bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.0)),linear-gradient(180deg,var(--tw-gradient-stops))] ${meta.surface} shadow-[0_16px_34px_rgba(0,0,0,0.16)]`
}

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionKey
  title: string
  open: boolean
  onToggle: (id: SectionKey) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,33,0.92),rgba(12,16,24,0.95))]">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span className="text-xs font-black uppercase tracking-[0.24em] text-white/72">{title}</span>
        <ChevronDown className={`h-4 w-4 text-white/58 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="border-t border-white/8 px-4 py-4">{children}</div> : null}
    </div>
  )
}

export default function GameplanAdminPage() {
  const supabase = createClient()
  const [plans, setPlans] = useState<GameplanAdminPlan[]>([])
  const [profiles, setProfiles] = useState<GameplanProfileOption[]>([])
  const [currentAdminProfile, setCurrentAdminProfile] = useState<GameplanProfileOption | null>(null)
  const [customTechniques, setCustomTechniques] = useState<CustomTechniqueRecord[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    plans: false,
    settings: false,
    technique: false,
    connections: false,
    assignments: false,
  })
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerTrack, setPickerTrack] = useState<'all' | TechniqueTrack>('all')
  const [pickerStage, setPickerStage] = useState<'all' | GameplanAdminNode['stage']>('all')
  const [pickerArchetype, setPickerArchetype] = useState<'all' | string>('all')
  const [pickerSize, setPickerSize] = useState<GameplanAdminNode['size']>('main')
  const [profileQuery, setProfileQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [planSearch, setPlanSearch] = useState('')
  const [draggingTechniqueId, setDraggingTechniqueId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [connectMode, setConnectMode] = useState(false)
  const [selectedSourceNodeId, setSelectedSourceNodeId] = useState<string | null>(null)
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false)
  const [planDeleteConfirmId, setPlanDeleteConfirmId] = useState<string | null>(null)
  const dragRef = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 })
  const panRef = useRef({ x: 0, y: 0, left: 0, top: 0 })
  const zoomRef = useRef(zoom)
  const pendingZoomScrollRef = useRef<{ left: number; top: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const heroFileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) ?? null, [plans, selectedPlanId])
  const selectedTechnique = useMemo(() => selectedPlan?.nodes.find((node) => node.id === selectedTechniqueId) ?? null, [selectedPlan, selectedTechniqueId])
  const pickerTechniques = useMemo(() => customTechniques.map(customTechniqueToPickerTechnique), [customTechniques])
  const pickerTechniqueMap = useMemo(() => new Map(pickerTechniques.map((node) => [node.id, node])), [pickerTechniques])
  const filteredTechniques = useMemo(() => pickerTechniques.filter((node) => {
    const query = pickerQuery.trim().toLowerCase()
    const matchesQuery = !query || node.title.toLowerCase().includes(query) || node.subtitle.toLowerCase().includes(query) || node.description.toLowerCase().includes(query)
    const matchesArchetype = pickerArchetype === 'all' || node.recommendedArchetypeIds.includes(pickerArchetype)
    return matchesQuery && (pickerTrack === 'all' || node.track === pickerTrack) && (pickerStage === 'all' || node.stage === pickerStage) && matchesArchetype
  }), [pickerArchetype, pickerQuery, pickerStage, pickerTechniques, pickerTrack])
  const filteredProfiles = useMemo(() => profiles.filter((profile) => profile.label.toLowerCase().includes(profileQuery.trim().toLowerCase())), [profiles, profileQuery])
  const selectedProfileIds = useMemo(() => new Set(selectedPlan?.assignments.filter((a) => a.targetType === 'profile').map((a) => a.profileId).filter(Boolean)), [selectedPlan])
  const selectedArchetypeIds = useMemo(() => new Set(selectedPlan?.assignments.filter((a) => a.targetType === 'archetype').map((a) => a.archetypeId).filter(Boolean)), [selectedPlan])
  const profileLabelById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.label])), [profiles])
  const archetypeNameById = useMemo(() => new Map(ARCHETYPES.map((archetype) => [archetype.id, archetype.name])), [])
  const selectedProfileLabels = useMemo(
    () =>
      selectedPlan?.assignments
        .filter((assignment) => assignment.targetType === 'profile' && assignment.profileId && assignment.isActive)
        .map((assignment) => profileLabelById.get(assignment.profileId as string) ?? assignment.profileId)
        .filter((value, index, array) => array.indexOf(value) === index) ?? [],
    [profileLabelById, selectedPlan]
  )
  const selectedArchetypeNames = useMemo(
    () =>
      selectedPlan?.assignments
        .filter((assignment) => assignment.targetType === 'archetype' && assignment.archetypeId && assignment.isActive)
        .map((assignment) => archetypeNameById.get(assignment.archetypeId as string) ?? assignment.archetypeId)
        .filter((value, index, array) => array.indexOf(value) === index) ?? [],
    [archetypeNameById, selectedPlan]
  )
  const filteredPlans = useMemo(() => plans.filter((plan) => {
    const query = planSearch.trim().toLowerCase()
    if (!query) return true
    return plan.title.toLowerCase().includes(query) || plan.headline.toLowerCase().includes(query) || plan.slug.toLowerCase().includes(query)
  }), [planSearch, plans])

  useEffect(() => { void loadData() }, [])

  useEffect(() => {
    const sync = () => setCustomTechniques(readCustomTechniques())
    sync()
    window.addEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
    return () => window.removeEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
  }, [])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const pendingScroll = pendingZoomScrollRef.current
    if (!canvas || !pendingScroll) return

    canvas.scrollLeft = Math.max(0, Math.round(pendingScroll.left))
    canvas.scrollTop = Math.max(0, Math.round(pendingScroll.top))
    pendingZoomScrollRef.current = null
  }, [zoom])

  useEffect(() => {
    if (!selectedPlanId) return
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.scrollLeft = Math.max(0, Math.round(ADMIN_CANVAS_PAD_X * zoomRef.current - 160))
      canvas.scrollTop = Math.max(0, Math.round(ADMIN_CANVAS_PAD_Y * zoomRef.current - 120))
    })
  }, [selectedPlanId])

  useEffect(() => {
    if (planDeleteConfirmId && planDeleteConfirmId !== selectedPlanId) {
      setPlanDeleteConfirmId(null)
    }
  }, [planDeleteConfirmId, selectedPlanId])

  useEffect(() => {
    if (!draggingTechniqueId || !selectedPlanId) return
    const move = (event: MouseEvent) => {
      setPlans((current) => current.map((plan) => {
        if (plan.id !== selectedPlanId) return plan
        const nodes = plan.nodes.map((node) => node.id === draggingTechniqueId
          ? {
              ...node,
              x: Math.max(0, Math.round(dragRef.current.nodeX + (event.clientX - dragRef.current.x) / zoom)),
              y: Math.max(0, Math.round(dragRef.current.nodeY + (event.clientY - dragRef.current.y) / zoom)),
            }
          : node)
        return { ...plan, nodes, mainPathNodeIds: deriveMainPath({ ...plan, nodes }) }
      }))
    }
    const stop = () => setDraggingTechniqueId(null)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop) }
  }, [draggingTechniqueId, selectedPlanId, zoom])

  useEffect(() => {
    if (!isPanning) return
    const move = (event: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x)
      canvas.scrollTop = panRef.current.top - (event.clientY - panRef.current.y)
    }
    const stop = () => setIsPanning(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop) }
  }, [isPanning])

  useEffect(() => {
    if (!connectMode) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConnectMode(false)
        setSelectedSourceNodeId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [connectMode])

  async function getAuthHeaders(includeJson = false) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers = new Headers()
    if (includeJson) headers.set('Content-Type', 'application/json')
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
    return headers
  }

  async function loadData() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/gameplans', { cache: 'no-store', headers: await getAuthHeaders() })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Gameplan Admin konnte nicht geladen werden.')
      const nextPlans = (payload.plans ?? []) as GameplanAdminPlan[]
      setPlans(nextPlans)
      setProfiles((payload.profiles ?? []) as GameplanProfileOption[])
      setCurrentAdminProfile((payload.currentAdminProfile ?? null) as GameplanProfileOption | null)
      setSelectedPlanId(null)
      setSelectedTechniqueId(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unbekannter Fehler.')
    } finally {
      setLoading(false)
    }
  }

  async function persist(action: 'save' | 'duplicate', plan?: GameplanAdminPlan) {
    if (!selectedPlan && !plan) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/gameplans', {
        method: 'POST',
        headers: await getAuthHeaders(true),
        body: JSON.stringify(action === 'duplicate' ? { action, planId: selectedPlan?.id } : { action, plan: plan ? { ...plan, mainPathNodeIds: deriveMainPath(plan) } : plan }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Speichern fehlgeschlagen.')
      const nextPlans = (payload.plans ?? []) as GameplanAdminPlan[]
      setPlans(nextPlans)
      setProfiles((payload.profiles ?? []) as GameplanProfileOption[])
      setCurrentAdminProfile((payload.currentAdminProfile ?? null) as GameplanProfileOption | null)
      const targetPlanId = plan?.id ?? selectedPlan?.id ?? nextPlans[0]?.id ?? null
      setSelectedPlanId(targetPlanId)
      const refreshedPlan = nextPlans.find((entry) => entry.id === targetPlanId) ?? null
      setSelectedTechniqueId((current) => refreshedPlan?.nodes.some((node) => node.id === current) ? current : null)
      setMessage(action === 'duplicate' ? 'Plan dupliziert.' : 'Gameplan gespeichert.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unbekannter Fehler.')
    } finally {
      setSaving(false)
    }
  }

  async function publishSelectedPlan() {
    if (!selectedPlan) return
    await persist('save', { ...selectedPlan, status: 'published' })
  }

  async function deleteSelectedPlan() {
    if (!selectedPlan) return

    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/gameplans', {
        method: 'POST',
        headers: await getAuthHeaders(true),
        body: JSON.stringify({ action: 'delete', planId: selectedPlan.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Loeschen fehlgeschlagen.')

      const nextPlans = (payload.plans ?? []) as GameplanAdminPlan[]
      setPlans(nextPlans)
      setProfiles((payload.profiles ?? []) as GameplanProfileOption[])
      setCurrentAdminProfile((payload.currentAdminProfile ?? null) as GameplanProfileOption | null)
      setSelectedPlanId(null)
      setSelectedTechniqueId(null)
      setPlanDeleteConfirmId(null)
      setMessage('Gameplan geloescht.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unbekannter Fehler.')
    } finally {
      setSaving(false)
    }
  }

  function updatePlan(mutator: (plan: GameplanAdminPlan) => GameplanAdminPlan) {
    if (!selectedPlan) return
    setPlans((current) => current.map((plan) => {
      if (plan.id !== selectedPlan.id) return plan
      const next = mutator(plan)
      return { ...next, mainPathNodeIds: deriveMainPath(next) }
    }))
  }

  function updateTechnique(mutator: (node: GameplanAdminNode) => GameplanAdminNode) {
    if (!selectedTechnique) return
    updatePlan((plan) => ({ ...plan, nodes: plan.nodes.map((node) => node.id === selectedTechnique.id ? mutator(node) : node) }))
  }

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  function createPlan() {
    const next = createEmptyAdminPlan()
    setPlans((current) => [next, ...current])
    setSelectedPlanId(next.id)
    setSelectedTechniqueId(null)
    setOpenSections((current) => ({ ...current, technique: true }))
  }

  async function handleHeroImageUpload(file: File) {
    if (!selectedPlan) return
    setUploadingHeroImage(true)
    const result = await uploadGameplanHeroImage(file, selectedPlan.id)
    setUploadingHeroImage(false)

    if ('error' in result) {
      setMessage(result.error ?? 'Upload fehlgeschlagen.')
      return
    }

    updatePlan((plan) => ({ ...plan, heroImageUrl: result.url }))
    setMessage('Titelbild hochgeladen.')
  }

  function addTechniqueAt(node: PickerTechnique, x: number, y: number) {
    if (!selectedPlan) return
    const next = pickerTechniqueToPlanNode(node, pickerSize, selectedPlan.nodes.length, x, y)
    updatePlan((plan) => relayoutPlan({ ...plan, nodes: [...plan.nodes, next] }))
    setSelectedTechniqueId(next.id)
  }

  function addTechnique(node: PickerTechnique) {
    if (!selectedPlan) return
    const index = selectedPlan.nodes.length
    addTechniqueAt(node, 120 + index * 40, 120 + index * 28)
  }

  function removeTechnique() {
    if (!selectedTechnique) return
    updatePlan((plan) => relayoutPlan({
      ...plan,
      nodes: plan.nodes.filter((node) => node.id !== selectedTechnique.id),
      edges: plan.edges.filter((edge) => edge.fromNodeId !== selectedTechnique.id && edge.toNodeId !== selectedTechnique.id),
    }))
    setSelectedTechniqueId(null)
    if (selectedSourceNodeId === selectedTechnique.id) {
      setSelectedSourceNodeId(null)
      setConnectMode(false)
    }
  }

  function startConnectMode(nodeId: string) {
    setConnectMode(true)
    setSelectedSourceNodeId(nodeId)
    setMessage('Connect Mode aktiv. Klicke jetzt auf die Ziel-Technik.')
  }

  function cancelConnectMode() {
    setConnectMode(false)
    setSelectedSourceNodeId(null)
  }

  function createConnection(fromNodeId: string, toNodeId: string) {
    if (!selectedPlan || fromNodeId === toNodeId) return
    if (edgeExists(selectedPlan, fromNodeId, toNodeId)) {
      setMessage('Zwischen diesen beiden Techniken gibt es bereits eine Connection.')
      cancelConnectMode()
      return
    }
    updatePlan((plan) => relayoutPlan({
      ...plan,
      edges: [...plan.edges, { id: crypto.randomUUID(), fromNodeId, toNodeId, label: null, orderIndex: plan.edges.length }],
      nodes: plan.nodes.map((node) => node.id === toNodeId && node.unlockPhase !== 'core' && !node.unlockParentNodeId
        ? { ...node, unlockParentNodeId: fromNodeId }
        : node),
    }))
    cancelConnectMode()
  }

  function handleCanvasNodeClick(nodeId: string) {
    if (connectMode && selectedSourceNodeId) {
      if (selectedSourceNodeId === nodeId) return
      createConnection(selectedSourceNodeId, nodeId)
      return
    }

    setSelectedTechniqueId((current) => current === nodeId ? null : nodeId)
  }

  function relayoutSelectedPlan() {
    updatePlan((plan) => relayoutPlan(plan))
  }

  function toggleProfile(profileId: string) {
    updatePlan((plan) => {
      const exists = plan.assignments.some((assignment) => assignment.targetType === 'profile' && assignment.profileId === profileId)
      return {
        ...plan,
        assignments: exists
          ? plan.assignments.filter((assignment) => !(assignment.targetType === 'profile' && assignment.profileId === profileId))
          : [...plan.assignments, { id: crypto.randomUUID(), targetType: 'profile', profileId, archetypeId: null, priority: plan.assignments.length, isActive: true }],
      }
    })
  }

  function toggleArchetype(archetypeId: string) {
    updatePlan((plan) => {
      const exists = plan.assignments.some((assignment) => assignment.targetType === 'archetype' && assignment.archetypeId === archetypeId)
      return {
        ...plan,
        assignments: exists
          ? plan.assignments.filter((assignment) => !(assignment.targetType === 'archetype' && assignment.archetypeId === archetypeId))
          : [...plan.assignments, { id: crypto.randomUUID(), targetType: 'archetype', profileId: null, archetypeId, priority: plan.assignments.length, isActive: true }],
      }
    })
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!selectedPlan) return

    const techniqueId = event.dataTransfer.getData('application/x-bjj-technique')
    const technique = pickerTechniqueMap.get(techniqueId)
    const canvas = canvasRef.current
    if (!technique || !canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.max(
      0,
      Math.round((event.clientX - rect.left + canvas.scrollLeft) / zoom - ADMIN_CANVAS_PAD_X - NODE_WIDTH[pickerSize] / 2)
    )
    const y = Math.max(
      0,
      Math.round((event.clientY - rect.top + canvas.scrollTop) / zoom - ADMIN_CANVAS_PAD_Y - NODE_HEIGHT[pickerSize] / 2)
    )
    addTechniqueAt(technique, x, y)
  }

  function beginCanvasPan(clientX: number, clientY: number, clearSelection = true) {
    const canvas = canvasRef.current
    if (!canvas) return
    panRef.current = { x: clientX, y: clientY, left: canvas.scrollLeft, top: canvas.scrollTop }
    setIsPanning(true)
    if (clearSelection) {
      setSelectedTechniqueId(null)
    }
    cancelConnectMode()
  }

  function startCanvasPan(event: React.MouseEvent<HTMLDivElement>) {
    beginCanvasPan(event.clientX, event.clientY)
  }

  function applyCanvasZoomAtPoint(nextZoom: number, pointerX: number, pointerY: number) {
    const canvas = canvasRef.current
    if (!canvas) return

    const currentZoom = zoomRef.current
    const clampedZoom = Math.min(1.8, Math.max(0.45, Number(nextZoom.toFixed(3))))

    if (clampedZoom === currentZoom) {
      return
    }

    // Calculate the point in content coordinates (before zoom change)
    const contentX = (canvas.scrollLeft + pointerX) / currentZoom
    const contentY = (canvas.scrollTop + pointerY) / currentZoom

    pendingZoomScrollRef.current = {
      left: contentX * clampedZoom - pointerX,
      top: contentY * clampedZoom - pointerY,
    }
    zoomRef.current = clampedZoom
    setZoom(clampedZoom)
  }

  function handleCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const delta = event.deltaY > 0 ? -0.08 : 0.08
    applyCanvasZoomAtPoint(zoomRef.current + delta, pointerX, pointerY)
  }

  function adjustCanvasZoom(delta: number) {
    const canvas = canvasRef.current
    if (!canvas) return

    const pointerX = canvas.clientWidth / 2
    const pointerY = canvas.clientHeight / 2
    applyCanvasZoomAtPoint(zoomRef.current + delta, pointerX, pointerY)
  }

  if (loading) return <div className="h-40 rounded-3xl border border-bjj-border bg-bjj-card shimmer" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">Admin Builder</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Gameplan Admin</h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          {selectedPlan ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setSelectedPlanId(null); setSelectedTechniqueId(null); }} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/78">Zur Übersicht</button>
              <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/78">{selectedPlan.title}</div>
              <button type="button" onClick={relayoutSelectedPlan} className="rounded-2xl border border-bjj-gold/25 bg-bjj-gold/10 px-4 py-3 text-sm text-bjj-gold">Layout neu anordnen</button>
              <button type="button" onClick={() => adjustCanvasZoom(-0.1)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/72"><Minus className="h-4 w-4" /></button>
              <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/78">{Math.round(zoom * 100)}%</div>
              <button type="button" onClick={() => adjustCanvasZoom(0.1)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/72"><Plus className="h-4 w-4" /></button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1)
                  zoomRef.current = 1
                  requestAnimationFrame(() => {
                    if (canvasRef.current) {
                      canvasRef.current.scrollLeft = Math.max(0, ADMIN_CANVAS_PAD_X - 160)
                      canvasRef.current.scrollTop = Math.max(0, ADMIN_CANVAS_PAD_Y - 120)
                    }
                  })
                }}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/72"
              >
                Reset
              </button>
              {selectedTechnique ? <button type="button" onClick={removeTechnique} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/68">Technik entfernen</button> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={createPlan} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/84"><Plus className="mr-2 inline h-4 w-4" />Neuer Plan</button>
            <button type="button" disabled={!selectedPlan || saving} onClick={() => void persist('duplicate')} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/84 disabled:opacity-40"><Copy className="mr-2 inline h-4 w-4" />Duplizieren</button>
            {selectedPlan ? (
              planDeleteConfirmId === selectedPlan.id ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setPlanDeleteConfirmId(null)}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/72 disabled:opacity-40"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void deleteSelectedPlan()}
                    className="rounded-2xl border border-red-500/35 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-300 disabled:opacity-40"
                  >
                    Wirklich loeschen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPlanDeleteConfirmId(selectedPlan.id)}
                  className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 disabled:opacity-40"
                >
                  Plan loeschen
                </button>
              )
            ) : null}
            <button
              type="button"
              disabled={!selectedPlan || saving || selectedPlan.status === 'published'}
              onClick={() => void publishSelectedPlan()}
              className="rounded-2xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-sm font-semibold text-emerald-300 disabled:opacity-40"
            >
              <Save className="mr-2 inline h-4 w-4" />
              {saving ? 'Veroeffentlicht...' : selectedPlan?.status === 'published' ? 'Published' : 'Publish'}
            </button>
            <button type="button" disabled={!selectedPlan || saving} onClick={() => selectedPlan && void persist('save', selectedPlan)} className="rounded-2xl border border-bjj-gold/30 bg-bjj-gold/12 px-4 py-3 text-sm font-semibold text-bjj-gold disabled:opacity-40"><Save className="mr-2 inline h-4 w-4" />{saving ? 'Speichert...' : 'Speichern'}</button>
          </div>
        </div>
      </div>
      {message ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/78">{message}</div> : null}

      {!selectedPlan ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/46">Gameplan Übersicht</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Alle Gamepläne</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="relative block min-w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/35" />
                <input value={planSearch} onChange={(event) => setPlanSearch(event.target.value)} placeholder="Gameplan suchen..." className="w-full rounded-2xl border border-white/10 bg-[#101723] py-3 pl-10 pr-3 text-sm text-white outline-none" />
              </label>
              <button type="button" onClick={createPlan} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/84"><Plus className="mr-2 inline h-4 w-4" />Neuer Plan</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPlans.map((plan) => (
                <button key={plan.id} type="button" onClick={() => { setSelectedPlanId(plan.id); setSelectedTechniqueId(null) }} className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,25,36,0.96),rgba(12,16,24,0.95))] text-left transition hover:-translate-y-0.5 hover:border-bjj-gold/30">
                <div className="h-36 w-full bg-[linear-gradient(135deg,rgba(255,177,86,0.08),rgba(24,31,46,0.18))] bg-cover bg-center" style={plan.heroImageUrl ? { backgroundImage: `linear-gradient(135deg,rgba(10,14,22,0.22),rgba(10,14,22,0.72)), url(${plan.heroImageUrl})` } : undefined} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-white">{plan.title}</p>
                      <p className="mt-1 text-sm text-white/58">{plan.headline}</p>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/62">{plan.status}</span>
                  </div>
                  <p className="mt-4 text-xs text-white/42">{formatDate(plan.updatedAt)}</p>
                  <p className="mt-3 text-sm text-white/70">{plan.nodes.length} Techniken</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className={`relative grid gap-5 ${leftPanelCollapsed ? 'xl:grid-cols-[minmax(0,1fr)]' : 'xl:grid-cols-[280px_minmax(0,1fr)]'}`}>
        <button
          type="button"
          onClick={() => setLeftPanelCollapsed((current) => !current)}
          className={`absolute top-6 z-40 hidden h-11 w-11 items-center justify-center rounded-[1rem] border shadow-[0_14px_36px_rgba(0,0,0,0.26)] backdrop-blur-md transition xl:inline-flex ${
            leftPanelCollapsed
              ? 'left-4 border-bjj-gold/30 bg-[rgba(28,21,14,0.92)] text-bjj-gold'
              : 'left-[292px] border-white/10 bg-[rgba(22,29,41,0.96)] text-white/72 hover:text-white'
          }`}
          aria-label={leftPanelCollapsed ? 'Linke Leiste anzeigen' : 'Linke Leiste ausblenden'}
          title={leftPanelCollapsed ? 'Linke Leiste anzeigen' : 'Linke Leiste ausblenden'}
        >
          {leftPanelCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        {!leftPanelCollapsed ? (
        <div className="space-y-4">
          <Section id="plans" title="Plans" open={openSections.plans} onToggle={toggleSection}>
            <div className="space-y-3">
              {plans.map((plan) => (
                <button key={plan.id} type="button" onClick={() => { setSelectedPlanId(plan.id); setSelectedTechniqueId(null) }} className={`w-full rounded-[1.25rem] border px-4 py-4 text-left ${plan.id === selectedPlanId ? 'border-bjj-gold/35 bg-bjj-gold/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-white">{plan.title}</p><p className="mt-1 text-xs text-white/55">{plan.headline}</p></div><span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/65">{plan.status}</span></div>
                  <p className="mt-3 text-xs text-white/40">{formatDate(plan.updatedAt)}</p>
                </button>
              ))}
            </div>
          </Section>

          <Section id="settings" title="Settings" open={openSections.settings} onToggle={toggleSection}>
            {selectedPlan ? <div className="space-y-3">
              <select value={selectedPlan.status} onChange={(event) => updatePlan((plan) => ({ ...plan, status: event.target.value as 'draft' | 'published' }))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"><option value="draft">draft</option><option value="published">published</option></select>
              <input value={selectedPlan.slug} onChange={(event) => updatePlan((plan) => ({ ...plan, slug: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" placeholder="Slug" />
              <input value={selectedPlan.title} onChange={(event) => updatePlan((plan) => ({ ...plan, title: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" placeholder="Titel" />
              <input value={selectedPlan.headline} onChange={(event) => updatePlan((plan) => ({ ...plan, headline: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" placeholder="Headline" />
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-white/50">Titelbild (Hero Image URL)</label>
                <input 
                  value={selectedPlan.heroImageUrl || ''} 
                  onChange={(event) => updatePlan((plan) => ({ ...plan, heroImageUrl: event.target.value || null }))} 
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" 
                  placeholder="https://..."
                />
                {selectedPlan.heroImageUrl ? (
                  <img src={selectedPlan.heroImageUrl} alt="Hero Preview" className="mt-2 h-24 w-full rounded-xl object-cover" />
                ) : null}
                <input
                  ref={heroFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void handleHeroImageUpload(file)
                    }
                    event.target.value = ''
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => heroFileInputRef.current?.click()} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/84">{uploadingHeroImage ? 'Laedt...' : 'Titelbild hochladen'}</button>
                  {selectedPlan.heroImageUrl ? <button type="button" onClick={() => updatePlan((plan) => ({ ...plan, heroImageUrl: null }))} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white/70">Titelbild entfernen</button> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/75">Hauptpfad: {deriveMainPath(selectedPlan).join(' -> ') || 'Noch keine A-Plan-Techniken'}</div>
            </div> : null}
          </Section>

          <Section id="technique" title="Technik" open={openSections.technique} onToggle={toggleSection}>
            <div className="space-y-3">
              <p className="text-xs text-white/50">Techniken direkt in die Map ziehen oder anklicken, um sie hinzuzufuegen.</p>
              <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/35" /><input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="Technik suchen..." className="w-full rounded-2xl border border-white/10 bg-[#101723] py-3 pl-10 pr-3 text-sm text-white outline-none" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={pickerTrack} onChange={(event) => setPickerTrack(event.target.value as typeof pickerTrack)} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none"><option value="all">Tracks</option><option value="foundation">Foundation</option><option value="secondary">Secondary</option><option value="top-game">Top Game</option></select>
                <select value={pickerStage} onChange={(event) => setPickerStage(event.target.value as typeof pickerStage)} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none"><option value="all">Stages</option><option value="position">Position</option><option value="pass">Pass</option><option value="submission">Submission</option></select>
                <select value={pickerArchetype} onChange={(event) => setPickerArchetype(event.target.value)} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none sm:col-span-2"><option value="all">Alle Archetypen</option>{ARCHETYPES.map((archetype) => <option key={archetype.id} value={archetype.id}>{archetype.name}</option>)}</select>
                <select value={pickerSize} onChange={(event) => setPickerSize(event.target.value as typeof pickerSize)} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none"><option value="main">A-Plan gross</option><option value="branch">B-Plan mittel</option><option value="future">Extra klein</option></select>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {filteredTechniques.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-bjj-technique', node.id)
                      event.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addTechnique(node)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:brightness-110 ${getStageTone(node.stage, false)}`}
                  >
                    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-white">{node.title}</p><p className="mt-1 text-xs text-white/55">{node.subtitle}</p>{node.recommendedArchetypeIds.length > 0 ? <p className="mt-2 text-[11px] text-bjj-gold">{node.recommendedArchetypeIds.map((id) => archetypeNameById.get(id) ?? id).join(' • ')}</p> : null}</div><span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/65">{TRACK_LABELS[node.track]}</span></div>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section id="connections" title="Connections" open={openSections.connections} onToggle={toggleSection}>
            <div className="space-y-3">
              <button type="button" disabled={!selectedTechnique} onClick={() => selectedTechnique && startConnectMode(selectedTechnique.id)} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-white/84 disabled:opacity-40">{connectMode && selectedSourceNodeId === selectedTechnique?.id ? 'Ziel-Technik auf der Canvas anklicken' : 'Connect Mode starten'}</button>
              {connectMode ? <button type="button" onClick={cancelConnectMode} className="w-full rounded-2xl border border-bjj-gold/25 bg-bjj-gold/10 px-3 py-3 text-sm font-semibold text-bjj-gold">Connect Mode abbrechen</button> : null}
              {selectedPlan?.edges.filter((edge) => !selectedTechnique || edge.fromNodeId === selectedTechnique.id || edge.toNodeId === selectedTechnique.id).map((edge) => (
                <div key={edge.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-2">
                    <select value={edge.fromNodeId} onChange={(event) => updatePlan((plan) => relayoutPlan({ ...plan, edges: plan.edges.map((entry) => entry.id === edge.id ? { ...entry, fromNodeId: event.target.value } : entry) }))} className="w-full rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none">{selectedPlan.nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select>
                    <select value={edge.toNodeId} onChange={(event) => updatePlan((plan) => relayoutPlan({ ...plan, edges: plan.edges.map((entry) => entry.id === edge.id ? { ...entry, toNodeId: event.target.value } : entry) }))} className="w-full rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none">{selectedPlan.nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select>
                    <button type="button" onClick={() => updatePlan((plan) => relayoutPlan({ ...plan, edges: plan.edges.filter((entry) => entry.id !== edge.id) }))} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white/70">Verbindung entfernen</button>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="assignments" title="Assignments" open={openSections.assignments} onToggle={toggleSection}>
            <div className="space-y-4">
              {selectedPlan ? (
                <div className="rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-3 text-sm text-white/82">
                  <p className="font-semibold text-bjj-gold">Sichtbarkeit im Gameplan</p>
                  {currentAdminProfile ? (
                    <p className="mt-1 text-white/78">
                      Du bist gerade: <span className="text-white">{currentAdminProfile.label}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-white/72">
                    {selectedPlan.assignmentPriorityNote ?? 'Dieser Plan ist aktuell nur sichtbar, wenn du unten ein Profil, einen Archetypen oder einen Fallback definierst.'}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                    {selectedPlan.directProfileAssignmentCount} Profile direkt zugewiesen • {selectedPlan.archetypeAssignmentCount} Archetypen zugewiesen
                  </p>
                </div>
              ) : null}
              {selectedPlan && (selectedProfileLabels.length > 0 || selectedArchetypeNames.length > 0) ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/82">
                  {selectedProfileLabels.length > 0 ? (
                    <p>
                      Profile: <span className="text-white">{selectedProfileLabels.join(', ')}</span>
                    </p>
                  ) : null}
                  {selectedArchetypeNames.length > 0 ? (
                    <p className={selectedProfileLabels.length > 0 ? 'mt-1' : ''}>
                      Archetypen: <span className="text-white">{selectedArchetypeNames.join(', ')}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/46">Profile</p>
                <input value={profileQuery} onChange={(event) => setProfileQuery(event.target.value)} placeholder="Nutzer suchen..." className="w-full rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none" />
                <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
                  {filteredProfiles.map((profile) => {
                    const active = selectedProfileIds.has(profile.id)
                    return <button key={profile.id} type="button" onClick={() => toggleProfile(profile.id)} className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${active ? 'border-bjj-gold/35 bg-bjj-gold/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/76'}`}>{profile.label}</button>
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/46">Archetypen</p>
                <div className="space-y-2">
                  {ARCHETYPES.map((archetype) => {
                    const active = selectedArchetypeIds.has(archetype.id)
                    return <button key={archetype.id} type="button" onClick={() => toggleArchetype(archetype.id)} className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${active ? 'border-bjj-gold/35 bg-bjj-gold/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/76'}`}>{archetype.name}</button>
                  })}
                </div>
              </div>
            </div>
          </Section>
        </div>
        ) : null}

        <div>
          {selectedPlan ? (
            <>
              <div className="relative overflow-hidden rounded-[1.9rem]">
              <div ref={canvasRef} onMouseDown={startCanvasPan} onWheel={handleCanvasWheel} onDragOver={(event) => event.preventDefault()} onDrop={handleCanvasDrop} className="relative overflow-hidden rounded-[1.9rem] bg-[linear-gradient(180deg,#0d111a,#090c13)]" style={{ height: 'calc(100vh - 190px)', minHeight: 720, cursor: isPanning ? 'grabbing' : 'grab', overscrollBehavior: 'contain', overflowAnchor: 'none' }}>
                <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(18,23,33,0.2),rgba(8,12,18,0))]" />
                <div
                style={{
                  width: (Math.max(selectedPlan.canvasWidth, ADMIN_CANVAS_MIN_WIDTH) + ADMIN_CANVAS_PAD_X * 2) * zoom,
                  height: (Math.max(selectedPlan.canvasHeight, ADMIN_CANVAS_MIN_HEIGHT) + ADMIN_CANVAS_PAD_Y * 2) * zoom,
                  position: 'relative',
                }}
              >
                <div
                  className="relative z-10 origin-top-left"
                  style={{
                    width: Math.max(selectedPlan.canvasWidth, ADMIN_CANVAS_MIN_WIDTH) + ADMIN_CANVAS_PAD_X * 2,
                    height: Math.max(selectedPlan.canvasHeight, ADMIN_CANVAS_MIN_HEIGHT) + ADMIN_CANVAS_PAD_Y * 2,
                    transform: `scale(${zoom})`,
                  }}
                >
                    <svg className="absolute inset-0 h-full w-full">
                      {selectedPlan.edges.map((edge) => {
                        const from = selectedPlan.nodes.find((node) => node.id === edge.fromNodeId)
                        const to = selectedPlan.nodes.find((node) => node.id === edge.toNodeId)
                        if (!from || !to) return null
                        const start = centerOf(from)
                        const end = centerOf(to)
                        return <line key={edge.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="rgba(217,159,92,0.82)" strokeWidth="2.6" />
                      })}
                    </svg>

                    {selectedPlan.nodes.map((node) => (
                      <button key={node.id} type="button" onMouseDown={(event) => {
                        event.stopPropagation()
                        if (connectMode) return
                        if (event.detail < 2) {
                          beginCanvasPan(event.clientX, event.clientY, false)
                          return
                        }
                        dragRef.current = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y }
                        setDraggingTechniqueId(node.id)
                        setSelectedTechniqueId(node.id)
                      }} onClick={() => handleCanvasNodeClick(node.id)} className={`absolute rounded-[1.35rem] border p-4 text-left shadow-[0_18px_42px_rgba(0,0,0,0.18)] ${getStageTone(node.stage, node.id === selectedTechniqueId || node.id === selectedSourceNodeId)} ${connectMode && selectedSourceNodeId === node.id ? 'ring-2 ring-bjj-gold/70' : ''}`} style={{ left: ADMIN_CANVAS_PAD_X + node.x, top: ADMIN_CANVAS_PAD_Y + node.y, width: NODE_WIDTH[node.size], minHeight: NODE_HEIGHT[node.size] }}>
                        <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.18em] text-bjj-gold">{node.unlockPhase === 'core' ? 'A-Plan' : SIZE_LABELS[node.size]}</span><span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${STAGE_META[node.stage].pill}`}>{STAGE_META[node.stage].title}</span></div>
                        <p className="mt-2 text-lg font-black text-white">{node.title}</p>
                        <p className="mt-2 text-sm text-white/62">{node.label}</p>
                        <div className={`mt-4 h-px w-full bg-gradient-to-r ${STAGE_META[node.stage].line}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {selectedTechnique ? (
                <div className="pointer-events-auto absolute right-6 top-6 z-30 w-[400px] max-w-[calc(100%-3rem)] rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(13,18,27,0.96),rgba(10,14,22,0.94))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-md" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-bjj-gold">Technik Details</p>
                    <button type="button" onClick={() => setSelectedTechniqueId(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-[#101723] text-white/70 transition hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input value={selectedTechnique.title} onChange={(event) => updateTechnique((node) => ({ ...node, title: event.target.value }))} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none" />
                    <input value={selectedTechnique.label} onChange={(event) => updateTechnique((node) => ({ ...node, label: event.target.value }))} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none" />
                    <select value={selectedTechnique.stage} onChange={(event) => updateTechnique((node) => ({ ...node, stage: event.target.value as GameplanAdminNode['stage'] }))} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none"><option value="position">position</option><option value="pass">pass</option><option value="submission">submission</option></select>
                    <select value={selectedTechnique.unlockPhase} onChange={(event) => updatePlan((plan) => relayoutPlan({
                      ...plan,
                      nodes: plan.nodes.map((node) => node.id === selectedTechnique.id
                        ? {
                            ...node,
                            unlockPhase: event.target.value as GameplanAdminNode['unlockPhase'],
                            size: event.target.value === 'core' ? 'main' : node.size === 'main' ? 'branch' : node.size,
                            unlockParentNodeId: event.target.value === 'core' ? null : node.unlockParentNodeId,
                          }
                        : node),
                    }))} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none"><option value="core">core / A-Plan</option><option value="expansion">expansion</option></select>
                    <select value={selectedTechnique.size} onChange={(event) => updateTechnique((node) => ({ ...node, size: event.target.value as GameplanAdminNode['size'] }))} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none"><option value="main">A-Plan gross</option><option value="branch">B-Plan mittel</option><option value="future">Extra klein</option></select>
                    <input type="number" min={1} value={selectedTechnique.unlockOrder ?? ''} onChange={(event) => updatePlan((plan) => relayoutPlan({
                      ...plan,
                      nodes: plan.nodes.map((node) => node.id === selectedTechnique.id ? { ...node, unlockOrder: event.target.value ? Number(event.target.value) : null } : node),
                    }))} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none" placeholder="Reihenfolge" />
                    <select value={selectedTechnique.unlockParentNodeId ?? ''} onChange={(event) => updatePlan((plan) => relayoutPlan({
                      ...plan,
                      nodes: plan.nodes.map((node) => node.id === selectedTechnique.id ? { ...node, unlockParentNodeId: event.target.value || null } : node),
                    }))} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-3 text-sm text-white outline-none"><option value="">Kein Parent</option>{selectedPlan.nodes.filter((node) => node.id !== selectedTechnique.id).map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select>
                    <button type="button" onClick={() => startConnectMode(selectedTechnique.id)} className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                      connectMode && selectedSourceNodeId === selectedTechnique.id
                        ? 'border-bjj-gold/40 bg-bjj-gold/18 text-bjj-gold'
                        : 'border-bjj-gold/25 bg-bjj-gold/10 text-bjj-gold'
                    }`}>{connectMode && selectedSourceNodeId === selectedTechnique.id ? 'Ziel auswaehlen...' : 'Mit anderer Technik verbinden'}</button>
                    <button type="button" onClick={() => updatePlan((plan) => relayoutPlan({
                      ...plan,
                      nodes: plan.nodes.map((node) => node.id === selectedTechnique.id ? { ...node, requiresValidation: !node.requiresValidation } : node),
                    }))} className={`rounded-2xl border px-3 py-3 text-sm transition ${
                      selectedTechnique.requiresValidation
                        ? 'border-bjj-gold/30 bg-bjj-gold/12 text-bjj-gold'
                        : 'border-white/10 text-white/76'
                    }`}>{selectedTechnique.requiresValidation ? 'Validation Pflicht: an' : 'Validation Pflicht: aus'}</button>
                  </div>
                </div>
              ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
      )}
    </div>
  )
}
