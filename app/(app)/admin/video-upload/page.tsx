'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Link2, Loader2, ExternalLink, UploadCloud, Youtube } from 'lucide-react'
import { ARCHETYPES } from '@/lib/archetypes'
import {
  CLIP_CONTENT_TYPES,
  CLIP_LEARNING_PHASES,
  getClipContentTypeLabel,
  getClipLearningPhaseLabel,
  type ClipContentType,
  type ClipLearningPhase,
} from '@/lib/clip-taxonomy'
import { CUSTOM_TECHNIQUES_EVENT, readCustomTechniques } from '@/lib/custom-techniques'
import { LONG_FLEXIBLE_GUARD_NODES } from '@/lib/nodes'
import { createClient } from '@/lib/supabase/client'
import { extractYoutubeId } from '@/lib/video-format'

type ClipArchiveResponse = {
  error?: string
  existing?: boolean
  clip?: {
    id: string
    title: string
    source_url: string
    video_url: string | null
    video_format: string | null
    assignment_status: string
  }
}

const ASSIGNMENT_ROLE_OPTIONS = [
  { id: 'main_reference', label: 'Details' },
  { id: 'counter_reference', label: 'Counter' },
  { id: 'drill_reference', label: 'Drill' },
  { id: 'related_reference', label: 'Follow-up' },
] as const

type AssignmentRole = (typeof ASSIGNMENT_ROLE_OPTIONS)[number]['id']

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

function isValidYoutubeUrl(url: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return lower.includes('youtube.com') || lower.includes('youtu.be')
}

function buildYoutubeEmbedUrl(url: string) {
  const id = extractYoutubeId(url)
  if (!id) return null

  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    loop: '1',
    playlist: id,
  })

  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

function splitHashtags(value: string) {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim().replace(/^#/, ''))
    .filter(Boolean)
}

export default function AdminVideoUploadPage() {
  const [supabase] = useState(() => createClient())
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [hashtagsInput, setHashtagsInput] = useState('')
  const [customTechniques, setCustomTechniques] = useState(() => readCustomTechniques())
  const [selectedTechniqueId, setSelectedTechniqueId] = useState('')
  const [selectedRole, setSelectedRole] = useState<AssignmentRole>('main_reference')
  const [contentType, setContentType] = useState<ClipContentType>('technical_demo')
  const [learningPhase, setLearningPhase] = useState<ClipLearningPhase>('core_mechanic')
  const [targetArchetypeIds, setTargetArchetypeIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [savedClip, setSavedClip] = useState<ClipArchiveResponse['clip'] | null>(null)

  const trimmedUrl = url.trim()
  const isValidUrl = isValidYoutubeUrl(trimmedUrl)
  const youtubeEmbedUrl = useMemo(() => (isValidUrl ? buildYoutubeEmbedUrl(trimmedUrl) : null), [trimmedUrl, isValidUrl])
  const techniqueOptions = useMemo(() => {
    const baseTechniques = LONG_FLEXIBLE_GUARD_NODES.map((node) => ({
      id: node.id,
      title: node.title,
      subtitle: node.subtitle,
      source: 'Skill Tree',
    }))
    const customOptions = customTechniques.map((technique) => ({
      id: technique.id,
      title: technique.title,
      subtitle: technique.subtitle,
      source: 'Custom',
    }))

    return Array.from(new Map([...baseTechniques, ...customOptions].map((entry) => [entry.id, entry])).values()).sort((a, b) =>
      a.title.localeCompare(b.title, 'de')
    )
  }, [customTechniques])
  const selectedTechnique = techniqueOptions.find((technique) => technique.id === selectedTechniqueId) ?? null

  useEffect(() => {
    const sync = () => setCustomTechniques(readCustomTechniques())
    sync()
    window.addEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
    return () => window.removeEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!selectedTechniqueId && techniqueOptions.length > 0) {
      setSelectedTechniqueId(techniqueOptions[0]?.id ?? '')
    }
  }, [selectedTechniqueId, techniqueOptions])

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

  function toggleArchetype(id: string) {
    setTargetArchetypeIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    setSavedClip(null)

    if (!selectedTechniqueId) {
      setSaving(false)
      setError('Bitte zuerst eine Technik auswaehlen.')
      return
    }

    if (!isValidYoutubeUrl(trimmedUrl)) {
      setSaving(false)
      setError('Bitte gib eine gueltige YouTube-URL ein.')
      return
    }

    const headers = await getAuthHeaders()
    const response = await fetch('/api/admin/clip-archive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        url: trimmedUrl,
        title: title.trim() || null,
        summary: summary.trim() || null,
        hashtags: splitHashtags(hashtagsInput),
        contentType,
        learningPhase,
        targetArchetypeIds,
        loopSeconds: null,
      }),
    })

    const payload = await parseJsonResponse<ClipArchiveResponse>(response)

    if (!response.ok) {
      setSaving(false)
      setError(payload.error ?? 'Clip konnte nicht gespeichert werden.')
      return
    }

    setSavedClip(payload.clip ?? null)

    if (!payload.clip?.id) {
      setSaving(false)
      setError('Clip wurde gespeichert, aber die Clip-ID fehlt fuer die Technik-Zuordnung.')
      return
    }

    const assignmentResponse = await fetch('/api/admin/clip-archive-assignments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        clipId: payload.clip.id,
        assignmentKind: 'node',
        nodeId: selectedTechniqueId,
        role: selectedRole,
        contentType,
        learningPhase,
        targetArchetypeIds,
        notes: summary.trim() || null,
      }),
    })
    const assignmentPayload = await parseJsonResponse<{ ok?: boolean }>(assignmentResponse)
    setSaving(false)

    if (!assignmentResponse.ok) {
      setError(assignmentPayload.error ?? 'Clip gespeichert, aber die Technik-Zuordnung ist fehlgeschlagen.')
      return
    }

    const techniqueLabel = selectedTechnique ? ` fuer ${selectedTechnique.title}` : ''
    setSuccess(
      payload.existing
        ? `Clip war schon im Archiv und ist jetzt${techniqueLabel} verknuepft.`
        : `Clip wurde gespeichert und${techniqueLabel} verknuepft.`
    )
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Admin Clips</p>
          <h1 className="mt-2 font-display text-3xl font-black text-white">Video hochladen</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-bjj-muted">
            Speichere YouTube-Videos und Shorts direkt im Clip-Archiv. Der Clip wird automatisch der ausgewaehlten Technik zugeordnet.
          </p>
        </div>
        <Link
          href="/admin/outlierdb"
          className="inline-flex items-center gap-2 rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm font-semibold text-white transition hover:border-bjj-gold/40 hover:text-bjj-gold"
        >
          Clip Archiv
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded-[2rem] border border-bjj-border bg-bjj-card p-5 shadow-card">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="video-url">
              YouTube URL
            </label>
            <div className="mt-3 flex gap-3">
              <div className="relative min-w-0 flex-1">
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bjj-muted" />
                <input
                  id="video-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.youtube.com/shorts/... oder https://youtube.com/watch?v=..."
                  className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-11 py-3 text-sm text-bjj-text outline-none transition focus:border-bjj-gold/50"
                  required
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-bjj-muted">
              Nur YouTube-URLs werden unterstuetzt (Videos und Shorts).
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="clip-title">
                Titel
              </label>
              <input
                id="clip-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional, sonst automatisch"
                className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none transition focus:border-bjj-gold/50"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="clip-role">
                Bereich
              </label>
              <select
                id="clip-role"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as AssignmentRole)}
                className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
              >
                {ASSIGNMENT_ROLE_OPTIONS.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="clip-technique">
                Technik
              </label>
              <select
                id="clip-technique"
                value={selectedTechniqueId}
                onChange={(event) => setSelectedTechniqueId(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none transition focus:border-bjj-gold/50"
                required
              >
                {techniqueOptions.map((technique) => (
                  <option key={technique.id} value={technique.id}>
                    {technique.title} - {technique.subtitle} ({technique.source})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-bjj-muted">
                {techniqueOptions.length} Techniken aus Skill Tree und Custom-Techniken verfuegbar.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="clip-summary">
              Notiz
            </label>
            <textarea
              id="clip-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={4}
              placeholder="Was ist in dem Clip wichtig?"
              className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none transition focus:border-bjj-gold/50"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="clip-content-type">
                Clip-Art
              </label>
              <select
                id="clip-content-type"
                value={contentType}
                onChange={(event) => setContentType(event.target.value as ClipContentType)}
                className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
              >
                {CLIP_CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getClipContentTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="clip-learning-phase">
                Lernphase
              </label>
              <select
                id="clip-learning-phase"
                value={learningPhase}
                onChange={(event) => setLearningPhase(event.target.value as ClipLearningPhase)}
                className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none"
              >
                {CLIP_LEARNING_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {getClipLearningPhaseLabel(phase)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold" htmlFor="clip-hashtags">
              Hashtags
            </label>
            <input
              id="clip-hashtags"
              value={hashtagsInput}
              onChange={(event) => setHashtagsInput(event.target.value)}
              placeholder="#ashi, #guard, #nogi"
              className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text outline-none transition focus:border-bjj-gold/50"
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Geeignete Archetypen</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ARCHETYPES.map((archetype) => {
                const active = targetArchetypeIds.includes(archetype.id)
                return (
                  <button
                    key={archetype.id}
                    type="button"
                    onClick={() => toggleArchetype(archetype.id)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      active ? 'border-bjj-gold bg-bjj-gold text-bjj-coal' : 'border-bjj-border bg-bjj-surface text-bjj-muted hover:border-bjj-gold/30'
                    }`}
                  >
                    {archetype.name}
                  </button>
                )
              })}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{success}</p>
                  {savedClip ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/clips/${savedClip.id}`} className="font-bold text-bjj-gold hover:text-white">
                        Clip ansehen
                      </Link>
                      <Link href="/admin/outlierdb" className="font-bold text-bjj-gold hover:text-white">
                        Jetzt zuordnen
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving || !isValidUrl}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-bjj-gold px-6 py-4 text-base font-black text-bjj-coal transition hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
            {saving ? 'Speichert...' : 'Clip speichern'}
          </button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-bjj-border bg-bjj-card p-4 shadow-card">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Vorschau</p>
              <p className="mt-1 text-sm text-bjj-muted">YouTube Video</p>
            </div>

            {youtubeEmbedUrl ? (
              <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                <iframe
                  src={youtubeEmbedUrl}
                  title={title.trim() || 'Video Vorschau'}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-bjj-border bg-bjj-surface px-5 text-center">
                <div>
                  <Youtube className="mx-auto mb-3 h-12 w-12 text-bjj-muted/50" />
                  <p className="text-sm leading-7 text-bjj-muted">
                    Gib eine YouTube-URL ein, dann siehst du hier die Vorschau.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-bjj-border bg-bjj-card p-5 text-sm leading-7 text-bjj-muted shadow-card">
            YouTube-Videos werden automatisch geloopt und koennen direkt auf der Seite gesteuert werden.
          </div>
        </aside>
      </div>
    </div>
  )
}
