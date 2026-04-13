'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, CheckCircle2, ChevronDown, Database, Hash, KeyRound, Link2, Play, Save, Search, Sparkles, CheckSquare, Square } from 'lucide-react'
import { YoutubeEmbed } from '@/components/YoutubeEmbed'
import { ARCHETYPES } from '@/lib/archetypes'
import { createClient } from '@/lib/supabase/client'
import { CUSTOM_TECHNIQUES_EVENT, readCustomTechniques, updateCustomTechnique } from '@/lib/custom-techniques'
import {
  EXTERNAL_SOURCE_ROLES,
  getExternalSourceRoleLabel,
  type ExternalSearchMode,
  type ExternalSourceRole,
  type ExternalTechniqueSearchRunRecord,
} from '@/lib/external-technique-sources'
import { getTechniqueCoverageLabel, normalizeTechniqueStyleCoverage, type TechniqueStyleCoverage } from '@/lib/technique-style'
import { getTechniqueCatalogEntryById, getNodeTechniqueCatalog, type TechniqueCatalogEntry } from '@/lib/technique-catalog'
import {
  CLIP_CONTENT_TYPES,
  CLIP_LEARNING_PHASES,
  getClipContentTypeLabel,
  getClipLearningPhaseLabel,
  type ClipContentType,
  type ClipLearningPhase,
} from '@/lib/clip-taxonomy'
import { appendStartSecondsToVideoUrl } from '@/lib/video-format'

type ImportedSource = {
  id?: string
  assignment_id?: string
  assignment_role?: ExternalSourceRole | null
  assignment_status?: string
  provider: string
  source_url: string
  source_type: string
  title: string
  video_url: string | null
  video_platform: string | null
  content_type?: ClipContentType | null
  learning_phase?: ClipLearningPhase | null
  target_archetype_ids?: string[]
  style_coverage?: TechniqueStyleCoverage | null
  timestamp_label: string | null
  timestamp_seconds: number | null
  hashtags: string[]
  summary: string | null
  search_query: string | null
  raw_payload: Record<string, unknown>
  imported_at?: string
  last_seen_at?: string
}

type ImportResponse = {
  ok?: boolean
  error?: string
  runId?: string
  mode?: ExternalSearchMode
  label?: string
  imported?: ImportedSource[]
  importedCount?: number
  hashtags?: string[]
  page?: number
  limit?: number
  hasMore?: boolean
  groupCount?: number
  sections?: Array<{
    sectionKey: string
    sectionTitle: string
    sectionOrder: number
    sectionSummary: string | null
  }>
  failed?: { url: string; reason: string }[]
}

type GroupedSectionSource = ImportedSource & {
  evidenceText: string | null
  sourceOrder: number
}

type GroupedSection = {
  id: string
  runId: string
  sectionKey: string
  sectionTitle: string
  sectionOrder: number
  sectionSummary: string | null
  createdAt: string
  sources: GroupedSectionSource[]
}

type SourceListResponse = {
  error?: string
  clips?: ImportedSource[]
  sections?: GroupedSection[]
}

type NodeClipGroupsResponse = {
  error?: string
  groups?: Partial<Record<ExternalSourceRole, ImportedSource[]>>
}

type SearchRunListResponse = {
  error?: string
  runs?: ExternalTechniqueSearchRunRecord[]
}

async function parseJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text()

  if (!text.trim()) {
    return { error: `Leere Server-Antwort (${response.status}).` } as T & { error?: string }
  }

  try {
    return JSON.parse(text) as T & { error?: string }
  } catch {
    return {
      error: text.slice(0, 400),
    } as T & { error?: string }
  }
}

const ROLE_OPTIONS = EXTERNAL_SOURCE_ROLES.map((role) => ({
  id: role,
  label: getExternalSourceRoleLabel(role),
}))

function getRunModeLabel(mode: ExternalSearchMode) {
  return mode === 'ai_chat' ? 'AI Search' : 'Hashtag Search'
}

function getSourceSummary(source: ImportedSource) {
  if (source.summary?.trim()) {
    return source.summary.trim()
  }

  const linkedResource = source.raw_payload?.linked_resource
  if (linkedResource && typeof linkedResource === 'object') {
    const linkedSummary = (linkedResource as { summary?: unknown }).summary
    if (typeof linkedSummary === 'string' && linkedSummary.trim()) {
      return linkedSummary.trim()
    }
  }

  return 'Keine Description erkannt.'
}

function getReadableSourceUrl(source: ImportedSource) {
  return source.video_url ?? source.source_url
}

function getSourceEditKey(source: ImportedSource) {
  return source.id ?? source.source_url
}

function getSourcePreviewUrl(source: ImportedSource) {
  return appendStartSecondsToVideoUrl(source.video_url ?? source.source_url, source.timestamp_seconds)
}

function getSourceDebug(source: ImportedSource) {
  const debug = source.raw_payload?.debug
  if (!debug || typeof debug !== 'object') {
    return null
  }

  return debug as {
    resolved_deeplink?: string
    fetch_kind?: string
    field_sources?: Record<string, unknown>
    html_snippets?: {
      iframe?: string | null
      hashtag_buttons?: string[] | null
      description_paragraph?: string | null
    }
    extracted?: Record<string, unknown>
  }
}

function splitSectionIntoBlocks(value: string | null) {
  if (!value?.trim()) return []

  const lines = value.split(/\n/).map((line) => line.trim())
  const blocks: string[] = []
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join('\n').trim()
    if (text) blocks.push(text)
    buffer = []
  }

  for (const line of lines) {
    if (!line) {
      flush()
      continue
    }

    if (/^#{2,3}\s+/.test(line) || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      flush()
      buffer.push(line)
      flush()
      continue
    }

    buffer.push(line)
  }

  flush()
  return blocks
}

function normalizeEvidence(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSectionBlocksWithSources(section: GroupedSection) {
  const blocks = splitSectionIntoBlocks(section.sectionSummary)
  const remainingSources = [...section.sources]

  const matchedBlocks = blocks.map((block) => {
    const normalizedBlock = normalizeEvidence(block)
    const sources = remainingSources.filter((source) => {
      const normalizedEvidence = normalizeEvidence(source.evidenceText)
      return (
        normalizedEvidence.length > 0 &&
        (normalizedBlock.includes(normalizedEvidence) || normalizedEvidence.includes(normalizedBlock))
      )
    })

    for (const source of sources) {
      const index = remainingSources.findIndex((entry) => entry.id === source.id)
      if (index >= 0) {
        remainingSources.splice(index, 1)
      }
    }

    return { text: block, sources }
  })

  return {
    blocks: matchedBlocks,
    remainingSources,
  }
}

function SourceCard({
  source,
  active,
  selected,
  onSelect,
  onToggleSelection,
}: {
  source: ImportedSource
  active: boolean
  selected: boolean
  onSelect: () => void
  onToggleSelection?: () => void
}) {
  const isAssigned = Boolean(source.assignment_id)
  const assignedRoleLabel = source.assignment_role
    ? getExternalSourceRoleLabel(source.assignment_role)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
        active || selected
          ? 'border-bjj-gold/40 bg-bjj-gold/10'
          : isAssigned
            ? 'border-green-500/40 bg-green-500/5 hover:border-green-500/60'
            : 'border-bjj-border bg-bjj-surface hover:border-bjj-gold/20'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox fuer Mehrfachauswahl */}
        {source.id && !isAssigned && (
          <div className="shrink-0 pt-0.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleSelection?.()
              }}
              disabled={isAssigned}
              className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                selected
                  ? 'border-bjj-gold bg-bjj-gold text-bjj-coal'
                  : 'border-bjj-border hover:border-bjj-gold/60'
              }`}
            >
              {selected && (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>
        )}
        {isAssigned && (
          <div className="shrink-0 pt-0.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-green-500/50 bg-green-500/20">
              <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-white truncate">{source.title}</p>
            {isAssigned && (
              <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-green-400">
                {assignedRoleLabel ?? 'Zugewiesen'}
              </span>
            )}
            {selected && !isAssigned && (
              <span className="shrink-0 rounded-full bg-bjj-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-bjj-gold">
                Ausgewaehlt
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-bjj-muted">
            {source.timestamp_label ?? 'Kein Timestamp'} • {source.video_platform ?? source.provider}
          </p>
          <p className="mt-3 line-clamp-3 text-sm text-bjj-muted">{getSourceSummary(source)}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-gold">
              {getTechniqueCoverageLabel(source.style_coverage ?? 'both')}
            </span>
            <span className="text-[11px] text-bjj-muted">•</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
              {source.hashtags.length} Hashtags
            </span>
          </div>
          <p className="mt-2 line-clamp-1 text-xs text-bjj-muted">{getReadableSourceUrl(source)}</p>
        </div>
      </div>
    </div>
  )
}

export default function AdminOutlierDbPage() {
  const supabase = createClient()
  const [customTechniques, setCustomTechniques] = useState(() => readCustomTechniques())
  const [mode, setMode] = useState<ExternalSearchMode>('tag_search')
  const [label, setLabel] = useState('Nogi Resources')
  const [query, setQuery] = useState('No Gi Shin 2 Shin richtung ashi garami richtung straight foot lock')
  const [hashtagsInput, setHashtagsInput] = useState('#nogi, #resource')
  const [outlierToken, setOutlierToken] = useState('')
  const [styleCoverage, setStyleCoverage] = useState<TechniqueStyleCoverage>('nogi')
  const [limit, setLimit] = useState(10)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedRole, setSelectedRole] = useState<ExternalSourceRole>('main_reference')
  const [selectedContentType, setSelectedContentType] = useState<ClipContentType>('technical_demo')
  const [selectedLearningPhase, setSelectedLearningPhase] = useState<ClipLearningPhase>('core_mechanic')
  const [followUpNodeIds, setFollowUpNodeIds] = useState<string[]>([])
  const [mappingNotes, setMappingNotes] = useState('')
  const [recommendedArchetypeIds, setRecommendedArchetypeIds] = useState<string[]>([])
  const [sources, setSources] = useState<ImportedSource[]>([])
  const [groupedSections, setGroupedSections] = useState<GroupedSection[]>([])
  const [searchRuns, setSearchRuns] = useState<ExternalTechniqueSearchRunRecord[]>([])
  const [importSummary, setImportSummary] = useState<ImportResponse | null>(null)
  const [loadingSources, setLoadingSources] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [importing, setImporting] = useState(false)
  const [mapping, setMapping] = useState(false)
  const [savingArchetypes, setSavingArchetypes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [nodeClipGroups, setNodeClipGroups] = useState<Partial<Record<ExternalSourceRole, ImportedSource[]>>>({})
  const [showAllScrapedVideos, setShowAllScrapedVideos] = useState(false)
  const [sourcesFilterTerm, setSourcesFilterTerm] = useState('')
  const [editedSummaryById, setEditedSummaryById] = useState<Record<string, string>>({})

  const selectedSource = useMemo(
    () =>
      sources.find((entry) => entry.id === selectedSourceId) ??
      importSummary?.imported?.find((entry) => entry.id === selectedSourceId) ??
      groupedSections.flatMap((section) => section.sources).find((entry) => entry.id === selectedSourceId) ??
      null,
    [groupedSections, importSummary?.imported, selectedSourceId, sources]
  )
  const selectedSourceDebug = useMemo(() => (selectedSource ? getSourceDebug(selectedSource) : null), [selectedSource])
  const selectedSourceSummaryDraft = selectedSource
    ? editedSummaryById[getSourceEditKey(selectedSource)] ?? getSourceSummary(selectedSource)
    : ''
  const selectableSourceIds = useMemo(() => {
    const ids = [
      ...sources,
      ...(importSummary?.imported ?? []),
      ...groupedSections.flatMap((section) => section.sources),
    ]
      .map((entry) => entry.id)
      .filter((id): id is string => Boolean(id))

    return Array.from(new Set(ids))
  }, [groupedSections, importSummary?.imported, sources])
  const selectedClipIds = useMemo(() => {
    if (selectedSourceIds.length > 0) {
      return selectedSourceIds
    }

    return selectedSourceId ? [selectedSourceId] : []
  }, [selectedSourceId, selectedSourceIds])

  const selectedRun = useMemo(
    () => searchRuns.find((entry) => entry.id === selectedRunId) ?? null,
    [searchRuns, selectedRunId]
  )
  const selectedTechnique = useMemo<TechniqueCatalogEntry | null>(() => {
    if (!selectedNodeId) return null
    return getTechniqueCatalogEntryById(selectedNodeId)
  }, [selectedNodeId, customTechniques])
  const techniqueOptions = useMemo(() => {
    const combined = [
      ...getNodeTechniqueCatalog().map((entry) => ({
        id: entry.id,
        title: entry.title,
        subtitle: entry.subtitle,
      })),
      ...customTechniques.map((entry) => ({
        id: entry.id,
        title: entry.title,
        subtitle: entry.subtitle,
      })),
    ]

    const deduped = new Map(combined.map((entry) => [entry.id, entry]))
    return Array.from(deduped.values()).sort((a, b) => a.title.localeCompare(b.title))
  }, [customTechniques])

  useEffect(() => {
    const sync = () => setCustomTechniques(readCustomTechniques())
    window.addEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
    return () => window.removeEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!selectedNodeId && techniqueOptions.length > 0) {
      setSelectedNodeId(techniqueOptions[0]?.id ?? '')
    }
  }, [selectedNodeId, techniqueOptions])

  useEffect(() => {
    if (selectedRole !== 'related_reference' && followUpNodeIds.length > 0) {
      setFollowUpNodeIds([])
    }
  }, [followUpNodeIds.length, selectedRole])

  useEffect(() => {
    const customTechnique = customTechniques.find((entry) => entry.id === selectedNodeId)
    setRecommendedArchetypeIds(customTechnique?.recommendedArchetypeIds ?? [])
  }, [customTechniques, selectedNodeId])

  async function getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers: Record<string, string> = {}

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    return headers
  }

  async function loadSearchRuns() {
    setLoadingRuns(true)
    const headers = await getAuthHeaders()
    const response = await fetch('/api/admin/outlierdb-search-runs?limit=30', {
      headers,
      cache: 'no-store',
    })
    const payload = await parseJsonResponse<SearchRunListResponse>(response)
    setLoadingRuns(false)

    if (!response.ok) {
      setError(payload.error ?? 'Suchlaeufe konnten nicht geladen werden.')
      return
    }

    const runs = payload.runs ?? []
    setSearchRuns(runs)
  }

  async function loadSources(term = '', runId?: string | null) {
    setLoadingSources(true)
    setError(null)

    const headers = await getAuthHeaders()
    const queryString = new URLSearchParams()
    if (term.trim()) queryString.set('query', term.trim())
    queryString.set('limit', '100')
    if (runId) queryString.set('runId', runId)

    const response = await fetch(`/api/admin/clip-archive?${queryString.toString()}`, {
      headers,
      cache: 'no-store',
    })
    const payload = await parseJsonResponse<SourceListResponse>(response)

    setLoadingSources(false)

    if (!response.ok) {
      setError(payload.error ?? 'Quellen konnten nicht geladen werden.')
      return
    }

    const nextSources = payload.clips ?? []
    const nextSections = payload.sections ?? []
    setSources(nextSources)
    setGroupedSections(nextSections)
    setSelectedSourceId(nextSections[0]?.sources[0]?.id ?? nextSources[0]?.id ?? null)
  }

  async function loadNodeClipGroups(nodeId: string) {
    if (!nodeId) {
      setNodeClipGroups({})
      return
    }

    const headers = await getAuthHeaders()
    const response = await fetch(`/api/node-clips?nodeId=${encodeURIComponent(nodeId)}`, {
      headers,
      cache: 'no-store',
    })
    const payload = await parseJsonResponse<NodeClipGroupsResponse>(response)

    if (!response.ok) {
      setError(payload.error ?? 'Technik-Videos konnten nicht geladen werden.')
      return
    }

    setNodeClipGroups(payload.groups ?? {})
  }

  useEffect(() => {
    void loadSearchRuns()
  }, [])

  useEffect(() => {
    void loadNodeClipGroups(selectedNodeId)
  }, [selectedNodeId])

  useEffect(() => {
    if (!selectedSource) return

    const key = getSourceEditKey(selectedSource)
    setEditedSummaryById((current) => {
      if (Object.prototype.hasOwnProperty.call(current, key)) return current
      return { ...current, [key]: getSourceSummary(selectedSource) }
    })
  }, [selectedSource?.id, selectedSource?.source_url])

  function replaceSourceInState(nextClip: ImportedSource) {
    setSources((current) => current.map((entry) => (entry.id === nextClip.id ? { ...entry, ...nextClip } : entry)))
    setImportSummary((current) =>
      current
        ? {
            ...current,
            imported: current.imported?.map((entry) => (entry.id === nextClip.id ? { ...entry, ...nextClip } : entry)),
          }
        : current
    )
    setGroupedSections((current) =>
      current.map((section) => ({
        ...section,
        sources: section.sources.map((entry) => (entry.id === nextClip.id ? { ...entry, ...nextClip } : entry)),
      }))
    )
    setNodeClipGroups((current) => {
      const nextGroups: Partial<Record<ExternalSourceRole, ImportedSource[]>> = {}
      for (const [role, clips] of Object.entries(current) as Array<[ExternalSourceRole, ImportedSource[] | undefined]>) {
        nextGroups[role] = clips?.map((entry) => (entry.id === nextClip.id ? { ...entry, ...nextClip } : entry)) ?? []
      }
      return nextGroups
    })
  }

  async function saveEditedDescriptionForClip(source: ImportedSource, headers: Record<string, string>) {
    if (!source.id) return true

    const key = getSourceEditKey(source)
    const nextSummary = editedSummaryById[key] ?? getSourceSummary(source)
    if ((source.summary ?? '') === nextSummary.trim()) return true

    const response = await fetch('/api/admin/clip-archive', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        clipId: source.id,
        summary: nextSummary,
        hashtags: source.hashtags,
        contentType: source.content_type,
        learningPhase: source.learning_phase,
        targetArchetypeIds: source.target_archetype_ids ?? [],
      }),
    })
    const payload = await parseJsonResponse<{ clip?: ImportedSource; error?: string }>(response)

    if (!response.ok || !payload.clip) {
      setError(payload.error ?? 'Beschreibung konnte nicht gespeichert werden.')
      return false
    }

    replaceSourceInState(payload.clip)
    setEditedSummaryById((current) => ({ ...current, [key]: payload.clip?.summary ?? '' }))
    return true
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    setSuccess(null)

    const headers = await getAuthHeaders()
    const response = await fetch('/api/admin/outlierdb-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        mode,
        label: label.trim(),
        query: query.trim(),
        authToken: outlierToken.trim(),
        styleCoverage,
        hashtags:
          mode === 'tag_search'
            ? hashtagsInput
                .split(/[,\n]/)
                .map((entry) => entry.trim())
                .filter(Boolean)
            : [],
        ...(mode === 'tag_search' ? { limit } : {}),
        page: 1,
      }),
    })

    const payload = await parseJsonResponse<ImportResponse>(response)
    setImporting(false)

    if (!response.ok) {
      setError(payload.error ?? 'Import fehlgeschlagen.')
      return
    }

    setImportSummary(payload)
    setSuccess(`${payload.importedCount ?? 0} Quellen importiert.`)
    await loadSearchRuns()
    if (payload.runId) {
      setSelectedRunId(payload.runId)
      await loadSources('', payload.runId)
      setShowAllScrapedVideos(true)
    }
  }

  async function handleRunSelect(runId: string) {
    setSelectedRunId(runId)
    await loadSources('', runId)
    setShowAllScrapedVideos(true)
  }

  function handleSelectSource(sourceId: string | null | undefined) {
    if (!sourceId) return
    setSelectedSourceId(sourceId)
  }

  function handleToggleSourceSelection(sourceId: string | null | undefined) {
    if (!sourceId) return
    setSelectedSourceId(sourceId)
    setSelectedSourceIds((current) =>
      current.includes(sourceId) ? current.filter((entry) => entry !== sourceId) : [...current, sourceId]
    )
  }

  function handleToggleFollowUpNode(nodeId: string) {
    setFollowUpNodeIds((current) =>
      current.includes(nodeId) ? current.filter((entry) => entry !== nodeId) : [...current, nodeId]
    )
  }

  async function handleMapSource() {
    if (selectedClipIds.length === 0 || !selectedNodeId) {
      setError('Bitte zuerst mindestens eine Quelle und einen Node auswaehlen.')
      return
    }

    const targetNodeIds =
      selectedRole === 'related_reference'
        ? Array.from(new Set([selectedNodeId, ...followUpNodeIds]))
        : [selectedNodeId]

    setMapping(true)
    setError(null)
    setSuccess(null)

    const headers = await getAuthHeaders()

    for (const clipId of selectedClipIds) {
      const source = [
        ...sources,
        ...(importSummary?.imported ?? []),
        ...groupedSections.flatMap((section) => section.sources),
      ].find((entry) => entry.id === clipId)

      if (source) {
        const saved = await saveEditedDescriptionForClip(source, headers)
        if (!saved) {
          setMapping(false)
          return
        }
      }

      for (const nodeId of targetNodeIds) {
        const response = await fetch('/api/admin/clip-archive-assignments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            clipId,
            assignmentKind: 'node',
            nodeId,
            role: selectedRole,
            contentType: selectedContentType,
            learningPhase: selectedLearningPhase,
            targetArchetypeIds: recommendedArchetypeIds,
            notes: mappingNotes.trim() || null,
          }),
        })

        const payload = await parseJsonResponse<{ error?: string }>(response)
        if (!response.ok) {
          setMapping(false)
          setError(payload.error ?? 'Mapping fehlgeschlagen.')
          return
        }
      }
    }

    const customTechnique = customTechniques.find((entry) => entry.id === selectedNodeId)
    if (customTechnique) {
      const merged = Array.from(new Set([...(customTechnique.recommendedArchetypeIds ?? []), ...recommendedArchetypeIds]))
      updateCustomTechnique(customTechnique.id, { recommendedArchetypeIds: merged })
    }

    setMapping(false)
    setSuccess(
      selectedClipIds.length > 1 || targetNodeIds.length > 1
        ? `${selectedClipIds.length} Quellen mit ${targetNodeIds.length} Technik-Slot${targetNodeIds.length === 1 ? '' : 's'} verknuepft.`
        : 'Quelle mit Technik-Slot verknuepft.'
    )
    await loadNodeClipGroups(selectedNodeId)
  }

  function handleToggleRecommendedArchetype(archetypeId: string) {
    setRecommendedArchetypeIds((current) =>
      current.includes(archetypeId) ? current.filter((entry) => entry !== archetypeId) : [...current, archetypeId]
    )
  }

  async function handleSaveRecommendedArchetypes() {
    const customTechnique = customTechniques.find((entry) => entry.id === selectedNodeId)
    if (!customTechnique) {
      setError('Archetypen-Empfehlungen koennen aktuell nur fuer Custom-Techniken direkt gespeichert werden.')
      return
    }

    setSavingArchetypes(true)
    updateCustomTechnique(customTechnique.id, { recommendedArchetypeIds })
    setSavingArchetypes(false)
    setSuccess('Archetypen-Empfehlungen gespeichert.')
  }

  async function handleMoveAssignedClip(clip: ImportedSource, role: ExternalSourceRole) {
    if (!clip.id || !clip.assignment_id) {
      setError('Dieser Clip hat keine bearbeitbare Zuordnung.')
      return
    }

    setMapping(true)
    setError(null)
    setSuccess(null)

    const headers = await getAuthHeaders()
    const response = await fetch('/api/admin/clip-archive-assignments', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        assignmentId: clip.assignment_id,
        clipId: clip.id,
        role,
        contentType: selectedContentType,
        learningPhase: selectedLearningPhase,
        targetArchetypeIds: recommendedArchetypeIds,
      }),
    })
    const payload = await parseJsonResponse<{ error?: string }>(response)
    setMapping(false)

    if (!response.ok) {
      setError(payload.error ?? 'Clip konnte nicht verschoben werden.')
      return
    }

    setSelectedRole(role)
    setSelectedSourceId(clip.id)
    setSuccess(`Clip nach ${getExternalSourceRoleLabel(role)} verschoben.`)
    await loadNodeClipGroups(selectedNodeId)
  }

  const roleCards = ROLE_OPTIONS.map((role) => ({
    ...role,
    clips: nodeClipGroups[role.id] ?? [],
  }))

  const filteredSources = useMemo(() => {
    if (!sourcesFilterTerm.trim()) return sources
    const term = sourcesFilterTerm.toLowerCase()
    return sources.filter(s => 
      s.title.toLowerCase().includes(term) ||
      (s.summary?.toLowerCase() ?? '').includes(term) ||
      s.hashtags.some(h => h.toLowerCase().includes(term))
    )
  }, [sources, sourcesFilterTerm])

  return (
    <div className="space-y-6">
      {/* 1. OutlierDB Suche - Horizontal oben */}
      <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Admin Import</p>
              <h1 className="mt-2 font-display text-3xl font-black">OutlierDB Scraper</h1>
            </div>
          </div>
          
          {/* Suchmodus Auswahl */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setMode('tag_search')}
              className={`rounded-2xl px-4 py-4 text-left transition-colors ${mode === 'tag_search' ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted hover:border-bjj-gold/30'}`}
            >
              <div className="flex items-center gap-2 text-sm font-black">
                <Hash className="h-4 w-4" />
                Hashtag Search
              </div>
              <p className="mt-2 text-xs opacity-80">Nutzt `/search` direkt mit Hashtags.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('ai_chat')}
              className={`rounded-2xl px-4 py-4 text-left transition-colors ${mode === 'ai_chat' ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted hover:border-bjj-gold/30'}`}
            >
              <div className="flex items-center gap-2 text-sm font-black">
                <Bot className="h-4 w-4" />
                AI Search
              </div>
              <p className="mt-2 text-xs opacity-80">Nutzt `/chat` mit AI-generierten Referenzen.</p>
            </button>
          </div>

          {/* Suchformular - Horizontal */}
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Search Label</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3">
                <Search className="h-4 w-4 text-bjj-muted" />
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="z. B. Nogi Ashi Garami"
                  className="w-full bg-transparent text-sm text-bjj-text outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">
                {mode === 'ai_chat' ? 'AI Prompt' : 'Import Query'}
              </label>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={mode === 'ai_chat' ? 'z. B. Nogi Ashi Garami mit Entries' : 'z. B. nogi resource'}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing || !label.trim() || !query.trim() || !outlierToken.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-bjj-gold px-6 py-3 text-sm font-black text-bjj-coal transition-colors hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {importing ? 'Import...' : 'Suche starten'}
            </button>
          </div>

          {/* Erweiterte Optionen - Kollabierbar */}
          <details className="rounded-2xl border border-bjj-border bg-bjj-surface">
            <summary className="cursor-pointer list-none p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Erweiterte Optionen</span>
                <ChevronDown className="h-4 w-4 text-bjj-muted" />
              </div>
            </summary>
            <div className="border-t border-bjj-border p-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Stil</label>
                  <select
                    value={styleCoverage}
                    onChange={(event) => setStyleCoverage(normalizeTechniqueStyleCoverage(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3 text-sm text-bjj-text outline-none"
                  >
                    <option value="gi">Gi</option>
                    <option value="nogi">No-Gi</option>
                    <option value="both">Gi & No-Gi</option>
                  </select>
                </div>

                {mode === 'tag_search' ? (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Limit</label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={limit}
                      onChange={(event) => setLimit(Math.min(Math.max(Number(event.target.value) || 1, 1), 25))}
                      className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3 text-sm text-bjj-text outline-none"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Bearer Token</label>
                  <div className="mt-2 flex items-center gap-3 rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3">
                    <KeyRound className="h-4 w-4 text-bjj-muted" />
                    <input
                      type="password"
                      value={outlierToken}
                      onChange={(event) => setOutlierToken(event.target.value)}
                      placeholder="Token eingeben"
                      className="w-full bg-transparent text-sm text-bjj-text outline-none"
                    />
                  </div>
                </div>
              </div>

              {mode === 'tag_search' ? (
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Hashtags</label>
                  <input
                    value={hashtagsInput}
                    onChange={(event) => setHashtagsInput(event.target.value)}
                    placeholder="#nogi, #resource"
                    className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3 text-sm text-bjj-text outline-none"
                  />
                </div>
              ) : null}
            </div>
          </details>

          {success ? <div className="rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-3 text-sm text-bjj-text">{success}</div> : null}
          {error ? <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div> : null}

          {importSummary ? (
            <div className="rounded-2xl border border-bjj-border bg-bjj-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Letzter Import</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-bjj-muted">
                <span>Modus: {importSummary.mode ? getRunModeLabel(importSummary.mode) : 'Unbekannt'}</span>
                <span>Importiert: {importSummary.importedCount ?? 0}</span>
                <span>Gruppen: {importSummary.groupCount ?? 0}</span>
                <span>AI-Abschnitte: {importSummary.sections?.length ?? 0}</span>
                <span>Mehr Seiten: {importSummary.hasMore ? 'Ja' : 'Nein'}</span>
                <span>Fehler: {importSummary.failed?.length ?? 0}</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* 2. Letzte Suchlaeufe */}
      <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Search History</p>
            <h2 className="mt-2 text-2xl font-black text-white">Letzte Suchlaeufe</h2>
          </div>
          {selectedRunId && (
            <button
              type="button"
              onClick={() => {
                setSelectedRunId(null)
                setShowAllScrapedVideos(true)
                void loadSources('', null)
              }}
              className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm font-semibold text-white hover:border-bjj-gold/30"
            >
              Alle anzeigen
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {loadingRuns ? (
            <>
              <div className="h-24 rounded-2xl border border-bjj-border bg-bjj-surface shimmer" />
              <div className="h-24 rounded-2xl border border-bjj-border bg-bjj-surface shimmer" />
              <div className="h-24 rounded-2xl border border-bjj-border bg-bjj-surface shimmer" />
              <div className="h-24 rounded-2xl border border-bjj-border bg-bjj-surface shimmer" />
            </>
          ) : null}
          {!loadingRuns && searchRuns.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
              Noch keine Suchlaeufe gespeichert.
            </div>
          ) : null}
          {searchRuns.map((run) => {
            const active = run.id === selectedRunId

            return (
              <button
                key={run.id}
                type="button"
                onClick={() => void handleRunSelect(run.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  active ? 'border-bjj-gold/40 bg-bjj-gold/10' : 'border-bjj-border bg-bjj-surface hover:border-bjj-gold/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white line-clamp-1">{run.label}</p>
                  <span className="shrink-0 rounded-full border border-bjj-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-bjj-muted">
                    {getRunModeLabel(run.mode)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-bjj-muted">{run.query ?? 'Ohne Query'}</p>
                <p className="mt-3 text-xs text-bjj-muted">
                  {new Date(run.created_at).toLocaleString('de-DE')} • {run.imported_count} Treffer
                </p>
              </button>
            )
          })}
        </div>
      </section>

      {/* 3. Gescrapte Videos - Nur anzeigen wenn explizit gewaehlt oder Suche aktiv */}
      {(showAllScrapedVideos || selectedRunId) && (
        <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Imported Sources</p>
              <h2 className="mt-2 text-2xl font-black text-white">Gescrapte Videos</h2>
              {selectedRun ? (
                <p className="mt-1 text-sm text-bjj-muted">
                  Aktiver Lauf: {selectedRun.label} • {getRunModeLabel(selectedRun.mode)}
                </p>
              ) : null}
            </div>
            <div className="flex gap-3">
              <input
                value={sourcesFilterTerm}
                onChange={(event) => setSourcesFilterTerm(event.target.value)}
                placeholder="Videos filtern..."
                className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none lg:w-64"
              />
              <button
                type="button"
                onClick={() => setShowAllScrapedVideos(false)}
                className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm font-semibold text-bjj-muted hover:text-white"
              >
                Verbergen
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">
              Auswahl: {selectedSourceIds.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedSourceIds(selectableSourceIds)
                if (!selectedSourceId) {
                  setSelectedSourceId(selectableSourceIds[0] ?? null)
                }
              }}
              disabled={selectableSourceIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-bjj-border bg-bjj-card px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Alle sichtbaren auswaehlen
            </button>
            <button
              type="button"
              onClick={() => setSelectedSourceIds([])}
              disabled={selectedSourceIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-bjj-border bg-bjj-card px-4 py-2 text-xs font-semibold text-bjj-muted disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5" />
              Auswahl leeren
            </button>
            <p className="text-xs text-bjj-muted">
              Ohne Auswahl wird der rechts geoeffnete Clip gespeichert.
            </p>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px] items-start">
            {/* Linke Spalte - Scrollbare Video-Liste */}
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
              {loadingSources ? <div className="h-32 rounded-3xl border border-bjj-border bg-bjj-surface shimmer" /> : null}
              {!loadingSources && filteredSources.length === 0 ? (
                <div className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
                  Keine Quellen gefunden.
                </div>
              ) : null}

              {selectedRun?.mode === 'ai_chat' && groupedSections.length > 0
                ? groupedSections.map((section) => (
                    (() => {
                      const renderedSection = getSectionBlocksWithSources(section)

                      return (
                        <div key={section.id} className="rounded-[1.6rem] border border-bjj-border bg-bjj-surface p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">AI Abschnitt</p>
                              <h3 className="mt-2 text-lg font-black text-white">{section.sectionTitle}</h3>
                            </div>
                            <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
                              {section.sources.length}
                            </span>
                          </div>

                          <div className="mt-4 space-y-4">
                            {renderedSection.blocks.map((block) => (
                              <div key={`${section.id}:${block.text.slice(0, 40)}`} className="space-y-3">
                                <div className="rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3">
                                  <p className="whitespace-pre-line text-sm leading-7 text-bjj-text">{block.text}</p>
                                </div>
                                {block.sources.length > 0 ? (
                                  <div className="space-y-3 pl-3">
                                    {block.sources.map((source) => (
                                      <SourceCard
                                        key={`${section.id}:${source.id ?? source.source_url}`}
                                        source={source}
                                        active={source.id === selectedSourceId}
                                        selected={Boolean(source.id && selectedSourceIds.includes(source.id))}
                                        onSelect={() => handleSelectSource(source.id)}
                                        onToggleSelection={() => handleToggleSourceSelection(source.id)}
                                      />
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}

                            {renderedSection.remainingSources.length > 0 ? (
                              <div className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-gold">Weitere Quellen Zu Diesem Abschnitt</p>
                                {renderedSection.remainingSources.map((source) => (
                                  <div key={`${section.id}:fallback:${source.id ?? source.source_url}`} className="space-y-2">
                                    {source.evidenceText ? (
                                      <div className="rounded-2xl border border-bjj-gold/15 bg-bjj-card px-4 py-3">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-gold">AI Verweist Hierauf</p>
                                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-bjj-text">{source.evidenceText}</p>
                                      </div>
                                    ) : null}
                                    <SourceCard
                                      source={source}
                                      active={source.id === selectedSourceId}
                                      selected={Boolean(source.id && selectedSourceIds.includes(source.id))}
                                      onSelect={() => handleSelectSource(source.id)}
                                      onToggleSelection={() => handleToggleSourceSelection(source.id)}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })()
                  ))
                : filteredSources.map((source) => (
                    <SourceCard
                      key={source.id ?? source.source_url}
                      source={source}
                      active={source.id === selectedSourceId}
                      selected={Boolean(source.id && selectedSourceIds.includes(source.id))}
                      onSelect={() => handleSelectSource(source.id)}
                      onToggleSelection={() => handleToggleSourceSelection(source.id)}
                    />
                  ))}
            </div>

            {/* Rechte Spalte - Sticky Detail-Panel */}
            <div className="sticky top-6 rounded-[1.8rem] border border-bjj-border bg-bjj-surface p-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              {!selectedSource ? (
                <div className="rounded-2xl border border-bjj-border bg-bjj-card px-4 py-5 text-sm text-bjj-muted">
                  Waehle links eine Quelle aus.
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Quelle</p>
                    <h3 className="mt-2 text-xl font-black text-white">{selectedSource.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {selectedSource.id ? (
                        <Link href={`/clips/${selectedSource.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-bjj-gold">
                          <Link2 className="h-4 w-4" />
                          Interne Clip-Seite
                        </Link>
                      ) : null}
                      <a href={selectedSource.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-bjj-gold">
                        <Link2 className="h-4 w-4" />
                        OutlierDB oeffnen
                      </a>
                      {selectedSource.video_url ? (
                        <a href={getSourcePreviewUrl(selectedSource)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-bjj-gold">
                          <Link2 className="h-4 w-4" />
                          Video an exakter Stelle oeffnen
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {selectedSource.video_url ? (
                    <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Video Vorschau</p>
                      <div className="outlierdb-mini-preview mt-3">
                        <YoutubeEmbed
                          title={selectedSource.title}
                          url={getSourcePreviewUrl(selectedSource)}
                          showHeader={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-bjj-border bg-bjj-card px-4 py-5 text-sm text-bjj-muted">
                      Kein Video fuer die Vorschau erkannt.
                    </div>
                  )}

                  <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Metadata</p>
                    <div className="mt-3 space-y-2 text-sm text-bjj-muted">
                      <p>Quelle: {selectedSource.video_platform ?? selectedSource.provider}</p>
                      <p>Timestamp: {selectedSource.timestamp_label ?? 'Keiner erkannt'}</p>
                      <p>Video URL: {selectedSource.video_url ?? 'Nicht erkannt'}</p>
                      <p>Stil: {getTechniqueCoverageLabel(selectedSource.style_coverage ?? 'both')}</p>
                    </div>
                    {selectedSource.hashtags.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedSource.hashtags.map((tag) => (
                          <span key={tag} className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-bjj-muted">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="outlierdb-description-edit">
                      Beschreibung bearbeiten
                    </label>
                    <textarea
                      id="outlierdb-description-edit"
                      value={selectedSourceSummaryDraft}
                      onChange={(event) =>
                        setEditedSummaryById((current) => ({
                          ...current,
                          [getSourceEditKey(selectedSource)]: event.target.value,
                        }))
                      }
                      className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm leading-7 text-bjj-text outline-none focus:border-bjj-gold/60"
                    />
                  </div>

                  <details className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">
                      Outlier Debug
                    </summary>
                    <div className="mt-4 space-y-4 text-sm text-bjj-muted">
                      <div className="space-y-2">
                        <p>Geladene Outlier-URL: {selectedSourceDebug?.resolved_deeplink ?? 'Nicht gespeichert'}</p>
                        <p>Fetch-Art: {selectedSourceDebug?.fetch_kind ?? 'Unbekannt'}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Feldquellen</p>
                        <pre className="mt-2 overflow-x-auto rounded-2xl border border-bjj-border bg-bjj-surface p-3 text-xs leading-6 text-bjj-text whitespace-pre-wrap">
{JSON.stringify(selectedSourceDebug?.field_sources ?? { status: 'Keine Debugdaten gespeichert' }, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Extrahierte Werte</p>
                        <pre className="mt-2 overflow-x-auto rounded-2xl border border-bjj-border bg-bjj-surface p-3 text-xs leading-6 text-bjj-text whitespace-pre-wrap">
{JSON.stringify(selectedSourceDebug?.extracted ?? { status: 'Keine Debugdaten gespeichert' }, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Iframe Snippet</p>
                        <pre className="mt-2 overflow-x-auto rounded-2xl border border-bjj-border bg-bjj-surface p-3 text-xs leading-6 text-bjj-text whitespace-pre-wrap">
{selectedSourceDebug?.html_snippets?.iframe ?? 'Nicht erkannt'}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Hashtag-Buttons</p>
                        <pre className="mt-2 overflow-x-auto rounded-2xl border border-bjj-border bg-bjj-surface p-3 text-xs leading-6 text-bjj-text whitespace-pre-wrap">
{(selectedSourceDebug?.html_snippets?.hashtag_buttons ?? []).length > 0
  ? (selectedSourceDebug?.html_snippets?.hashtag_buttons ?? []).join('\n\n')
  : 'Nicht erkannt'}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Beschreibungs-Absatz</p>
                        <pre className="mt-2 overflow-x-auto rounded-2xl border border-bjj-border bg-bjj-surface p-3 text-xs leading-6 text-bjj-text whitespace-pre-wrap">
{selectedSourceDebug?.html_snippets?.description_paragraph ?? 'Nicht erkannt'}
                        </pre>
                      </div>
                    </div>
                  </details>

                  {/* Mapping Panel */}
                  <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">
                      <Database className="h-4 w-4" />
                      Technik-Slot waehlen
                    </p>

                    <div className="mt-4 space-y-4">
                        <select
                          value={selectedNodeId}
                          onChange={(event) => setSelectedNodeId(event.target.value)}
                          className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                        >
                          {techniqueOptions.map((technique) => (
                            <option key={technique.id} value={technique.id}>
                              {technique.title} • {technique.subtitle}
                            </option>
                          ))}
                        </select>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {ROLE_OPTIONS.map((role) => (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => setSelectedRole(role.id)}
                              className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                                selectedRole === role.id ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted'
                              }`}
                            >
                              {role.label}
                            </button>
                          ))}
                        </div>

                        {selectedRole === 'related_reference' ? (
                          <div className="rounded-2xl border border-bjj-border bg-bjj-surface p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Follow-up Zielnodes</p>
                                <p className="mt-2 text-sm text-bjj-muted">
                                  Optional: Wenn der Follow-up-Clip fuer weitere Techniken gelten soll, markiere sie hier. Ohne Auswahl bleibt er allgemein beim oben gewaehlten Node.
                                </p>
                              </div>
                              <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-bjj-muted">
                                {followUpNodeIds.length}
                              </span>
                            </div>
                            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                              {techniqueOptions
                                .filter((technique) => technique.id !== selectedNodeId)
                                .map((technique) => {
                                  const active = followUpNodeIds.includes(technique.id)
                                  return (
                                    <button
                                      key={technique.id}
                                      type="button"
                                      onClick={() => handleToggleFollowUpNode(technique.id)}
                                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                                        active ? 'border-bjj-gold bg-bjj-gold/10 text-white' : 'border-bjj-border bg-bjj-card text-bjj-muted'
                                      }`}
                                    >
                                      <span className="font-semibold">{technique.title}</span>
                                      <span className="ml-2 text-xs text-bjj-muted">{technique.subtitle}</span>
                                    </button>
                                  )
                                })}
                            </div>
                          </div>
                        ) : null}

                        <div className="grid gap-3 rounded-2xl border border-bjj-border bg-bjj-surface p-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Clip-Art</p>
                            <p className="mt-2 text-sm text-bjj-muted">Was passiert in diesem Video?</p>
                            <select
                              value={selectedContentType}
                              onChange={(event) => setSelectedContentType(event.target.value as ClipContentType)}
                              className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3 text-sm text-bjj-text outline-none"
                            >
                              {CLIP_CONTENT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {getClipContentTypeLabel(type)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Lernphase</p>
                            <p className="mt-2 text-sm text-bjj-muted">Wann soll der Algorithmus den Clip eher zeigen?</p>
                            <select
                              value={selectedLearningPhase}
                              onChange={(event) => setSelectedLearningPhase(event.target.value as ClipLearningPhase)}
                              className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3 text-sm text-bjj-text outline-none"
                            >
                              {CLIP_LEARNING_PHASES.map((phase) => (
                                <option key={phase} value={phase}>
                                  {getClipLearningPhaseLabel(phase)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Geeignete Koerpertypen / Archetypen</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {ARCHETYPES.map((archetype) => {
                              const active = recommendedArchetypeIds.includes(archetype.id)
                              return (
                                <button
                                  key={archetype.id}
                                  type="button"
                                  onClick={() => handleToggleRecommendedArchetype(archetype.id)}
                                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                                    active ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted'
                                  }`}
                                >
                                  {archetype.name}
                                </button>
                              )
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleSaveRecommendedArchetypes()}
                            disabled={savingArchetypes}
                            className="inline-flex items-center gap-2 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm font-semibold text-white transition hover:border-bjj-gold/30 hover:text-bjj-gold disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                            {savingArchetypes ? 'Speichert...' : 'Archetypen-Empfehlungen speichern'}
                          </button>
                        </div>

                      <textarea
                        value={mappingNotes}
                        onChange={(event) => setMappingNotes(event.target.value)}
                        rows={4}
                        placeholder="Optional: kurze Notiz fuer diese Verknuepfung"
                        className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => void handleMapSource()}
                        disabled={mapping}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-bjj-gold px-6 py-4 text-base font-black text-bjj-coal transition-colors hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        {mapping ? 'Verknuepfe...' : `${selectedClipIds.length} Clip${selectedClipIds.length === 1 ? '' : 's'} verknuepfen`}
                      </button>
                    </div>
                  </div>

                  {/* Technik-Kontext */}
                  <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Technik-Kontext</p>
                    {!selectedTechnique ? (
                      <p className="mt-3 text-sm text-bjj-muted">Keine Technik ausgewaehlt.</p>
                    ) : (
                      <div className="mt-4 space-y-5">
                        <div>
                          <p className="text-sm font-black text-white">{selectedTechnique.title}</p>
                          <p className="mt-1 text-sm text-bjj-muted">{selectedTechnique.subtitle}</p>
                          <p className="mt-3 text-sm leading-7 text-bjj-text">{selectedTechnique.description}</p>
                          {recommendedArchetypeIds.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {recommendedArchetypeIds.map((id) => {
                                const archetype = ARCHETYPES.find((entry) => entry.id === id)
                                return archetype ? (
                                  <span key={id} className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-bjj-gold">
                                    {archetype.name}
                                  </span>
                                ) : null
                              })}
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">
                            <Play className="h-4 w-4" />
                            Technik-eigene Videos ({selectedTechnique.videos.length})
                          </p>
                          {selectedTechnique.videos.length === 0 ? (
                            <p className="mt-3 text-sm text-bjj-muted">In der Technik selbst sind aktuell noch keine direkten Videos hinterlegt.</p>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {selectedTechnique.videos.map((video) => (
                                <a
                                  key={video.id}
                                  href={video.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 transition hover:border-bjj-gold/30"
                                >
                                  <p className="text-sm font-semibold text-white">{video.title}</p>
                                  <p className="mt-1 text-xs text-bjj-muted">{video.platform}</p>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          {roleCards.map((role) => (
                            <div key={role.id} className="rounded-2xl border border-bjj-border bg-bjj-surface p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">{role.label}</p>
                                <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-bjj-muted">
                                  {role.clips.length}
                                </span>
                              </div>
                              {role.clips.length === 0 ? (
                                <p className="mt-3 text-sm text-bjj-muted">
                                  {role.id === 'related_reference'
                                    ? 'Noch keine Follow-Up-Videos verknuepft.'
                                    : 'Noch keine zugeordneten Videos in diesem Bereich.'}
                                </p>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  {role.clips.map((clip) => (
                                    <button
                                      key={clip.id ?? clip.source_url}
                                      type="button"
                                      onClick={() => setSelectedSourceId(clip.id ?? null)}
                                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                        clip.id === selectedSourceId ? 'border-bjj-gold/40 bg-bjj-gold/10' : 'border-bjj-border bg-bjj-card hover:border-bjj-gold/20'
                                      }`}
                                    >
                                      <p className="text-sm font-semibold text-white">{clip.title}</p>
                                      <p className="mt-1 text-xs text-bjj-muted">{clip.timestamp_label ?? 'Kein Timestamp'} • {clip.video_platform ?? clip.provider}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-bjj-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-bjj-gold">
                                          {getClipLearningPhaseLabel(clip.learning_phase)}
                                        </span>
                                        <span className="rounded-full border border-bjj-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-bjj-muted">
                                          {getClipContentTypeLabel(clip.content_type)}
                                        </span>
                                        {clip.target_archetype_ids?.length ? (
                                          <span className="rounded-full border border-bjj-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-bjj-muted">
                                            {clip.target_archetype_ids.length} Typen
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-2 line-clamp-2 text-sm text-bjj-muted">{getSourceSummary(clip)}</p>
                                      {clip.assignment_id ? (
                                        <div className="mt-3 flex flex-wrap gap-2 border-t border-bjj-border pt-3">
                                          {ROLE_OPTIONS.filter((targetRole) => targetRole.id !== role.id).map((targetRole) => (
                                            <span
                                              key={targetRole.id}
                                              role="button"
                                              tabIndex={0}
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                void handleMoveAssignedClip(clip, targetRole.id)
                                              }}
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                  event.preventDefault()
                                                  event.stopPropagation()
                                                  void handleMoveAssignedClip(clip, targetRole.id)
                                                }
                                              }}
                                              className="rounded-full border border-bjj-border bg-bjj-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-bjj-muted transition hover:border-bjj-gold/40 hover:text-bjj-gold"
                                            >
                                              Nach {targetRole.label}
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
