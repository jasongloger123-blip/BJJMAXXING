'use client'

import type { ComponentType } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Lock,
  Play,
  Shield,
  Star,
  Swords,
  Target,
  Unlock,
} from 'lucide-react'
import { GameplanClipDeck } from '@/components/gameplan/GameplanClipDeck'
import { clipArchiveToCuratedClip, type ClipArchiveRecord } from '@/lib/clip-archive'
import type { ResolvedGameplan } from '@/lib/gameplans'
import { getNodeById, LONG_FLEXIBLE_GUARD_NODES } from '@/lib/nodes'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'
import { getExternalSourceRoleLabel, type ExternalSourceRole, type NodeExternalSourceWithSource } from '@/lib/external-technique-sources'
import { getTechniqueFollowUpsFromPlan } from '@/lib/technique-catalog'

type ProgressState = Record<string, boolean>
type TechniqueTab = 'videos' | 'counter' | 'drills' | 'followups'
type ExternalSourceGroups = Record<ExternalSourceRole, NodeExternalSourceWithSource[]>
type ArchivedClipGroups = Record<ExternalSourceRole, ClipArchiveRecord[]>

const TAB_CONFIG: { id: TechniqueTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'videos', label: 'Details', icon: Play },
  { id: 'counter', label: 'Counter', icon: Shield },
  { id: 'drills', label: 'Drills', icon: Target },
  { id: 'followups', label: 'Follow-Ups', icon: ChevronRight },
]

function extractYoutubeId(url?: string | null) {
  if (!url) return null

  const short = url.match(/youtu\.be\/([^?&]+)/)
  if (short?.[1]) return short[1]

  const long = url.match(/[?&]v=([^&]+)/)
  if (long?.[1]) return long[1]

  return null
}

function getYoutubeThumbnail(url?: string | null) {
  const youtubeId = extractYoutubeId(url)
  if (!youtubeId) return null
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
}

function buildYoutubeEmbedUrl(url?: string | null) {
  const youtubeId = extractYoutubeId(url)
  if (!youtubeId) return null

  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
  })

  return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`
}

function getNodeThumbnail(node: { videos: { url: string }[] }) {
  for (const video of node.videos) {
    const thumbnail = getYoutubeThumbnail(video.url)
    if (thumbnail) return thumbnail
  }

  return null
}

function getDifficulty(level: number) {
  return Math.min(5, Math.max(1, Math.ceil(level / 2)))
}

function getDifficultyLabel(level: number) {
  if (level <= 2) return 'Beginner'
  if (level <= 5) return 'Intermediate'
  return 'Advanced'
}

function getTrackBadgeLabel(track: 'foundation' | 'secondary' | 'top-game') {
  if (track === 'foundation') return 'Position'
  if (track === 'secondary') return 'Pass'
  return 'Submission'
}

function extractDomainLabel(url: string) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('instagram.com')) return 'Instagram'
  return 'Extern'
}

function createEmptyExternalSourceGroups(): ExternalSourceGroups {
  return {
    main_reference: [],
    counter_reference: [],
    drill_reference: [],
    related_reference: [],
  }
}

function createEmptyClipGroups(): ArchivedClipGroups {
  return {
    main_reference: [],
    counter_reference: [],
    drill_reference: [],
    related_reference: [],
  }
}

function dedupeClips(clips: ClipArchiveRecord[]) {
  const seen = new Set<string>()
  return clips.filter((clip) => {
    if (seen.has(clip.id)) return false
    seen.add(clip.id)
    return true
  })
}

export default function NodeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const node = getNodeById(id)
  const [activeTab, setActiveTab] = useState<TechniqueTab>('videos')
  const [progress, setProgress] = useState<ProgressState>({})
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [externalSources, setExternalSources] = useState<ExternalSourceGroups>(createEmptyExternalSourceGroups)
  const [archivedClips, setArchivedClips] = useState<ArchivedClipGroups>(createEmptyClipGroups)
  const [activePlan, setActivePlan] = useState<ResolvedGameplan | null>(null)

  const initialProgress = useMemo(
    () =>
      Object.fromEntries((node?.completionRules ?? []).map((rule) => [rule.id, false])) as ProgressState,
    [node]
  )

  const relatedNodes = useMemo(() => {
    if (!node) return []

    return LONG_FLEXIBLE_GUARD_NODES.filter(
      (candidate) =>
        candidate.id !== node.id &&
        !candidate.isComingSoon &&
        (candidate.prerequisites.includes(node.id) ||
          node.prerequisites.includes(candidate.id) ||
          candidate.track === node.track)
    )
      .sort((a, b) => Number(Boolean(getNodeThumbnail(b))) - Number(Boolean(getNodeThumbnail(a))))
      .slice(0, 3)
  }, [node])

  const followUps = useMemo(() => {
    if (!activePlan || !node) return []
    return getTechniqueFollowUpsFromPlan(node.id, activePlan)
  }, [activePlan, node])

  const unlockedNodes = useMemo(() => {
    if (!node) return []
    return LONG_FLEXIBLE_GUARD_NODES.filter((candidate) => candidate.prerequisites.includes(node.id)).slice(0, 3)
  }, [node])

  const allChecked = useMemo(() => {
    if (!node || node.completionRules.length === 0) return true
    return node.completionRules.every((rule) => progress[rule.id])
  }, [node, progress])

  const completedRuleCount = useMemo(() => {
    if (!node) return 0
    return Object.values(progress).filter(Boolean).length
  }, [node, progress])

  const difficulty = node ? getDifficulty(node.level) : 1

  const loadProgress = useCallback(async () => {
    if (!node) return

    setProgress(initialProgress)

    const user = await waitForAuthenticatedUser(supabase)

    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('node_id', node.id)
      .maybeSingle()

    if (!data) return

    const next = { ...initialProgress }

    for (const key of Object.keys(initialProgress)) {
      next[key] = Boolean(data[key])
    }

    setProgress(next)
    setCompleted(Boolean(data.completed))
  }, [initialProgress, node, router, supabase])

  useEffect(() => {
    void loadProgress()
  }, [loadProgress])

  useEffect(() => {
    let active = true

    async function loadActivePlan() {
      try {
        const response = await fetch('/api/gameplan/active', { cache: 'no-store' })
        const payload = (await response.json()) as { plan?: ResolvedGameplan }
        if (!active || !response.ok || !payload.plan) return
        setActivePlan(payload.plan)
      } catch {
        if (!active) return
        setActivePlan(null)
      }
    }

    void loadActivePlan()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!node) return

    let active = true
    const nodeId = node.id

    async function loadExternalSources() {
      try {
        const response = await fetch(`/api/node-external-sources?nodeId=${encodeURIComponent(nodeId)}`, { cache: 'no-store' })
        const payload = (await response.json()) as { groups?: ExternalSourceGroups }

        if (!active || !response.ok || !payload.groups) return
        setExternalSources(payload.groups)
      } catch {
        if (!active) return
        setExternalSources(createEmptyExternalSourceGroups())
      }
    }

    void loadExternalSources()

    return () => {
      active = false
    }
  }, [node])

  useEffect(() => {
    if (!node) return

    let active = true
    const nodeId = node.id
    async function loadArchivedClips() {
      try {
        const response = await fetch(`/api/node-clips?nodeId=${encodeURIComponent(nodeId)}`, { cache: 'no-store' })
        const payload = (await response.json()) as { groups?: ArchivedClipGroups }
        if (!active || !response.ok || !payload.groups) return
        setArchivedClips(payload.groups)
      } catch {
        if (!active) return
        setArchivedClips(createEmptyClipGroups())
      }
    }

    void loadArchivedClips()
    return () => {
      active = false
    }
  }, [node])

  if (!node) {
    return (
      <div className="rounded-3xl border border-bjj-border bg-bjj-card p-8">
        <p className="text-bjj-muted">Diese Technik wurde nicht gefunden.</p>
        <Link href="/gameplan" className="mt-4 inline-block text-sm font-semibold text-bjj-gold">
          Zurueck zum Gameplan
        </Link>
      </div>
    )
  }

  const unlockedSourceIds = new Set(activePlan?.unlockSummary.unlockedSourceNodeIds ?? [])
  const lockedSourceIds = new Set(activePlan?.unlockSummary.lockedSourceNodeIds ?? [])
  const isExplicitlyUnlocked = unlockedSourceIds.has(node.id)
  const isExplicitlyLocked = lockedSourceIds.has(node.id)
  const isOutsideCurrentPlan = Boolean(activePlan) && !isExplicitlyUnlocked && !isExplicitlyLocked

  if (isExplicitlyLocked || isOutsideCurrentPlan) {
    const currentPlanNode = activePlan?.unlockSummary.currentNodeId ? activePlan.nodes[activePlan.unlockSummary.currentNodeId] : null

    return (
      <div className="rounded-[1.8rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-8 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-bjj-gold">Locked Technik</p>
        <h1 className="mt-3 text-3xl font-black text-white">{node.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-white/72">
          {isOutsideCurrentPlan
            ? 'Diese Technik gehoert aktuell nicht zu deinem freigeschalteten Pfad. Sie wird erst sichtbar, wenn dein Gameplan an dieser Stelle angekommen ist.'
            : currentPlanNode
              ? `Diese Technik bleibt noch gesperrt. Arbeite zuerst an ${currentPlanNode.title}, dann geht der naechste Abschnitt in deinem Gameplan auf.`
              : 'Diese Technik bleibt noch gesperrt, bis dein naechster Gameplan-Schritt freigeschaltet wurde.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/gameplan" className="inline-flex items-center gap-2 rounded-2xl bg-bjj-gold px-5 py-3 text-sm font-black text-bjj-coal">
            Zurueck zum Gameplan
          </Link>
          <Link href="/technique-library" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/72">
            Zur Bibliothek
          </Link>
        </div>
      </div>
    )
  }

  const currentNode = node
  const detailObjectives =
    (currentNode.successDefinition.length > 0 ? currentNode.successDefinition : [currentNode.subtitle]).slice(0, 3)
  const counterItems = [
    'Typischer gegnerischer Counter',
    'Deine direkte Antwort',
    'Fruehes Warnsignal',
  ]
  const assignedSidebarClips = dedupeClips([
    ...archivedClips.main_reference,
    ...archivedClips.counter_reference,
    ...archivedClips.drill_reference,
  ])
  const sidebarVideos =
    assignedSidebarClips.length > 0
      ? assignedSidebarClips.map((clip) => ({
          id: clip.id,
          title: clip.title,
          url: clip.video_url ?? clip.source_url,
          creator: clip.video_platform ?? 'OutlierDB',
          detailHref: `/clips/${clip.id}`,
        }))
      : currentNode.videos
  const watchedCount = Math.min(sidebarVideos.length, completedRuleCount)
  const detailSourceCards = externalSources.main_reference
  const counterSourceCards = externalSources.counter_reference
  const drillSourceCards = externalSources.drill_reference
  const detailClipDeck = archivedClips.main_reference.map((clip) =>
    clipArchiveToCuratedClip(clip, { nodeId: currentNode.id, category: currentNode.title, levelLabel: 'Archiv' })
  )
  const counterClipDeck = archivedClips.counter_reference.map((clip) =>
    clipArchiveToCuratedClip(clip, { nodeId: currentNode.id, category: 'Counter', levelLabel: 'Archiv' })
  )
  const drillClipDeck = archivedClips.drill_reference.map((clip) =>
    clipArchiveToCuratedClip(clip, { nodeId: currentNode.id, category: 'Drill', levelLabel: 'Archiv' })
  )
  const heroVideoUrl = archivedClips.main_reference[0]?.video_url ?? archivedClips.main_reference[0]?.source_url ?? currentNode.videos[0]?.url ?? null
  const heroVideoTitle = archivedClips.main_reference[0]?.title ?? currentNode.videos[0]?.title ?? currentNode.title
  const heroVideoCreator = archivedClips.main_reference[0]?.video_platform ?? currentNode.videos[0]?.creator ?? extractDomainLabel(heroVideoUrl ?? '')
  const heroEmbedUrl = buildYoutubeEmbedUrl(heroVideoUrl)
  const mainThumbnail = getYoutubeThumbnail(heroVideoUrl) ?? getNodeThumbnail(currentNode)
  const primaryVideos =
    detailClipDeck.length > 0
      ? detailClipDeck.map((clip) => ({
          id: clip.id,
          title: clip.title,
          url: clip.sourceUrl,
          creator: clip.levelLabel,
          detailHref: clip.detailHref ?? `/node/${currentNode.id}`,
        }))
      : currentNode.videos.map((video, index) => ({
          id: `${currentNode.id}-video-${index}`,
          title: video.title,
          url: video.url,
          creator: video.creator,
        }))

  function renderExternalSourceCards(sources: NodeExternalSourceWithSource[], emptyLabel: string) {
    if (sources.length === 0) {
      return (
        <div className="rounded-[1.7rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.92),rgba(12,16,24,0.9))] p-8 text-sm leading-8 text-white/55">
          {emptyLabel}
        </div>
      )
    }

    return sources.map((entry) => {
      const source = entry.source
      const sourceLabel = source.video_url ? extractDomainLabel(source.video_url) : source.provider
      const thumbnail = getYoutubeThumbnail(source.video_url ?? undefined)

      return (
        <a
          key={entry.mappingId}
          href={source.source_url}
          target="_blank"
          rel="noreferrer"
          className="group grid gap-5 rounded-[1.7rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.96),rgba(12,16,24,0.93))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.22)] transition hover:border-white/[0.08] hover:brightness-105 md:grid-cols-[220px_minmax(0,1fr)]"
        >
          <div className="relative aspect-video overflow-hidden rounded-[1.2rem] bg-[#12151b]">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={source.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(180deg,#1b1e25,#0f1217)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
              {getExternalSourceRoleLabel(entry.role)}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.22em] text-white/38">
              <span>{sourceLabel}</span>
              {source.timestamp_label ? <span>{source.timestamp_label}</span> : null}
              {source.search_query ? <span>{source.search_query}</span> : null}
            </div>
            <p className="mt-3 text-xl font-black text-white">{source.title}</p>
            {source.summary ? <p className="mt-3 text-sm leading-8 text-white/66">{source.summary}</p> : null}
            {entry.notes ? <p className="mt-3 text-sm leading-8 text-[#f0ab3c]">{entry.notes}</p> : null}
            {source.hashtags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {source.hashtags.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/54"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-bjj-gold">
              Quelle oeffnen
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </a>
      )
    })
  }

  async function persistProgress(nextProgress: ProgressState, markComplete: boolean) {
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      return
    }

    await supabase.from('progress').upsert({
      user_id: user.id,
      node_id: currentNode.id,
      ...nextProgress,
      completed: markComplete,
      completed_at: markComplete ? new Date().toISOString() : null,
    })

    setSaving(false)
  }

  async function markComplete() {
    if (!allChecked) return
    await persistProgress(progress, true)
    setCompleted(true)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-[1400px] pb-32">
      <div className="mb-6 flex items-center gap-3 px-1 text-[11px] font-bold uppercase tracking-[0.28em] text-white/30">
        <Link href="/technique-library" className="transition-colors hover:text-bjj-gold">
          Technik
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-white/22" />
        <span className="text-white/82">{currentNode.title}</span>
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_380px] xl:grid-cols-[minmax(0,1.28fr)_420px]">
        <div className="space-y-9">
          <div className="overflow-hidden rounded-[2.2rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(11,14,21,0.98),rgba(8,10,16,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
            <div className="relative aspect-[9/16] overflow-hidden bg-black sm:aspect-[4/5] lg:aspect-video">
              {heroEmbedUrl ? (
                <iframe
                  src={heroEmbedUrl}
                  title={heroVideoTitle}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : mainThumbnail ? (
                <img
                  src={mainThumbnail}
                  alt={heroVideoTitle}
                  className="h-full w-full object-cover brightness-[0.72] contrast-[1.05]"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,#15181e_0%,#08090d_100%)]" />
              )}

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.14),rgba(0,0,0,0.18)_35%,rgba(0,0,0,0.88)_100%)]" />

              {heroVideoUrl && !heroEmbedUrl ? (
                <a
                  href={heroVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 flex items-center justify-center"
                  aria-label="Video oeffnen"
                >
                  <span className="flex h-24 w-24 items-center justify-center rounded-full border border-white/8 bg-white/10 backdrop-blur-md transition duration-300 hover:scale-105 hover:bg-white/14 md:h-28 md:w-28">
                    <Play className="ml-1 h-10 w-10 text-white md:h-12 md:w-12" />
                  </span>
                </a>
              ) : null}

              <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-4 md:left-6 md:right-6 md:top-6">
                <div className="max-w-[70%]">
                  <h1 className="font-display text-3xl font-black leading-[0.92] tracking-[-0.05em] text-white md:text-5xl">
                    {currentNode.title}
                  </h1>
                </div>

                <div className="flex flex-col gap-3">
                  {heroVideoUrl ? (
                    <a
                      href={heroVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-md text-white transition hover:bg-white/[0.1]"
                      aria-label="Originalvideo oeffnen"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-md text-white">
                      <ExternalLink className="h-5 w-5" />
                    </div>
                  )}
                  <div className="hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 md:block">
                    {heroVideoCreator}
                  </div>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="max-w-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/55 md:text-xs">Technik Analyse</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-white/82 md:text-base">
                      {currentNode.subtitle}
                    </p>
                    <div className="mt-4 h-[4px] w-full max-w-[320px] overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[linear-gradient(90deg,#ff006e,#00f2ff)] shadow-[0_0_18px_rgba(255,0,110,0.5)]"
                        style={{
                          width: `${sidebarVideos.length > 0 ? (watchedCount / sidebarVideos.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="hidden flex-col items-end gap-2 md:flex">
                    <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                      Ref {currentNode.id.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-[2.4rem] font-black leading-[0.9] tracking-[-0.06em] text-white md:text-[3.3rem]">
                {currentNode.title}
              </h2>
              <p className="mt-2 text-sm text-white/60">{getTrackBadgeLabel(currentNode.track)} • {getDifficultyLabel(currentNode.level)}</p>
            </div>

            <div className="inline-flex items-center gap-3 self-start rounded-[1.3rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(18,23,33,0.9),rgba(12,16,24,0.88))] px-4 py-3 shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.max(sidebarVideos.length, 3) }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-2.5 w-2.5 rounded-full ${index < watchedCount ? 'bg-bjj-gold' : 'bg-white/18'}`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/78">
                Watched {watchedCount}/{sidebarVideos.length}
              </span>
            </div>
          </div>

          <div className="border-b border-white/8">
            <nav className="flex gap-8 overflow-x-auto">
              {TAB_CONFIG.map((tab) => {
                const active = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`border-b-2 pb-4 text-[15px] font-black uppercase tracking-[0.18em] transition ${
                      active ? 'border-bjj-gold text-bjj-gold' : 'border-transparent text-white/38 hover:text-white/72'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {activeTab === 'videos' ? (
            <div className="space-y-8">
              <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7dd3fc]">Details</p>
                    <p className="mt-2 text-sm text-white/62">
                      Alle Detail-Videos dieser Technik liegen hier gebuendelt und die moeglichen Follow-Ups findest du direkt darunter.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/48">
                    {heroVideoCreator || 'Video'}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {primaryVideos.map((video, index) => {
                    const thumbnail = getYoutubeThumbnail(video.url)
                    const content = (
                      <>
                        <div className="relative aspect-video overflow-hidden rounded-[1.05rem] bg-[#141922]">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={video.title}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Play className="h-5 w-5 text-white/32" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                        </div>
                        <div className="mt-3 min-w-0">
                          <p className="truncate text-sm font-bold text-white">{video.title}</p>
                          <p className="mt-1 text-xs text-white/40">{video.creator}</p>
                        </div>
                      </>
                    )

                    if ('detailHref' in video && typeof video.detailHref === 'string') {
                      return (
                        <Link
                          key={`${video.id}-${index}`}
                          href={video.detailHref}
                          className="group rounded-[1.3rem] border border-white/[0.05] bg-[#101319] p-3 transition hover:border-white/[0.08]"
                        >
                          {content}
                        </Link>
                      )
                    }

                    return (
                      <a
                        key={`${video.id}-${index}`}
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-[1.3rem] border border-white/[0.05] bg-[#101319] p-3 transition hover:border-white/[0.08]"
                      >
                        {content}
                      </a>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                    <Info className="h-4 w-4" />
                    Kurzbeschreibung
                  </p>
                  <div className="mt-5 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-5">
                    <p className="text-sm leading-8 text-white/72">{currentNode.description}</p>
                  </div>
                </div>

                <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                    <Target className="h-4 w-4" />
                    Key Objectives
                  </p>
                  <div className="mt-5 space-y-3">
                    {detailObjectives.map((item, index) => (
                      <div key={item} className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/76">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/38">Punkt {index + 1}</p>
                        <p className="mt-2">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#ff9e82]">
                  <AlertTriangle className="h-4 w-4" />
                  Fehler
                </p>
                <div className="mt-5 space-y-3">
                  {(currentNode.commonErrors.length > 0
                    ? currentNode.commonErrors
                    : ['Hier kommen spaeter die haeufigsten Fehler dieser Technik rein.']).map((error, index) => (
                    <div key={`${error}-${index}`} className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/76">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/38">Fehler {index + 1}</p>
                      <p className="mt-2">{error}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7dd3fc]">Weitere Hauptvideos</p>
                {detailClipDeck.length > 0 ? (
                  <div className="mt-5">
                    <GameplanClipDeck clips={detailClipDeck} detailHref={`/node/${currentNode.id}`} detailCtaLabel="Technik oeffnen" />
                  </div>
                ) : null}
                <div className="mt-5 space-y-4">
                  {renderExternalSourceCards(detailSourceCards, 'Noch keine Detail-Videos mit dieser Technik verknuepft.')}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'counter' ? (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-3">
                {counterItems.map((title, index) => (
                  <div
                    key={title}
                    className="rounded-[1.6rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(20,25,36,0.95),rgba(12,16,24,0.94))] p-6 shadow-[0_16px_34px_rgba(0,0,0,0.18)]"
                  >
                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#9ab6ff]">
                      <Shield className="h-4 w-4" />
                      Counter {index + 1}
                    </p>
                    <p className="mt-4 text-lg font-semibold text-white">{title}</p>
                    <p className="mt-3 text-sm leading-8 text-white/62">
                      Hinterlege hier spaeter die konkrete Antwort auf diesen Counter und den klaren Coaching-Cue.
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                {counterClipDeck.length > 0 ? (
                  <div className="mb-6">
                    <GameplanClipDeck clips={counterClipDeck} detailHref={`/node/${currentNode.id}`} detailCtaLabel="Technik oeffnen" />
                  </div>
                ) : null}
                <div className="mt-5 space-y-4">
                  {renderExternalSourceCards(counterSourceCards, 'Noch keine Counter-Referenzen verknuepft.')}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'drills' ? (
            <div className="space-y-5">
              <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                {drillClipDeck.length > 0 ? (
                  <div className="mb-6">
                    <GameplanClipDeck clips={drillClipDeck} detailHref={`/node/${currentNode.id}`} detailCtaLabel="Technik oeffnen" />
                  </div>
                ) : null}
                <div className="mt-5 space-y-4">
                  {renderExternalSourceCards(drillSourceCards, 'Noch keine Drill-Referenzen verknuepft.')}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">Related Techniques</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {relatedNodes.length > 0 ? (
                    relatedNodes.map((relatedNode) => {
                      const thumbnail = getNodeThumbnail(relatedNode)

                      return (
                        <Link
                          key={relatedNode.id}
                          href={`/node/${relatedNode.id}`}
                          className="group overflow-hidden rounded-[1.3rem] border border-white/[0.05] bg-[#101319] transition hover:border-white/[0.08]"
                        >
                          <div className="aspect-video overflow-hidden bg-[#141922]">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={relatedNode.title}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Swords className="h-5 w-5 text-white/28" />
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <p className="truncate text-sm font-bold text-white">{relatedNode.title}</p>
                            <p className="mt-1 text-xs text-white/40">{getDifficultyLabel(relatedNode.level)}</p>
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    <div className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/55">
                      Keine weiterfuehrenden Techniken gefunden.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'followups' ? (
            <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9ab6ff]">Follow-Ups</p>
                  <p className="mt-2 text-sm text-white/62">
                    Das sind die Techniken, die in deinem aktuellen Gameplan direkt als Nächstes folgen koennen.
                  </p>
                </div>
              </div>

              {followUps.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {followUps.map((followUp) => (
                    <Link
                      key={followUp.sourcePlanNodeId}
                      href={`/node/${followUp.id}`}
                      className="group rounded-[1.3rem] border border-white/[0.05] bg-[#101319] p-3 transition hover:border-white/[0.08]"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-[1.05rem] bg-[#141922]">
                        {followUp.image ? (
                          <img
                            src={followUp.image}
                            alt={followUp.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ChevronRight className="h-6 w-6 text-white/26" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
                          {followUp.stage}
                        </div>
                      </div>
                      <div className="mt-3 min-w-0">
                        <p className="truncate text-sm font-bold text-white">{followUp.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-white/46">{followUp.subtitle}</p>
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-bjj-gold/80">
                          {followUp.videosCount} Detail-Videos
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-8 text-center text-sm text-white/55">
                  Fuer diese Technik sind aktuell noch keine Follow-Ups verknuepft.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/[0.05] bg-[linear-gradient(180deg,#151515,#111318)] p-6 shadow-[0_26px_70px_rgba(0,0,0,0.3)] md:p-7">
            <div className="space-y-6">
              <div className="rounded-[1.6rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(21,25,35,0.96),rgba(14,18,26,0.94))] p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Coach</p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff006e,#00f2ff)] text-sm font-black text-white">
                      CJ
                    </div>
                    <div>
                      <p className="text-base font-black text-white">Craig Jones</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/42">Competition Expert</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#ff006e] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    Follow
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Difficulty</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${index < difficulty ? 'fill-[#ff8a42] text-[#ff8a42]' : 'text-white/16'}`}
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-sm font-semibold text-white">{getDifficultyLabel(currentNode.level)}</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Unlocks in A-Plan</p>
                <div className="mt-4 space-y-3">
                  {unlockedNodes.length > 0 ? (
                    unlockedNodes.map((nextNode, index) => (
                      <Link
                        key={nextNode.id}
                        href={`/node/${nextNode.id}`}
                        className={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-4 transition ${
                          index === 0
                            ? 'border-[#7b4928] bg-[#342218] text-white hover:brightness-105'
                              : 'border-white/[0.05] bg-[linear-gradient(180deg,rgba(21,25,35,0.96),rgba(14,18,26,0.94))] text-white/55 hover:border-white/[0.08] hover:text-white/78'
                        }`}
                      >
                        {index === 0 ? <Unlock className="h-4 w-4 text-[#ff8a42]" /> : <Lock className="h-4 w-4 text-white/22" />}
                        <span className="text-sm font-semibold">{nextNode.title}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[1.2rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(21,25,35,0.96),rgba(14,18,26,0.94))] px-4 py-4 text-sm text-white/55">
                      Keine direkten Unlocks hinterlegt.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="rounded-[2rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(18,23,33,0.9),rgba(12,16,24,0.88))] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Video Queue</p>
            <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {sidebarVideos.length > 0 ? (
                sidebarVideos.map((video, index) => {
                  const thumbnail = getYoutubeThumbnail(video.url)
                  const content = (
                    <>
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[0.9rem] bg-[#161b24]">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={video.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Play className="h-4 w-4 text-white/32" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{video.title}</p>
                        <p className="mt-1 text-xs text-white/40">{video.creator}</p>
                      </div>
                    </>
                  )

                  if ('detailHref' in video && typeof video.detailHref === 'string') {
                    return (
                      <Link
                        key={`${video.url}-sidebar-${index}`}
                        href={video.detailHref}
                        className="group flex items-center gap-3 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-3 transition hover:border-white/[0.08]"
                      >
                        {content}
                      </Link>
                    )
                  }

                  return (
                    <a
                      key={`${video.url}-sidebar-${index}`}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-3 transition hover:border-white/[0.08]"
                    >
                      {content}
                    </a>
                  )
                })
              ) : (
                <div className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/55">
                  Noch keine Videos hinterlegt.
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>

      <div className="fixed inset-x-4 bottom-4 z-40 md:inset-x-auto md:bottom-8 md:right-8">
        <button
          type="button"
          onClick={() => void markComplete()}
          disabled={!allChecked || saving || completed}
          className={`inline-flex w-full items-center justify-center gap-4 rounded-full px-8 py-5 text-base font-black shadow-[0_24px_55px_rgba(255,107,53,0.18)] transition md:w-auto md:px-10 md:py-6 md:text-lg ${
            allChecked && !completed
              ? 'bg-[#f07f47] text-black hover:scale-[1.01] hover:bg-[#fb8951]'
              : 'cursor-not-allowed bg-white/[0.08] text-white/40'
          }`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-black/12 bg-white/20">
            {completed ? <Check className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <span>{completed ? 'ABGESCHLOSSEN' : saving ? 'SPEICHERT...' : 'ICH KANN DAS'}</span>
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/gameplan" className="inline-flex items-center gap-2 text-sm font-semibold text-white/42 transition hover:text-white/72">
          <ChevronLeft className="h-4 w-4" />
          Zurueck zum Gameplan
        </Link>
        <Link href="/technique-library" className="inline-flex items-center gap-2 text-sm font-semibold text-white/42 transition hover:text-white/72">
          <ChevronLeft className="h-4 w-4" />
          Zurueck zur Technik Bibliothek
        </Link>
      </div>
    </div>
  )
}
