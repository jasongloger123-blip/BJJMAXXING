'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  Hash,
  Layers,
  MoreHorizontal,
  Package,
  Play,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react'
import { ARCHETYPES } from '@/lib/archetypes'
import { createClient } from '@/lib/supabase/client'
import {
  CLIP_CONTENT_TYPES,
  CLIP_LEARNING_PHASES,
  getClipContentTypeLabel,
  getClipLearningPhaseLabel,
  type ClipContentType,
  type ClipLearningPhase,
} from '@/lib/clip-taxonomy'
import { getTechniqueCoverageLabel, type TechniqueStyleCoverage } from '@/lib/technique-style'
import { readCustomTechniques, CUSTOM_TECHNIQUES_EVENT } from '@/lib/custom-techniques'
import { getNodeTechniqueCatalog, type TechniqueCatalogEntry } from '@/lib/technique-catalog'
import { extractYoutubeId, extractInstagramPostId, detectVideoFormat } from '@/lib/video-format'

// Types
interface Clip {
  id: string
  title: string
  provider: string
  source_url: string
  video_url: string | null
  video_platform: string | null
  video_format: string | null
  style_coverage: TechniqueStyleCoverage
  content_type: ClipContentType | null
  learning_phase: ClipLearningPhase | null
  target_archetype_ids: string[] | null
  hashtags: string[]
  summary: string | null
  assignment_status: 'unassigned' | 'assigned' | 'hidden' | 'archived'
  created_at: string
  last_seen_at: string
  clip_assignments: ClipAssignment[]
}

interface ClipAssignment {
  id: string
  node_id: string
  role: 'main_reference' | 'counter_reference' | 'drill_reference' | 'related_reference'
  content_type: ClipContentType | null
  learning_phase: ClipLearningPhase | null
  target_archetype_ids: string[] | null
}

interface ClipResponse {
  clips: Clip[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats: {
    total: number
    unassigned: number
    assigned: number
    hidden: number
    archived: number
  }
  techniqueNames: Record<string, string>
  providers: string[]
}

type ClipStatus = Clip['assignment_status']

interface FilterState {
  query: string
  status: string
  contentType: string
  learningPhase: string
  styleCoverage: string
  techniqueId: string
  archetypeId: string
  provider: string
  dateFrom: string
  dateTo: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'unassigned', label: 'Nicht zugewiesen', color: 'bg-gray-500' },
  { value: 'assigned', label: 'Zugewiesen', color: 'bg-emerald-500' },
  { value: 'hidden', label: 'Versteckt', color: 'bg-amber-500' },
  { value: 'archived', label: 'Archiviert', color: 'bg-red-500' },
]

const STYLE_COVERAGE_OPTIONS = [
  { value: '', label: 'Alle Stile' },
  { value: 'gi', label: 'Gi' },
  { value: 'nogi', label: 'No-Gi' },
  { value: 'both', label: 'Gi & No-Gi' },
]

const ROLE_LABELS: Record<string, string> = {
  main_reference: 'Details',
  counter_reference: 'Counter',
  drill_reference: 'Drill',
  related_reference: 'Follow-up',
}

async function parseJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text()
  if (!text.trim()) {
    return { error: `Leere Server-Antwort (${response.status}).` } as T & { error?: string }
  }
  try {
    return JSON.parse(text) as T & { error?: string }
  } catch {
    return { error: text.slice(0, 400) } as T & { error?: string }
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(dateString: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Thumbnail URL generieren
function getThumbnailUrl(clip: Clip): string | null {
  const videoUrl = clip.video_url || clip.source_url
  if (!videoUrl) return null

  const format = clip.video_format || detectVideoFormat(videoUrl)

  // YouTube Thumbnail
  if (format === 'youtube' || format === 'youtube_shorts') {
    const videoId = extractYoutubeId(videoUrl)
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    }
  }

  // Instagram - leider keine direkten Thumbnails verfügbar ohne API
  // Wir zeigen einen Platzholder
  if (format === 'instagram_reel' || format === 'instagram_post') {
    return null // Platzholder wird angezeigt
  }

  return null
}

export default function AdminClipsPage() {
  const supabase = createClient()

  // State
  const [clips, setClips] = useState<Clip[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [stats, setStats] = useState({ total: 0, unassigned: 0, assigned: 0, hidden: 0, archived: 0 })
  const [techniqueNames, setTechniqueNames] = useState<Record<string, string>>({})
  const [providers, setProviders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    status: '',
    contentType: '',
    learningPhase: '',
    styleCoverage: '',
    techniqueId: '',
    archetypeId: '',
    provider: '',
    dateFrom: '',
    dateTo: '',
  })

  // Sortierung
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // UI State
  const [showFilters, setShowFilters] = useState(false)
  const [editingClip, setEditingClip] = useState<Clip | null>(null)
  const [assigningClip, setAssigningClip] = useState<Clip | null>(null)
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Delete Confirmation State
  const [clipToDelete, setClipToDelete] = useState<Clip | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Technik-Optionen
  const [customTechniques, setCustomTechniques] = useState(() => readCustomTechniques())

  useEffect(() => {
    const sync = () => setCustomTechniques(readCustomTechniques())
    window.addEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
    return () => window.removeEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
  }, [])

  const allTechniques = useMemo(() => {
    const custom = customTechniques.map((ct) => ({
      id: ct.id,
      title: ct.title,
      subtitle: ct.subtitle,
      category: 'Custom',
      level: 'custom',
      estimatedTime: '',
      description: '',
      parentIds: [],
      childrenIds: [],
      connectionIds: [],
    }))
    return [...getNodeTechniqueCatalog(), ...custom]
  }, [customTechniques])

  const filteredTechniqueOptions = useMemo(() => {
    const term = assignmentSearch.trim().toLowerCase()
    if (!term) return allTechniques.slice(0, 20)

    return allTechniques
      .filter((technique) => {
        const groupLabel = 'category' in technique ? technique.category : 'stage' in technique ? String(technique.stage) : ''
        return [technique.title, technique.subtitle, groupLabel].some((value) => value?.toLowerCase().includes(term))
      })
      .slice(0, 30)
  }, [allTechniques, assignmentSearch])

  // Archetype ID -> Name Lookup
  const archetypeNames = useMemo(() => {
    return Object.fromEntries(ARCHETYPES.map((a) => [a.id, a.name]))
  }, [])

  // Auth Headers
  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {}
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }
    return headers
  }

  // Clips laden
  const loadClips = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const queryParams = new URLSearchParams()

      queryParams.set('page', pagination.page.toString())
      queryParams.set('limit', pagination.limit.toString())
      queryParams.set('sortBy', sortBy)
      queryParams.set('sortOrder', sortOrder)

      if (filters.query) queryParams.set('query', filters.query)
      if (filters.status) queryParams.set('status', filters.status)
      if (filters.contentType) queryParams.set('contentType', filters.contentType)
      if (filters.learningPhase) queryParams.set('learningPhase', filters.learningPhase)
      if (filters.styleCoverage) queryParams.set('styleCoverage', filters.styleCoverage)
      if (filters.techniqueId) queryParams.set('techniqueId', filters.techniqueId)
      if (filters.archetypeId) queryParams.set('archetypeId', filters.archetypeId)
      if (filters.provider) queryParams.set('provider', filters.provider)
      if (filters.dateFrom) queryParams.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) queryParams.set('dateTo', filters.dateTo)

      const response = await fetch(`/api/admin/clips?${queryParams.toString()}`, {
        headers,
        cache: 'no-store',
      })

      const data = await parseJsonResponse<ClipResponse>(response)

      if (!response.ok) {
        setError(data.error ?? 'Clips konnten nicht geladen werden.')
        return
      }

      setClips(data.clips)
      setPagination(data.pagination)
      setStats(data.stats)
      setTechniqueNames(data.techniqueNames)
      setProviders(data.providers)
    } catch (err) {
      setError('Netzwerkfehler beim Laden der Clips.')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder, filters, supabase])

  // Pagination-Effekt
  useEffect(() => {
    loadClips()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, sortBy, sortOrder])

  // Filter anwenden
  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }))
    loadClips()
  }

  // Filter zurücksetzen
  const resetFilters = () => {
    setFilters({
      query: '',
      status: '',
      contentType: '',
      learningPhase: '',
      styleCoverage: '',
      techniqueId: '',
      archetypeId: '',
      provider: '',
      dateFrom: '',
      dateTo: '',
    })
    setPagination((prev) => ({ ...prev, page: 1 }))
    setTimeout(() => loadClips(), 0)
  }

  // Clip bearbeiten
  async function saveClipEdit(clipId: string, updates: Partial<Clip>) {
    setSaving(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ clipId, updates }),
      })

      const data = await parseJsonResponse<{ clip: Clip }>(response)

      if (!response.ok) {
        setError(data.error ?? 'Fehler beim Speichern.')
        return
      }

      setSuccessMessage('Clip erfolgreich aktualisiert.')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Clips neu laden
      loadClips()
      setEditingClip(null)
    } catch (err) {
      setError('Netzwerkfehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  // Clip löschen
  async function updateClipStatus(clip: Clip, status: ClipStatus) {
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ clipId: clip.id, updates: { assignment_status: status } }),
      })

      const data = await parseJsonResponse<{ clip: Clip }>(response)

      if (!response.ok) {
        setError(data.error ?? 'Status konnte nicht gespeichert werden.')
        return
      }

      setSuccessMessage(status === 'hidden' ? 'Clip deaktiviert.' : 'Clip aktiviert.')
      setTimeout(() => setSuccessMessage(null), 3000)
      void loadClips()
    } catch {
      setError('Netzwerkfehler beim Speichern des Status.')
    }
  }

  async function updateAllClipVisibility(action: 'activate_all' | 'deactivate_all') {
    setSaving(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ bulkAction: action }),
      })
      const data = await parseJsonResponse<{ ok?: boolean }>(response)

      if (!response.ok) {
        setError(data.error ?? 'Clips konnten nicht aktualisiert werden.')
        return
      }

      setSuccessMessage(action === 'deactivate_all' ? 'Alle Clips wurden deaktiviert.' : 'Alle Clips wurden aktiviert.')
      setTimeout(() => setSuccessMessage(null), 3000)
      void loadClips()
    } catch {
      setError('Netzwerkfehler beim Aktualisieren der Clips.')
    } finally {
      setSaving(false)
    }
  }

  async function assignClipToTechnique(clip: Clip, nodeId: string) {
    setSaving(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/clip-archive-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          clipId: clip.id,
          assignmentKind: 'node',
          nodeId,
          role: 'main_reference',
          contentType: clip.content_type,
          learningPhase: clip.learning_phase,
          targetArchetypeIds: clip.target_archetype_ids ?? [],
        }),
      })
      const data = await parseJsonResponse<{ ok?: boolean }>(response)

      if (!response.ok) {
        setError(data.error ?? 'Technik konnte nicht zugewiesen werden.')
        return
      }

      setSuccessMessage('Technik wurde zugewiesen.')
      setTimeout(() => setSuccessMessage(null), 3000)
      setAssigningClip(null)
      setAssignmentSearch('')
      void loadClips()
    } catch {
      setError('Netzwerkfehler beim Zuweisen der Technik.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteClip(clipId: string) {
    setDeleting(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/clips', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ clipId }),
      })

      const data = await parseJsonResponse<{ success?: boolean }>(response)

      if (!response.ok) {
        setError(data.error ?? 'Fehler beim Löschen.')
        return
      }

      setSuccessMessage('Clip erfolgreich gelöscht.')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Clips neu laden
      loadClips()
      setClipToDelete(null)
      setDeleteConfirmText('')
    } catch (err) {
      setError('Netzwerkfehler beim Löschen.')
    } finally {
      setDeleting(false)
    }
  }

  // Sortierung togglen
  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
    setTimeout(() => loadClips(), 0)
  }

  // Helper für Status-Badge
  const getStatusBadge = (status: string) => {
    const statusOpt = STATUS_OPTIONS.find((s) => s.value === status)
    if (!statusOpt) return null
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        status === 'unassigned' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30' :
        status === 'assigned' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
        status === 'hidden' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
        'bg-red-500/20 text-red-300 border border-red-500/30'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${statusOpt.color}`} />
        {statusOpt.label}
      </span>
    )
  }

  // Helper für Thumbnail
  const ThumbnailCell = ({ clip }: { clip: Clip }) => {
    const thumbnailUrl = getThumbnailUrl(clip)
    const videoUrl = clip.video_url || clip.source_url
    const format = clip.video_format || detectVideoFormat(videoUrl || '')

    return (
      <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-black">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={clip.title}
            fill
            className="object-cover"
            unoptimized // Thumbnails von externen URLs
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-bjj-surface">
            {format?.includes('instagram') ? (
              <span className="text-[10px] text-bjj-muted">IG</span>
            ) : (
              <Play className="h-5 w-5 text-bjj-muted" />
            )}
          </div>
        )}
        {/* Video-Format Badge */}
        <div className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 py-0.5 text-[8px] text-white">
          {format?.includes('youtube') ? 'YT' : format?.includes('instagram') ? 'IG' : format?.includes('tiktok') ? 'TT' : 'EXT'}
        </div>
      </div>
    )
  }

  // Helper für zugewiesene Techniken mit Namen
  const getAssignedTechniques = (clip: Clip) => {
    const assignments = clip.clip_assignments || []
    if (assignments.length === 0) {
      return (
        <button
          type="button"
          onClick={() => setAssigningClip(clip)}
          className="rounded-xl border border-bjj-border bg-bjj-surface px-3 py-2 text-left text-xs font-semibold text-bjj-gold transition hover:border-bjj-gold/40"
        >
          Technik zuweisen
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={() => setAssigningClip(clip)}
        className="flex flex-col gap-1 rounded-xl border border-transparent px-2 py-1 text-left transition hover:border-bjj-gold/30 hover:bg-bjj-surface"
      >
        {assignments.slice(0, 2).map((assignment) => {
          const techniqueName = techniqueNames[assignment.node_id]
          const displayName = techniqueName || assignment.node_id
          return (
            <div
              key={assignment.id}
              className="text-xs"
            >
              <span className="font-medium text-white truncate max-w-[150px] inline-block" title={displayName}>
                {displayName}
              </span>
              <span className="text-bjj-muted/60 text-[10px] ml-1">
                ({ROLE_LABELS[assignment.role] || assignment.role})
              </span>
            </div>
          )
        })}
        {assignments.length > 2 && (
          <span className="text-[10px] text-bjj-muted">+{assignments.length - 2} weitere</span>
        )}
      </button>
    )
  }

  // Helper für Archetypen
  const getArchetypeBadges = (clip: Clip) => {
    const archetypeIds = clip.target_archetype_ids || []
    if (archetypeIds.length === 0) return <span className="text-bjj-muted/50 italic text-xs">-</span>

    return (
      <div className="flex flex-wrap gap-1">
        {archetypeIds.slice(0, 3).map((archId) => {
          const archName = archetypeNames[archId] || archId
          return (
            <span
              key={archId}
              className="inline-block rounded bg-bjj-surface border border-bjj-border px-1.5 py-0.5 text-[10px] text-bjj-text"
              title={archName}
            >
              {archName.length > 12 ? archName.substring(0, 12) + '...' : archName}
            </span>
          )
        })}
        {archetypeIds.length > 3 && (
          <span className="text-[10px] text-bjj-muted">+{archetypeIds.length - 3}</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Admin Clips</p>
          <h1 className="mt-2 font-display text-3xl font-black text-white">Clip-Verwaltung</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-bjj-muted">
            Übersicht über alle Videos im Archiv. Filtere nach Status, Techniken, Datumsfeldern und mehr.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void updateAllClipVisibility('activate_all')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400/60 disabled:opacity-60"
          >
            <Eye className="h-4 w-4" />
            Alle aktivieren
          </button>
          <button
            type="button"
            onClick={() => void updateAllClipVisibility('deactivate_all')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-400/60 disabled:opacity-60"
          >
            <EyeOff className="h-4 w-4" />
            Alle deaktivieren
          </button>
          <Link
            href="/admin/outlierdb"
            className="inline-flex items-center gap-2 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm font-semibold text-white transition hover:border-bjj-gold/40 hover:text-bjj-gold"
          >
            <Database className="h-4 w-4" />
            OutlierDB
          </Link>
          <Link
            href="/admin/video-upload"
            className="inline-flex items-center gap-2 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm font-semibold text-white transition hover:border-bjj-gold/40 hover:text-bjj-gold"
          >
            <Tag className="h-4 w-4" />
            Video hochladen
          </Link>
        </div>
      </div>

      {/* Statistiken */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { value: stats.total, label: 'Gesamt', icon: Database, color: 'text-white' },
          { value: stats.unassigned, label: 'Nicht zugewiesen', icon: Package, color: 'text-gray-400' },
          { value: stats.assigned, label: 'Zugewiesen', icon: Check, color: 'text-emerald-400' },
          { value: stats.hidden, label: 'Versteckt', icon: EyeOff, color: 'text-amber-400' },
          { value: stats.archived, label: 'Archiviert', icon: Archive, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
            <div className="flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-xs text-bjj-muted">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter-Bereich */}
      <div className="rounded-[1.8rem] border border-bjj-border bg-bjj-card p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bjj-muted" />
              <input
                type="text"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="Titel oder Beschreibung durchsuchen..."
                className="w-full rounded-2xl border border-bjj-border bg-bjj-surface pl-11 pr-4 py-3 text-sm text-bjj-text outline-none transition focus:border-bjj-gold/50"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                showFilters
                  ? 'border-bjj-gold bg-bjj-gold text-bjj-coal'
                  : 'border-bjj-border bg-bjj-surface text-white hover:border-bjj-gold/40'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {Object.values(filters).some((v) => v && v !== filters.query) && (
                <span className="ml-1 rounded-full bg-bjj-orange px-2 py-0.5 text-xs">
                  {Object.values(filters).filter((v) => v && v !== filters.query).length}
                </span>
              )}
            </button>
            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-2 rounded-2xl bg-bjj-gold px-5 py-3 text-sm font-bold text-bjj-coal transition hover:bg-bjj-orange-light"
            >
              <Filter className="h-4 w-4" />
              Anwenden
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-bjj-muted">
            <span>{pagination.total} Clips</span>
            <span className="text-bjj-border">|</span>
            <span>Seite {pagination.page} von {pagination.totalPages}</span>
          </div>
        </div>

        {/* Erweiterte Filter */}
        {showFilters && (
          <div className="mt-5 grid gap-4 border-t border-bjj-border pt-5 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Clip-Art</label>
              <select
                value={filters.contentType}
                onChange={(e) => setFilters((f) => ({ ...f, contentType: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
              >
                <option value="">Alle Arten</option>
                {CLIP_CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>{getClipContentTypeLabel(type)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Lernphase</label>
              <select
                value={filters.learningPhase}
                onChange={(e) => setFilters((f) => ({ ...f, learningPhase: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
              >
                <option value="">Alle Phasen</option>
                {CLIP_LEARNING_PHASES.map((phase) => (
                  <option key={phase} value={phase}>{getClipLearningPhaseLabel(phase)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Stil</label>
              <select
                value={filters.styleCoverage}
                onChange={(e) => setFilters((f) => ({ ...f, styleCoverage: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
              >
                {STYLE_COVERAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Technik</label>
              <select
                value={filters.techniqueId}
                onChange={(e) => setFilters((f) => ({ ...f, techniqueId: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
              >
                <option value="">Alle Techniken</option>
                {allTechniques.map((tech) => (
                  <option key={tech.id} value={tech.id}>{tech.title} • {tech.subtitle}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Archetyp</label>
              <select
                value={filters.archetypeId}
                onChange={(e) => setFilters((f) => ({ ...f, archetypeId: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
              >
                <option value="">Alle Archetypen</option>
                {ARCHETYPES.map((arch) => (
                  <option key={arch.id} value={arch.id}>{arch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Provider</label>
              <select
                value={filters.provider}
                onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
              >
                <option value="">Alle Provider</option>
                {providers.map((provider) => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Von Datum</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Bis Datum</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2.5 text-sm text-bjj-text outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-2 text-sm text-bjj-muted transition hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Filter zurücksetzen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Erfolgsmeldung */}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Fehler */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Clips Tabelle */}
      <div className="rounded-[1.8rem] border border-bjj-border bg-bjj-card overflow-hidden shadow-card">
        {loading ? (
          <div className="p-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-bjj-surface shimmer" />
              ))}
            </div>
          </div>
        ) : clips.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="mx-auto mb-4 h-12 w-12 text-bjj-muted/30" />
            <p className="text-bjj-muted">Keine Clips gefunden.</p>
            <button
              onClick={resetFilters}
              className="mt-4 text-bjj-gold hover:underline"
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bjj-border bg-bjj-surface/50">
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">
                    Video
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button
                      onClick={() => toggleSort('title')}
                      className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold"
                    >
                      Titel
                      {sortBy === 'title' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">
                    Technik
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">
                    Archetypen
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button
                      onClick={() => toggleSort('assignment_status')}
                      className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold"
                    >
                      Status
                      {sortBy === 'assignment_status' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">
                    Taxonomie
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button
                      onClick={() => toggleSort('created_at')}
                      className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold"
                    >
                      <Calendar className="h-3 w-3" />
                      Erstellt
                      {sortBy === 'created_at' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bjj-border">
                {clips.map((clip) => (
                  <tr key={clip.id} className="hover:bg-bjj-surface/30 transition-colors">
                    {/* Thumbnail */}
                    <td className="px-3 py-3">
                      <ThumbnailCell clip={clip} />
                    </td>

                    {/* Titel & Beschreibung */}
                    <td className="px-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate max-w-[200px]" title={clip.title}>
                          {clip.title}
                        </p>
                        <p className="mt-1 text-xs text-bjj-muted line-clamp-1 max-w-[200px]">
                          {clip.summary || 'Keine Beschreibung'}
                        </p>
                        {clip.hashtags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {clip.hashtags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-0.5 rounded bg-bjj-surface px-1 py-0.5 text-[9px] text-bjj-muted"
                              >
                                <Hash className="h-2 w-2" />
                                {tag}
                              </span>
                            ))}
                            {clip.hashtags.length > 2 && (
                              <span className="text-[9px] text-bjj-muted">+{clip.hashtags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Techniken */}
                    <td className="px-3 py-3">
                      {getAssignedTechniques(clip)}
                    </td>

                    {/* Archetypen */}
                    <td className="px-3 py-3">
                      {getArchetypeBadges(clip)}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setAssigningClip(clip)}
                          className="text-left transition hover:opacity-80"
                          title="Technik direkt zuweisen"
                        >
                          {getStatusBadge(clip.assignment_status)}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void updateClipStatus(
                              clip,
                              clip.assignment_status === 'hidden'
                                ? clip.clip_assignments.length > 0
                                  ? 'assigned'
                                  : 'unassigned'
                                : 'hidden'
                            )
                          }
                          className="text-[10px] font-bold uppercase tracking-[0.12em] text-bjj-muted transition hover:text-bjj-gold"
                        >
                          {clip.assignment_status === 'hidden' ? 'Aktivieren' : 'Deaktivieren'}
                        </button>
                      </div>
                    </td>

                    {/* Taxonomie */}
                    <td className="px-3 py-3">
                      <div className="space-y-1 text-xs">
                        {clip.content_type && (
                          <span className="inline-block rounded bg-bjj-surface px-2 py-0.5 text-bjj-text whitespace-nowrap">
                            {getClipContentTypeLabel(clip.content_type)}
                          </span>
                        )}
                        {clip.learning_phase && (
                          <span className="inline-block rounded bg-bjj-surface px-2 py-0.5 text-bjj-muted whitespace-nowrap">
                            {getClipLearningPhaseLabel(clip.learning_phase)}
                          </span>
                        )}
                        {clip.style_coverage && (
                          <span className="inline-block rounded bg-bjj-surface px-2 py-0.5 text-bjj-muted whitespace-nowrap">
                            {getTechniqueCoverageLabel(clip.style_coverage)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Datum */}
                    <td className="px-3 py-3">
                      <div className="text-xs text-bjj-muted whitespace-nowrap">
                        <p>{formatDate(clip.created_at)}</p>
                        <p className="mt-1 text-[10px] text-bjj-muted/60">
                          {formatDateTime(clip.last_seen_at)}
                        </p>
                      </div>
                    </td>

                    {/* Aktionen */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/clips/${clip.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-bjj-border bg-bjj-surface p-2 text-bjj-muted transition hover:border-bjj-gold/40 hover:text-bjj-gold"
                          title="Clip ansehen"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setEditingClip(clip)}
                          className="inline-flex items-center justify-center rounded-xl border border-bjj-border bg-bjj-surface p-2 text-bjj-muted transition hover:border-bjj-gold/40 hover:text-bjj-gold"
                          title="Bearbeiten"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setClipToDelete(clip)}
                          className="inline-flex items-center justify-center rounded-xl border border-bjj-border bg-bjj-surface p-2 text-bjj-muted transition hover:border-red-500/40 hover:text-red-400"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && clips.length > 0 && (
          <div className="border-t border-bjj-border px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-bjj-muted">
                Zeige {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} von {pagination.total} Clips
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-bjj-border bg-bjj-surface px-4 py-2 text-sm text-white transition hover:border-bjj-gold/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Zurück
                </button>
                <span className="px-4 text-sm text-bjj-muted">
                  Seite {pagination.page} von {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-bjj-border bg-bjj-surface px-4 py-2 text-sm text-white transition hover:border-bjj-gold/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {assigningClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Technik zuweisen</p>
                <h2 className="mt-2 font-display text-2xl font-black text-white">{assigningClip.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssigningClip(null)
                  setAssignmentSearch('')
                }}
                className="rounded-xl border border-bjj-border bg-bjj-surface p-2 text-bjj-muted transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {assigningClip.clip_assignments.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-bjj-border bg-bjj-surface p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Aktuell zugewiesen</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {assigningClip.clip_assignments.map((assignment) => (
                    <span key={assignment.id} className="rounded-xl border border-bjj-border bg-bjj-card px-3 py-2 text-xs text-bjj-text">
                      {techniqueNames[assignment.node_id] ?? assignment.node_id}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Technik suchen</label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bjj-muted" />
                <input
                  type="text"
                  value={assignmentSearch}
                  onChange={(event) => setAssignmentSearch(event.target.value)}
                  placeholder="Half Guard, Standing, Mount..."
                  autoFocus
                  className="w-full rounded-2xl border border-bjj-border bg-bjj-surface py-3 pl-11 pr-4 text-sm text-bjj-text outline-none focus:border-bjj-gold/60"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {filteredTechniqueOptions.length === 0 ? (
                <div className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
                  Keine Technik gefunden.
                </div>
              ) : (
                filteredTechniqueOptions.map((technique) => {
                  const alreadyAssigned = assigningClip.clip_assignments.some((assignment) => assignment.node_id === technique.id)
                  return (
                    <button
                      key={technique.id}
                      type="button"
                      onClick={() => void assignClipToTechnique(assigningClip, technique.id)}
                      disabled={saving}
                      className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                        alreadyAssigned
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-bjj-border bg-bjj-surface hover:border-bjj-gold/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{technique.title}</p>
                          <p className="mt-1 text-xs text-bjj-muted">
                            {technique.subtitle ||
                              ('category' in technique ? technique.category : 'stage' in technique ? String(technique.stage) : 'Technik')}
                          </p>
                        </div>
                        {alreadyAssigned ? (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200">
                            Schon drauf
                          </span>
                        ) : (
                          <span className="rounded-full bg-bjj-gold px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-bjj-coal">
                            Zuweisen
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-black text-white">Clip bearbeiten</h2>
              <button
                onClick={() => setEditingClip(null)}
                className="rounded-xl border border-bjj-border bg-bjj-surface p-2 text-bjj-muted transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {/* Thumbnail Preview */}
              <div className="flex gap-4">
                <div className="relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-xl bg-black">
                  {getThumbnailUrl(editingClip) ? (
                    <Image
                      src={getThumbnailUrl(editingClip)!}
                      alt={editingClip.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-bjj-surface">
                      <Play className="h-8 w-8 text-bjj-muted" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-bjj-muted">ID: {editingClip.id}</p>
                  <p className="text-xs text-bjj-muted mt-1">Provider: {editingClip.provider}</p>
                  {editingClip.video_platform && (
                    <p className="text-xs text-bjj-muted mt-1">Plattform: {editingClip.video_platform}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Titel</label>
                <input
                  type="text"
                  value={editingClip.title}
                  onChange={(e) => setEditingClip((c) => c ? { ...c, title: e.target.value } : null)}
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Beschreibung / Zusammenfassung</label>
                <textarea
                  value={editingClip.summary || ''}
                  onChange={(e) => setEditingClip((c) => c ? { ...c, summary: e.target.value } : null)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Clip-Art</label>
                  <select
                    value={editingClip.content_type || ''}
                    onChange={(e) => setEditingClip((c) => c ? { ...c, content_type: (e.target.value as ClipContentType) || null } : null)}
                    className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                  >
                    <option value="">Nicht festgelegt</option>
                    {CLIP_CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>{getClipContentTypeLabel(type)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Lernphase</label>
                  <select
                    value={editingClip.learning_phase || ''}
                    onChange={(e) => setEditingClip((c) => c ? { ...c, learning_phase: (e.target.value as ClipLearningPhase) || null } : null)}
                    className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                  >
                    <option value="">Nicht festgelegt</option>
                    {CLIP_LEARNING_PHASES.map((phase) => (
                      <option key={phase} value={phase}>{getClipLearningPhaseLabel(phase)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Geeignete Archetypen</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {ARCHETYPES.map((archetype) => {
                    const isSelected = editingClip.target_archetype_ids?.includes(archetype.id) ?? false
                    return (
                      <button
                        key={archetype.id}
                        type="button"
                        onClick={() => {
                          setEditingClip((c) => {
                            if (!c) return null
                            const currentIds = c.target_archetype_ids || []
                            const newIds = currentIds.includes(archetype.id)
                              ? currentIds.filter((id) => id !== archetype.id)
                              : [...currentIds, archetype.id]
                            return { ...c, target_archetype_ids: newIds }
                          })
                        }}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? 'border-bjj-gold bg-bjj-gold/10 text-white'
                            : 'border-bjj-border bg-bjj-surface text-bjj-muted hover:border-bjj-gold/30'
                        }`}
                      >
                        <div className={`h-4 w-4 rounded border ${isSelected ? 'bg-bjj-gold border-bjj-gold' : 'border-bjj-muted'} flex items-center justify-center`}>
                          {isSelected && <Check className="h-3 w-3 text-bjj-coal" />}
                        </div>
                        {archetype.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Stil</label>
                <select
                  value={editingClip.style_coverage || 'both'}
                  onChange={(e) => setEditingClip((c) => c ? { ...c, style_coverage: e.target.value as TechniqueStyleCoverage } : null)}
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                >
                  <option value="gi">Gi</option>
                  <option value="nogi">No-Gi</option>
                  <option value="both">Gi & No-Gi</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">Hashtags</label>
                <input
                  type="text"
                  value={editingClip.hashtags.join(', ')}
                  onChange={(e) => setEditingClip((c) => c ? { ...c, hashtags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : null)}
                  placeholder="tag1, tag2, tag3"
                  className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
                />
                <p className="mt-1 text-xs text-bjj-muted">Durch Kommas getrennt</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => saveClipEdit(editingClip.id, {
                    title: editingClip.title,
                    summary: editingClip.summary,
                    content_type: editingClip.content_type,
                    learning_phase: editingClip.learning_phase,
                    target_archetype_ids: editingClip.target_archetype_ids,
                    style_coverage: editingClip.style_coverage,
                    hashtags: editingClip.hashtags,
                  })}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-bjj-gold px-6 py-3 text-sm font-bold text-bjj-coal transition hover:bg-bjj-orange-light disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-bjj-coal/30 border-t-bjj-coal" />
                      Speichert...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Speichern
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditingClip(null)}
                  disabled={saving}
                  className="rounded-2xl border border-bjj-border bg-bjj-surface px-6 py-3 text-sm font-semibold text-white transition hover:border-bjj-gold/40"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {clipToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-8 w-8" />
              <h2 className="font-display text-xl font-black text-white">Clip löschen</h2>
            </div>

            <p className="mt-4 text-sm text-bjj-muted">
              Bist du sicher, dass du diesen Clip löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>

            <div className="mt-4 rounded-xl border border-bjj-border bg-bjj-surface p-3">
              <p className="font-medium text-white text-sm truncate">{clipToDelete.title}</p>
              <p className="text-xs text-bjj-muted mt-1">ID: {clipToDelete.id}</p>
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-bjj-gold">
                Gib &quot;LÖSCHEN&quot; ein, um zu bestätigen
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="LÖSCHEN"
                className="mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none focus:border-red-500/50"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => deleteClip(clipToDelete.id)}
                disabled={deleting || deleteConfirmText !== 'LÖSCHEN'}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Löscht...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Endgültig löschen
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setClipToDelete(null)
                  setDeleteConfirmText('')
                }}
                disabled={deleting}
                className="rounded-2xl border border-bjj-border bg-bjj-surface px-6 py-3 text-sm font-semibold text-white transition hover:border-bjj-gold/40"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
