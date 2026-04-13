'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Play,
  Shield,
  Star,
  Target,
  Unlock,
} from 'lucide-react'
import { GameplanClipDeck } from '@/components/gameplan/GameplanClipDeck'
import { TechniqueStyleToggle } from '@/components/technique-library/TechniqueStyleToggle'
import { clipArchiveToCuratedClip, type ClipArchiveRecord } from '@/lib/clip-archive'
import {
  getTechniqueVideoOrientationLabel,
  getTechniqueVideoTypeLabel,
} from '@/lib/custom-techniques'
import type { CuratedClip } from '@/lib/curated-clips'
import type { ResolvedGameplan } from '@/lib/gameplans'
import { getTechniqueCatalogEntryById, getTechniqueFollowUpsFromPlan, resolveTechniqueCatalogContent } from '@/lib/technique-catalog'
import { getTechniqueCoverageLabel, readPreferredTechniqueStyle, writePreferredTechniqueStyle, type TechniqueStyle } from '@/lib/technique-style'
import { detectVideoFormat, extractYoutubeId, getVideoPlatform } from '@/lib/video-format'

type TechniqueTab = 'videos' | 'counter' | 'drills' | 'followups'

type NodeClipGroupsResponse = {
  error?: string
  groups?: {
    main_reference?: ClipArchiveRecord[]
    counter_reference?: ClipArchiveRecord[]
    drill_reference?: ClipArchiveRecord[]
    related_reference?: ClipArchiveRecord[]
  }
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

function getClipSource(url: string): CuratedClip['source'] {
  const platform = getVideoPlatform(detectVideoFormat(url))
  if (platform === 'instagram') return 'instagram'
  if (platform === 'youtube') return 'youtube'
  return 'external'
}

function getDifficulty(level: number) {
  return Math.min(5, Math.max(1, Math.ceil(level / 2)))
}

function getDifficultyLabel(level: number) {
  if (level <= 2) return 'Beginner'
  if (level <= 5) return 'Intermediate'
  return 'Advanced'
}

function getStageLabel(stage: string) {
  if (stage === 'position') return 'Position'
  if (stage === 'pass') return 'Pass'
  if (stage === 'submission') return 'Submission'
  return 'Technik'
}

const TAB_CONFIG: { id: TechniqueTab; label: string }[] = [
  { id: 'videos', label: 'Details' },
  { id: 'counter', label: 'Counter' },
  { id: 'drills', label: 'Drills' },
  { id: 'followups', label: 'Follow-Ups' },
]

export default function CustomTechniquePage({ params }: { params: { id: string } }) {
  const technique = getTechniqueCatalogEntryById(params.id)
  const [activeTab, setActiveTab] = useState<TechniqueTab>('videos')
  const [activePlan, setActivePlan] = useState<ResolvedGameplan | null>(null)
  const [preferredStyle, setPreferredStyle] = useState<TechniqueStyle>('gi')
  const [linkedClips, setLinkedClips] = useState<{
    main_reference: ClipArchiveRecord[]
    counter_reference: ClipArchiveRecord[]
    drill_reference: ClipArchiveRecord[]
    related_reference: ClipArchiveRecord[]
  }>({
    main_reference: [],
    counter_reference: [],
    drill_reference: [],
    related_reference: [],
  })

  useEffect(() => {
    setPreferredStyle(readPreferredTechniqueStyle())
  }, [])

  useEffect(() => {
    writePreferredTechniqueStyle(preferredStyle)
  }, [preferredStyle])

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
    let active = true

    async function loadLinkedClips() {
      try {
        const response = await fetch(`/api/node-clips?nodeId=${encodeURIComponent(params.id)}`, { cache: 'no-store' })
        const payload = (await response.json()) as NodeClipGroupsResponse
        if (!active || !response.ok) return

        setLinkedClips({
          main_reference: payload.groups?.main_reference ?? [],
          counter_reference: payload.groups?.counter_reference ?? [],
          drill_reference: payload.groups?.drill_reference ?? [],
          related_reference: payload.groups?.related_reference ?? [],
        })
      } catch {
        if (!active) return
        setLinkedClips({
          main_reference: [],
          counter_reference: [],
          drill_reference: [],
          related_reference: [],
        })
      }
    }

    void loadLinkedClips()

    return () => {
      active = false
    }
  }, [params.id])

  if (!technique) {
    return (
      <div className="space-y-6">
        <Link
          href="/technique-library"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-bjj-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurueck zur Bibliothek
        </Link>

        <div className="rounded-[1.65rem] border border-white/10 bg-[#101723] p-8">
          <p className="text-white">Diese Technik wurde nicht gefunden.</p>
        </div>
      </div>
    )
  }

  const resolvedContent = resolveTechniqueCatalogContent(technique, preferredStyle)
  const linkedDetailClips = useMemo<CuratedClip[]>(
    () =>
      linkedClips.main_reference.map((clip) =>
        clipArchiveToCuratedClip(clip, {
          nodeId: params.id,
          category: getStageLabel(technique.stage),
          levelLabel: getDifficultyLabel(technique.level),
        })
      ),
    [linkedClips.main_reference, params.id, technique.level, technique.stage]
  )

  const fallbackHeroClip = linkedClips.main_reference.find((clip) => Boolean(clip.video_url)) ?? null
  const heroVideo = resolvedContent.videos[0] ?? null
  const heroVideoUrl = heroVideo?.url ?? fallbackHeroClip?.video_url ?? fallbackHeroClip?.source_url ?? null
  const heroEmbedUrl = buildYoutubeEmbedUrl(heroVideoUrl)
  const heroThumbnail = getYoutubeThumbnail(heroVideoUrl) ?? technique.image ?? null
  const difficulty = getDifficulty(technique.level)
  const detailObjectives = (resolvedContent.keyPoints.length > 0
    ? resolvedContent.keyPoints
    : [{ id: `${params.id}-fallback-keypoint`, text: technique.subtitle, styleCoverage: 'both' as const }]).slice(0, 3)
  const followUps = useMemo(() => getTechniqueFollowUpsFromPlan(params.id, activePlan), [activePlan, params.id])

  const localDetailClips = useMemo<CuratedClip[]>(
    () =>
      resolvedContent.videos.map((video, index) => ({
        id: `${params.id}-detail-${video.id}`,
        nodeId: params.id,
        title: video.title,
        clipWindow: index === 0 ? '0:00-0:30' : '0:12-0:42',
        principle: resolvedContent.keyPoints[index]?.text ?? technique.subtitle ?? resolvedContent.description,
        category: getStageLabel(technique.stage),
        levelLabel: getDifficultyLabel(technique.level),
        description: resolvedContent.description,
        source: getClipSource(video.url),
        videoFormat: detectVideoFormat(video.url),
        sourceUrl: video.url,
        comments: [],
      })),
    [params.id, resolvedContent.description, resolvedContent.keyPoints, resolvedContent.videos, technique.level, technique.stage, technique.subtitle]
  )

  const detailClips = useMemo<CuratedClip[]>(
    () => [...localDetailClips, ...linkedDetailClips],
    [linkedDetailClips, localDetailClips]
  )

  const primaryVideos = [
    ...resolvedContent.videos.map((video, index) => ({
      id: `${video.id}-${index}`,
      title: video.title,
      url: video.url,
      creator: video.platform,
      thumbnail: getYoutubeThumbnail(video.url),
      videoType: video.videoType,
    })),
    ...linkedClips.main_reference
      .filter((clip) => Boolean(clip.video_url))
      .map((clip) => ({
        id: `linked-${clip.id}`,
        title: clip.title,
        url: clip.video_url ?? clip.source_url,
        creator: clip.video_platform ?? clip.provider,
        thumbnail: getYoutubeThumbnail(clip.video_url ?? clip.source_url),
        videoType: undefined,
      })),
  ]

  const queueVideos = primaryVideos

  return (
    <div className="mx-auto max-w-[1400px] pb-32">
      <div className="mb-6 flex items-center gap-3 px-1 text-[11px] font-bold uppercase tracking-[0.28em] text-white/30">
        <Link href="/technique-library" className="transition-colors hover:text-bjj-gold">
          Technik
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-white/22" />
        <span className="text-white/82">{technique.title}</span>
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_380px] xl:grid-cols-[minmax(0,1.28fr)_420px]">
        <div className="space-y-9">
          <div className="overflow-hidden rounded-[2.2rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(11,14,21,0.98),rgba(8,10,16,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
            <div className="relative aspect-[9/16] overflow-hidden bg-black sm:aspect-[4/5] lg:aspect-video">
              {heroEmbedUrl ? (
                <iframe
                  src={heroEmbedUrl}
                  title={heroVideo?.title ?? fallbackHeroClip?.title ?? technique.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : heroThumbnail ? (
                <img
                  src={heroThumbnail}
                  alt={technique.title}
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
                  <span className="flex h-24 w-24 items-center justify-center rounded-full border border-white/8 bg-white/10 backdrop-blur-sm transition hover:scale-[1.04]">
                    <Play className="ml-1 h-9 w-9 text-white" />
                  </span>
                </a>
              ) : null}

              <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-4 md:left-6 md:right-6 md:top-6">
                <div className="max-w-[70%]">
                  <h1 className="font-display text-3xl font-black leading-[0.92] tracking-[-0.05em] text-white md:text-5xl">
                    {technique.title}
                  </h1>
                </div>
                {heroVideoUrl ? (
                  <div className="flex flex-col gap-3">
                    <a
                      href={heroVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-md text-white transition hover:bg-white/[0.1]"
                      aria-label="Originalvideo oeffnen"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>
                    <div className="hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 md:block">
                      {heroVideo
                        ? `${getTechniqueVideoTypeLabel(heroVideo.videoType)} • ${getTechniqueVideoOrientationLabel(heroVideo.videoType)}`
                        : fallbackHeroClip?.video_platform ?? 'video'}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="max-w-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/55 md:text-xs">
                      Technik Analyse
                    </p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-white/82 md:text-base">
                      {technique.subtitle}
                    </p>
                    <div className="mt-4 h-[4px] w-full max-w-[320px] overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[20%] bg-[linear-gradient(90deg,#ff006e,#00f2ff)] shadow-[0_0_18px_rgba(255,0,110,0.5)]" />
                    </div>
                  </div>
                  <div className="hidden flex-col items-end gap-2 md:flex">
                    <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                      Ref {technique.id.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-[2.4rem] font-black leading-[0.9] tracking-[-0.06em] text-white md:text-[3.3rem]">
                {technique.title}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {getStageLabel(technique.stage)} • {getDifficultyLabel(technique.level)}
              </p>
            </div>

            <div className="inline-flex items-center gap-3 self-start rounded-[1.3rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(18,23,33,0.9),rgba(12,16,24,0.88))] px-4 py-3 shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.max(technique.videos.length, 1) }).slice(0, 5).map((_, index) => (
                  <span
                    key={index}
                    className={`h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-bjj-gold' : 'bg-white/18'}`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/78">
                Watched 1/{Math.max(technique.videos.length, 1)}
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
            <div className="space-y-5">
              {detailClips.length > 0 ? (
                <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7dd3fc]">Weitere Hauptvideos</p>
                  <div className="mt-5">
                    <GameplanClipDeck clips={detailClips} />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                    <Info className="h-4 w-4" />
                    Kurzbeschreibung
                  </p>
                  <div className="mt-5 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-5">
                    <p className="text-sm leading-8 text-white/72">{resolvedContent.description}</p>
                  </div>
                </div>

                <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                    <Target className="h-4 w-4" />
                    Key Objectives
                  </p>
                  <div className="mt-5 space-y-3">
                    {detailObjectives.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/76">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/38">Punkt {index + 1}</p>
                        <p className="mt-2">{item.text}</p>
                        {(item.styleCoverage ?? 'both') !== 'both' ? (
                          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-bjj-gold">
                            {getTechniqueCoverageLabel(item.styleCoverage ?? 'both')}
                          </p>
                        ) : null}
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
                  {(resolvedContent.commonErrors.length > 0
                    ? resolvedContent.commonErrors
                    : ['Hier kommen spaeter die haeufigsten Fehler dieser Technik rein.']).map((error, index) => (
                    <div key={`${typeof error === 'string' ? error : error.id}-${index}`} className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/76">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/38">Fehler {index + 1}</p>
                      <p className="mt-2">{typeof error === 'string' ? error : error.text}</p>
                      {typeof error !== 'string' && (error.styleCoverage ?? 'both') !== 'both' ? (
                        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-bjj-gold">
                          {getTechniqueCoverageLabel(error.styleCoverage ?? 'both')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7dd3fc]">Details</p>
                <p className="mt-2 text-sm text-white/62">Alle Detail-Videos dieser Technik auf einen Blick.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {primaryVideos.length > 0 ? (
                    primaryVideos.map((video) => (
                      <a
                        key={video.id}
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-[1.3rem] border border-white/[0.05] bg-[#101319] p-3 transition hover:border-white/[0.08]"
                      >
                        <div className="relative aspect-video overflow-hidden rounded-[1.05rem] bg-[#141922]">
                          {video.thumbnail ? (
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Play className="h-5 w-5 text-white/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                        </div>
                        <div className="mt-3 min-w-0">
                          <p className="truncate text-sm font-bold text-white">{video.title}</p>
                          <p className="mt-1 text-xs text-white/40">
                            {video.videoType ? `${getTechniqueVideoTypeLabel(video.videoType)} • ${getTechniqueVideoOrientationLabel(video.videoType)}` : video.creator}
                          </p>
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="rounded-[1.7rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.92),rgba(12,16,24,0.9))] p-8 text-sm leading-8 text-white/55">
                      Noch keine Detail-Videos mit dieser Technik verknuepft.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'counter' ? (
            <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                <Shield className="h-4 w-4" />
                Counter-Techniken
              </p>

              {resolvedContent.counters.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {resolvedContent.counters.map((counter) => (
                    <div key={counter.id} className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-5">
                      <p className="font-semibold text-white">{counter.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">{counter.description}</p>
                      {(counter.styleCoverage ?? 'both') !== 'both' ? (
                        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-bjj-gold">
                          {getTechniqueCoverageLabel(counter.styleCoverage ?? 'both')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-8 text-center text-sm text-white/55">
                  Noch keine Counter-Techniken hinterlegt.
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'drills' ? (
            <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                <Target className="h-4 w-4" />
                Training Drills
              </p>

              {resolvedContent.drills.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {resolvedContent.drills.map((drill) => (
                    <div key={drill.id} className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-5">
                      <p className="font-semibold text-white">{drill.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">{drill.description}</p>
                      {drill.duration ? <p className="mt-2 text-xs text-bjj-gold">Dauer: {drill.duration}</p> : null}
                      {(drill.styleCoverage ?? 'both') !== 'both' ? (
                        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-bjj-gold">
                          {getTechniqueCoverageLabel(drill.styleCoverage ?? 'both')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-8 text-center text-sm text-white/55">
                  Noch keine Drills hinterlegt.
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'followups' ? (
            <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-7 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9ab6ff]">Follow-Ups</p>
                  <p className="mt-2 text-sm text-white/62">
                    Das sind die Techniken, die in deinem aktuellen Gameplan direkt als Naechstes folgen koennen.
                  </p>
                </div>
              </div>

              {followUps.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {followUps.map((followUp) => (
                    <Link
                      key={followUp.sourcePlanNodeId}
                      href={`/technique/${followUp.id}`}
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
                          {getStageLabel(followUp.stage)}
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
          <div className="rounded-[2rem] border border-white/[0.05] bg-[linear-gradient(180deg,#151515,#111318)] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.3)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Stil</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <TechniqueStyleToggle value={preferredStyle} onChange={setPreferredStyle} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/[0.05] bg-[linear-gradient(180deg,#151515,#111318)] p-6 shadow-[0_26px_70px_rgba(0,0,0,0.3)] md:p-7">
            <div className="space-y-6">
              <div className="rounded-[1.6rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(21,25,35,0.96),rgba(14,18,26,0.94))] p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Coach</p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff006e,#00f2ff)] text-sm font-black text-white">
                      {technique.fighter.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-black text-white">{technique.fighter}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/42">Technique Source</p>
                    </div>
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
                  <span className="ml-2 text-sm font-semibold text-white">{getDifficultyLabel(technique.level)}</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Unlocks in A-Plan</p>
                <div className="mt-4 space-y-3">
                  {followUps.length > 0 ? (
                    followUps.slice(0, 3).map((nextTechnique, index) => (
                      <Link
                        key={nextTechnique.sourcePlanNodeId}
                        href={`/technique/${nextTechnique.id}`}
                        className={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-4 transition ${
                          index === 0
                            ? 'border-[#7b4928] bg-[#342218] text-white hover:brightness-105'
                            : 'border-white/[0.05] bg-[linear-gradient(180deg,rgba(21,25,35,0.96),rgba(14,18,26,0.94))] text-white/55 hover:border-white/[0.08] hover:text-white/78'
                        }`}
                      >
                        <Unlock className={`h-4 w-4 ${index === 0 ? 'text-[#ff8a42]' : 'text-white/22'}`} />
                        <span className="text-sm font-semibold">{nextTechnique.title}</span>
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
              {queueVideos.length > 0 ? (
                queueVideos.map((video) => (
                  <a
                    key={video.id}
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] p-3 transition hover:border-white/[0.08]"
                  >
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[0.9rem] bg-[#161b24]">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
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
                  </a>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/55">
                  Noch keine Videos hinterlegt.
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>

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
