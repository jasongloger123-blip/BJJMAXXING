'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, CheckCircle2, Database, Hash, KeyRound, Link2, Search, Sparkles } from 'lucide-react'
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
import { getNodeTechniqueCatalog } from '@/lib/technique-catalog'

type ImportedSource = {
  id?: string
  assignment_status?: string
  provider: string
  source_url: string
  source_type: string
  title: string
  video_url: string | null
  video_platform: string | null
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
  onSelect,
}: {
  source: ImportedSource
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
        active ? 'border-bjj-gold/40 bg-bjj-gold/10' : 'border-bjj-border bg-bjj-surface hover:border-bjj-gold/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{source.title}</p>
          <p className="mt-2 text-xs text-bjj-muted">
            {source.timestamp_label ?? 'Kein Timestamp'} • {source.video_platform ?? source.provider}
          </p>
        </div>
        <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
          {source.hashtags.length}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-bjj-muted">{getSourceSummary(source)}</p>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-gold">
        {getTechniqueCoverageLabel(source.style_coverage ?? 'both')}
      </p>
      <p className="mt-3 line-clamp-1 text-xs text-bjj-muted">{getReadableSourceUrl(source)}</p>
    </button>
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
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedRole, setSelectedRole] = useState<ExternalSourceRole>('main_reference')
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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedSource = useMemo(
    () => sources.find((entry) => entry.id === selectedSourceId) ?? importSummary?.imported?.find((entry) => entry.id === selectedSourceId) ?? null,
    [importSummary?.imported, selectedSourceId, sources]
  )
  const selectedSourceDebug = useMemo(() => (selectedSource ? getSourceDebug(selectedSource) : null), [selectedSource])

  const selectedRun = useMemo(
    () => searchRuns.find((entry) => entry.id === selectedRunId) ?? null,
    [searchRuns, selectedRunId]
  )
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
    setSelectedRunId((current) => current ?? runs[0]?.id ?? null)
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

  useEffect(() => {
    void loadSearchRuns()
    void loadSources('', null)
  }, [])

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
      await loadSources(searchTerm, payload.runId)
    } else {
      await loadSources(searchTerm, null)
    }
  }

  async function handleRunSelect(runId: string) {
    setSelectedRunId(runId)
    await loadSources(searchTerm, runId)
  }

  async function handleMapSource() {
    if (!selectedSourceId || !selectedNodeId) {
      setError('Bitte zuerst eine Quelle und einen Node auswaehlen.')
      return
    }

    setMapping(true)
    setError(null)
    setSuccess(null)

    const headers = await getAuthHeaders()
    const response = await fetch('/api/admin/clip-archive-assignments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        clipId: selectedSourceId,
        assignmentKind: 'node',
        nodeId: selectedNodeId,
        role: selectedRole,
        notes: mappingNotes.trim() || null,
      }),
    })

    const payload = await parseJsonResponse<{ error?: string }>(response)
    setMapping(false)

    if (!response.ok) {
      setError(payload.error ?? 'Mapping fehlgeschlagen.')
      return
    }

    const customTechnique = customTechniques.find((entry) => entry.id === selectedNodeId)
    if (customTechnique) {
      const merged = Array.from(new Set([...(customTechnique.recommendedArchetypeIds ?? []), ...recommendedArchetypeIds]))
      updateCustomTechnique(customTechnique.id, { recommendedArchetypeIds: merged })
    }

    setSuccess('Quelle mit Technik-Slot verknuepft.')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Admin Import</p>
          <h1 className="mt-3 font-display text-4xl font-black">OutlierDB Scraper</h1>
          <p className="mt-3 text-sm leading-7 text-bjj-muted">
            Zwei Suchmodi: direkte Hashtag-Suche und AI-Chat-Suche mit verlinkten Detailseiten.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('tag_search')}
              className={`rounded-2xl px-4 py-4 text-left ${mode === 'tag_search' ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted'}`}
            >
              <div className="flex items-center gap-2 text-sm font-black">
                <Hash className="h-4 w-4" />
                Hashtag Search
              </div>
              <p className="mt-2 text-xs opacity-80">Nutzt `/search` direkt mit Hashtags und Pagination.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('ai_chat')}
              className={`rounded-2xl px-4 py-4 text-left ${mode === 'ai_chat' ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted'}`}
            >
              <div className="flex items-center gap-2 text-sm font-black">
                <Bot className="h-4 w-4" />
                AI Search
              </div>
              <p className="mt-2 text-xs opacity-80">Nutzt `/chat`; ein Limit ist hier nicht relevant, weil OutlierDB die Referenzanzahl vorgibt.</p>
            </button>
          </div>

          <div className="mt-6 space-y-5">
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
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={mode === 'ai_chat' ? 4 : 2}
                placeholder={mode === 'ai_chat' ? 'z. B. Nogi Ashi Garami mit Entries, Defense und Finishes' : 'z. B. nogi resource'}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Stil</label>
              <select
                value={styleCoverage}
                onChange={(event) => setStyleCoverage(normalizeTechniqueStyleCoverage(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
              >
                <option value="gi">Gi</option>
                <option value="nogi">No-Gi</option>
                <option value="both">Gi & No-Gi</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">OutlierDB Bearer Token</label>
              <div className="mt-2 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-bjj-muted">
                  <KeyRound className="h-4 w-4" />
                  Nur fuer diesen Import verwenden
                </div>
                <textarea
                  value={outlierToken}
                  onChange={(event) => setOutlierToken(event.target.value)}
                  rows={4}
                  placeholder="Bearer Token aus DevTools einfuegen"
                  className="w-full bg-transparent text-sm text-bjj-text outline-none"
                />
              </div>
            </div>

            {mode === 'tag_search' ? (
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Hashtags</label>
                <textarea
                  value={hashtagsInput}
                  onChange={(event) => setHashtagsInput(event.target.value)}
                  rows={4}
                  placeholder="#nogi, #resource"
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                />
              </div>
            ) : null}

            {mode === 'tag_search' ? (
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Limit</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={limit}
                  onChange={(event) => setLimit(Math.min(Math.max(Number(event.target.value) || 1, 1), 25))}
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing || !label.trim() || !query.trim() || !outlierToken.trim()}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-bjj-gold px-6 py-4 text-lg font-black text-bjj-coal transition-colors hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-5 w-5" />
              {importing ? 'Import laeuft...' : mode === 'ai_chat' ? 'AI Search importieren' : 'Hashtag Search importieren'}
            </button>

            {success ? <div className="rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-3 text-sm text-bjj-text">{success}</div> : null}
            {error ? <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div> : null}

            {importSummary ? (
              <div className="rounded-2xl border border-bjj-border bg-bjj-surface p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Letzter Import</p>
                <div className="mt-3 space-y-2 text-sm text-bjj-muted">
                  <p>Modus: {importSummary.mode ? getRunModeLabel(importSummary.mode) : 'Unbekannt'}</p>
                  <p>Importiert: {importSummary.importedCount ?? 0}</p>
                  <p>Gruppen: {importSummary.groupCount ?? 0}</p>
                  <p>AI-Abschnitte: {importSummary.sections?.length ?? 0}</p>
                  <p>Hashtags: {importSummary.hashtags?.join(', ') || 'Keine'}</p>
                  <p>Mehr Seiten: {importSummary.hasMore ? 'Ja' : 'Nein'}</p>
                  <p>Fehler: {importSummary.failed?.length ?? 0}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Imported Sources</p>
              <h2 className="mt-2 text-3xl font-black text-white">OutlierDB Quellen</h2>
              {selectedRun ? (
                <p className="mt-2 text-sm text-bjj-muted">
                  Aktiver Lauf: {selectedRun.label} • {getRunModeLabel(selectedRun.mode)}
                </p>
              ) : null}
            </div>
            <div className="flex gap-3">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Quellen filtern"
                className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none lg:w-72"
              />
              <button
                type="button"
                onClick={() => void loadSources(searchTerm, selectedRunId)}
                className="rounded-2xl border border-bjj-border bg-bjj-surface px-5 py-3 text-sm font-semibold text-white"
              >
                Laden
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-3">
              {loadingSources ? <div className="h-32 rounded-3xl border border-bjj-border bg-bjj-surface shimmer" /> : null}
              {!loadingSources && sources.length === 0 ? (
                <div className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
                  Keine Quellen fuer diesen Suchlauf gefunden.
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
                                        onSelect={() => setSelectedSourceId(source.id ?? null)}
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
                                      onSelect={() => setSelectedSourceId(source.id ?? null)}
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
                : sources.map((source) => (
                    <SourceCard
                      key={source.id ?? source.source_url}
                      source={source}
                      active={source.id === selectedSourceId}
                      onSelect={() => setSelectedSourceId(source.id ?? null)}
                    />
                  ))}
            </div>

            <div className="rounded-[1.8rem] border border-bjj-border bg-bjj-surface p-5">
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
                        <a href={selectedSource.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-bjj-gold">
                          <Link2 className="h-4 w-4" />
                          Video an exakter Stelle oeffnen
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Metadata</p>
                    <div className="mt-3 space-y-2 text-sm text-bjj-muted">
                      <p>Timestamp: {selectedSource.timestamp_label ?? 'Keiner erkannt'}</p>
                      <p>Plattform: {selectedSource.video_platform ?? 'Unbekannt'}</p>
                      <p>Stil: {getTechniqueCoverageLabel(selectedSource.style_coverage ?? 'both')}</p>
                      <p>Query: {selectedSource.search_query ?? 'Keine'}</p>
                      <p>Video URL: {selectedSource.video_url ?? 'Nicht erkannt'}</p>
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
                    <p className="mt-4 text-sm leading-7 text-bjj-text">{getSourceSummary(selectedSource)}</p>
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

                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Empfohlene Archetypen</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {ARCHETYPES.map((archetype) => {
                              const active = recommendedArchetypeIds.includes(archetype.id)
                              return (
                                <button
                                  key={archetype.id}
                                  type="button"
                                  onClick={() =>
                                    setRecommendedArchetypeIds((current) =>
                                      current.includes(archetype.id)
                                        ? current.filter((entry) => entry !== archetype.id)
                                        : [...current, archetype.id]
                                    )
                                  }
                                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                                    active ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted'
                                  }`}
                                >
                                  {archetype.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                      <textarea
                        value={mappingNotes}
                        onChange={(event) => setMappingNotes(event.target.value)}
                        rows={4}
                        placeholder="Optional: kurze Technik fuer diese Verknuepfung"
                        className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => void handleMapSource()}
                        disabled={mapping}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-bjj-gold px-6 py-4 text-base font-black text-bjj-coal transition-colors hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        {mapping ? 'Verknuepfe...' : 'Mit Technik verknuepfen'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Search History</p>
            <h2 className="mt-2 text-3xl font-black text-white">Letzte Suchlaeufe</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedRunId(null)
              void loadSources(searchTerm, null)
            }}
            className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm font-semibold text-white"
          >
            Alle Quellen
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loadingRuns ? <div className="h-24 rounded-3xl border border-bjj-border bg-bjj-surface shimmer" /> : null}
          {!loadingRuns && searchRuns.length === 0 ? (
            <div className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
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
                  <p className="text-sm font-black text-white">{run.label}</p>
                  <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
                    {getRunModeLabel(run.mode)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-bjj-muted">{run.query ?? 'Ohne Query'}</p>
                <p className="mt-3 text-xs text-bjj-muted">
                  {new Date(run.created_at).toLocaleString('de-DE')} • {run.imported_count} Treffer
                </p>
                {run.hashtags.length > 0 ? (
                  <p className="mt-2 line-clamp-1 text-xs text-bjj-muted">{run.hashtags.join(', ')}</p>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
