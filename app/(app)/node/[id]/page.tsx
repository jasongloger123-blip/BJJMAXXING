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
  Circle,
  CirclePlay,
  Clock3,
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
import { getNodeById, LONG_FLEXIBLE_GUARD_NODES } from '@/lib/nodes'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'

type ProgressState = Record<string, boolean>
type TechniqueTab = 'details' | 'errors' | 'counter' | 'videos' | 'drills'

const TAB_CONFIG: { id: TechniqueTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'details', label: 'Details', icon: Info },
  { id: 'errors', label: 'Fehler', icon: AlertTriangle },
  { id: 'counter', label: 'Counter', icon: Shield },
  { id: 'videos', label: 'Alle Videos', icon: CirclePlay },
  { id: 'drills', label: 'Drills', icon: Target },
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
  if (track === 'secondary') return 'Transition'
  return 'System'
}

function getVideoLabel(count: number) {
  return `${count} Video${count === 1 ? '' : 's'}`
}

function formatChecklistStatus(progress: ProgressState, ruleIds: string[]) {
  const checked = ruleIds.filter((ruleId) => progress[ruleId]).length
  return `${checked}/${ruleIds.length}`
}

function extractDomainLabel(url: string) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('instagram.com')) return 'Instagram'
  return 'Extern'
}

export default function NodeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const node = getNodeById(id)
  const [activeTab, setActiveTab] = useState<TechniqueTab>('details')
  const [progress, setProgress] = useState<ProgressState>({})
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const unlockedNodes = useMemo(() => {
    if (!node) return []
    return LONG_FLEXIBLE_GUARD_NODES.filter((candidate) => candidate.prerequisites.includes(node.id)).slice(0, 3)
  }, [node])

  const allChecked = useMemo(() => {
    if (!node || node.completionRules.length === 0) return true
    return node.completionRules.every((rule) => progress[rule.id])
  }, [node, progress])

  const watchedCount = useMemo(() => {
    if (!node) return 0
    const checkedCount = Object.values(progress).filter(Boolean).length
    return Math.min(node.videos.length, checkedCount)
  }, [node, progress])

  const difficulty = node ? getDifficulty(node.level) : 1
  const mainVideo = node?.videos[0] ?? null
  const mainThumbnail = getNodeThumbnail(node ?? { videos: [] })

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

  if (!node) {
    return (
      <div className="rounded-3xl border border-bjj-border bg-bjj-card p-8">
        <p className="text-bjj-muted">Dieser Node wurde nicht gefunden.</p>
        <Link href="/gameplan" className="mt-4 inline-block text-sm font-semibold text-bjj-gold">
          Zurueck zum Gameplan
        </Link>
      </div>
    )
  }

  const currentNode = node

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

  async function toggleRule(ruleId: string) {
    const nextProgress = {
      ...progress,
      [ruleId]: !progress[ruleId],
    }

    setProgress(nextProgress)

    const nextCompleted =
      currentNode.completionRules.length === 0 || currentNode.completionRules.every((rule) => nextProgress[rule.id])
    setCompleted(nextCompleted)
    await persistProgress(nextProgress, nextCompleted)
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
          Library
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-white/22" />
        <span className="text-white/82">{currentNode.title}</span>
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_380px] xl:grid-cols-[minmax(0,1.28fr)_420px]">
        <div className="space-y-9">
          <div className="overflow-hidden rounded-[2.2rem] border border-white/8 bg-[#090a0d] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
            <div className="relative aspect-[9/16] overflow-hidden bg-black sm:aspect-[4/5] lg:aspect-video">
              {mainThumbnail ? (
                <img
                  src={mainThumbnail}
                  alt={mainVideo?.title ?? currentNode.title}
                  className="h-full w-full object-cover brightness-[0.72] contrast-[1.05]"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,#15181e_0%,#08090d_100%)]" />
              )}

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.14),rgba(0,0,0,0.18)_35%,rgba(0,0,0,0.88)_100%)]" />

              {mainVideo?.url ? (
                <a
                  href={mainVideo.url}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#00f2ff]/30 bg-[#00f2ff]/15 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#00f2ff] md:text-[10px]">
                      {getTrackBadgeLabel(currentNode.track)}
                    </span>
                    <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-200 md:text-[10px]">
                      {getDifficultyLabel(currentNode.level)}
                    </span>
                  </div>
                  <h1 className="mt-3 font-display text-3xl font-black leading-[0.92] tracking-[-0.05em] text-white md:text-5xl">
                    {currentNode.title}
                  </h1>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 backdrop-blur-md text-white">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div className="hidden rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 md:block">
                    {extractDomainLabel(mainVideo?.url ?? '')}
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
                          width: `${currentNode.videos.length > 0 ? (watchedCount / currentNode.videos.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="hidden flex-col items-end gap-2 md:flex">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                      Ref {currentNode.id.toUpperCase()}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                      {getVideoLabel(currentNode.videos.length)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex rounded-md border border-white/10 bg-white/7 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/55">
                {getTrackBadgeLabel(currentNode.track)}
              </span>
              <h2 className="font-display mt-4 text-[2.4rem] font-black leading-[0.9] tracking-[-0.06em] text-white md:text-[3.3rem]">
                {currentNode.title}
              </h2>
              <div className="mt-5 flex flex-wrap items-center gap-5 text-[14px] text-white/38">
                <span className="inline-flex items-center gap-2">
                  <CirclePlay className="h-4 w-4" />
                  {getVideoLabel(currentNode.videos.length)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  {currentNode.level * 8}min Gesamt
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-3 self-start rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.max(currentNode.videos.length, 3) }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-2.5 w-2.5 rounded-full ${index < watchedCount ? 'bg-bjj-gold' : 'bg-white/18'}`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/78">
                Watched {watchedCount}/{currentNode.videos.length}
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

          {activeTab === 'details' ? (
            <div className="space-y-8">
              <p className="max-w-4xl text-[1.08rem] leading-[1.95] text-white/70">{currentNode.description}</p>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-[1.8rem] border border-white/5 bg-white/[0.025] p-7">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                    <Target className="h-4 w-4" />
                    Key Objectives
                  </p>
                  <div className="mt-5 space-y-3">
                    {(currentNode.successDefinition.length > 0 ? currentNode.successDefinition : [currentNode.subtitle]).map((item) => (
                      <div key={item} className="rounded-[1.2rem] border border-white/7 bg-[#101319] px-4 py-4 text-sm text-white/76">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.8rem] border border-white/5 bg-white/[0.025] p-7">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">
                    <Info className="h-4 w-4" />
                    Why It Matters
                  </p>
                  <div className="mt-5 rounded-[1.2rem] border border-white/7 bg-[#101319] p-5">
                    <p className="text-sm leading-8 text-white/72">{currentNode.why}</p>
                  </div>

                  <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-white/42">Sparring Focus</p>
                  <div className="mt-4 rounded-[1.2rem] border border-white/7 bg-[#101319] p-5">
                    <p className="text-sm leading-8 text-white/72">
                      {currentNode.sparringFocus || 'Hier kannst du spaeter den konkreten Sparring-Fokus der Technik hinterlegen.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'errors' ? (
            <div className="space-y-4">
              {(currentNode.commonErrors.length > 0 ? currentNode.commonErrors : ['Hier kommen spaeter die haeufigsten Fehler dieser Technik rein.']).map(
                (error, index) => (
                  <div key={`${error}-${index}`} className="rounded-[1.6rem] border border-white/5 bg-white/[0.025] p-6">
                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#ff9e82]">
                      <AlertTriangle className="h-4 w-4" />
                      Fehler {index + 1}
                    </p>
                    <p className="mt-4 text-lg font-semibold text-white">{error}</p>
                    <p className="mt-3 text-sm leading-8 text-white/62">
                      Fix: Hinterlege hier pro Technik den klaren Coaching-Cue oder die Korrektur, die du spaeter anzeigen willst.
                    </p>
                  </div>
                )
              )}
            </div>
          ) : null}

          {activeTab === 'counter' ? (
            <div className="grid gap-5 md:grid-cols-2">
              {[
                'Typischer gegnerischer Counter',
                'Deine direkte Antwort',
                'Fruehes Warnsignal',
                'Fallback auf sichere Folgeposition',
              ].map((title) => (
                <div key={title} className="rounded-[1.6rem] border border-white/5 bg-white/[0.025] p-6">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#9ab6ff]">
                    <Shield className="h-4 w-4" />
                    {title}
                  </p>
                  <p className="mt-4 text-sm leading-8 text-white/68">
                    Dieser Bereich ist absichtlich als Template stehen geblieben, damit du fuer jede Technik eigene Counter-Logik
                    hinterlegen kannst.
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'videos' ? (
            <div className="space-y-4">
              {currentNode.videos.length > 0 ? (
                currentNode.videos.map((video, index) => {
                  const thumbnail = getYoutubeThumbnail(video.url)

                  return (
                    <a
                      key={`${video.url}-${index}`}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group grid gap-5 rounded-[1.7rem] border border-white/5 bg-white/[0.025] p-5 transition hover:border-white/10 md:grid-cols-[220px_minmax(0,1fr)]"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-[1.2rem] bg-[#12151b]">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={video.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(180deg,#1b1e25,#0f1217)]" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur-md">
                            <Play className="ml-0.5 h-6 w-6 text-white" />
                          </span>
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-col justify-center">
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.22em] text-white/38">
                          <span>{extractDomainLabel(video.url)}</span>
                          <span>Clip {index + 1}</span>
                        </div>
                        <p className="mt-3 text-xl font-black text-white">{video.title}</p>
                        <p className="mt-2 text-sm text-white/55">{video.creator}</p>
                        {video.note ? <p className="mt-4 text-sm leading-8 text-white/66">{video.note}</p> : null}
                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-bjj-gold">
                          Video oeffnen
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </div>
                    </a>
                  )
                })
              ) : (
                <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-8 text-white/55">
                  Noch keine Videos hinterlegt.
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'drills' ? (
            <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[1.7rem] border border-white/5 bg-white/[0.025] p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">Main Drill</p>
                <p className="mt-4 text-sm leading-8 text-white/72">
                  {currentNode.drill || 'Hier kommt spaeter dein Drill-Block mit Reps, Startposition und Constraints rein.'}
                </p>

                <p className="mt-8 text-[11px] font-black uppercase tracking-[0.22em] text-white/42">Validation</p>
                <div className="mt-4 rounded-[1.2rem] border border-white/7 bg-[#101319] p-5">
                  <p className="text-sm font-semibold text-white">
                    {currentNode.validationQuestion || 'Hier kannst du eine Kontrollfrage fuer diese Technik hinterlegen.'}
                  </p>
                  {currentNode.validationOptions?.length ? (
                    <div className="mt-4 space-y-2">
                      {currentNode.validationOptions.map((option) => (
                        <div key={option} className="rounded-xl border border-white/8 px-4 py-3 text-sm text-white/66">
                          {option}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-white/5 bg-white/[0.025] p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">Completion Checklist</p>
                <div className="mt-5 space-y-3">
                  {currentNode.completionRules.length > 0 ? (
                    currentNode.completionRules.map((rule) => {
                      const checked = Boolean(progress[rule.id])

                      return (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => void toggleRule(rule.id)}
                          className={`flex w-full items-center gap-3 rounded-[1.15rem] border px-4 py-4 text-left transition ${
                            checked
                              ? 'border-bjj-gold/22 bg-bjj-gold/[0.08] text-white'
                              : 'border-white/7 bg-[#101319] text-white/72 hover:border-white/12'
                          }`}
                        >
                          {checked ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-bjj-gold" />
                          ) : (
                            <Circle className="h-5 w-5 shrink-0 text-white/24" />
                          )}
                          <span className="text-sm font-medium">{rule.label}</span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-[1.15rem] border border-dashed border-white/10 bg-[#101319] p-4 text-sm text-white/55">
                      Keine Completion Rules angelegt.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/6 bg-[linear-gradient(180deg,#151515,#111318)] p-6 shadow-[0_26px_70px_rgba(0,0,0,0.3)] md:p-7">
            <div className="space-y-6">
              <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
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
                            : 'border-white/5 bg-white/[0.02] text-white/55 hover:border-white/10 hover:text-white/78'
                        }`}
                      >
                        {index === 0 ? <Unlock className="h-4 w-4 text-[#ff8a42]" /> : <Lock className="h-4 w-4 text-white/22" />}
                        <span className="text-sm font-semibold">{nextNode.title}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
                      Keine direkten Unlocks hinterlegt.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/8 pt-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Related Techniques</p>
                <div className="mt-5 space-y-4">
                  {relatedNodes.length > 0 ? (
                    relatedNodes.map((relatedNode, index) => {
                      const thumbnail = getNodeThumbnail(relatedNode)
                      const categoryLabel = index === 0 ? 'Sweep' : index === 1 ? 'Submission' : 'System'

                      return (
                        <Link key={relatedNode.id} href={`/node/${relatedNode.id}`} className="group flex items-center gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-[0.9rem] border border-white/8 bg-white/[0.04]">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={relatedNode.title}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#11151b]">
                                <Swords className="h-4 w-4 text-white/32" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{relatedNode.title}</p>
                            <p className="mt-0.5 text-xs text-white/38">{`${categoryLabel} • ${getDifficultyLabel(relatedNode.level)}`}</p>
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
                      Keine verwandten Techniken gefunden.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/36">Technique Meta</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-[1.2rem] border border-white/7 bg-[#101319] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/36">Track</p>
                <p className="mt-2 text-base font-black text-white">{currentNode.track}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/7 bg-[#101319] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/36">Prerequisites</p>
                <p className="mt-2 text-base font-black text-white">{currentNode.prerequisites.length}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/7 bg-[#101319] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/36">Main Focus</p>
                <p className="mt-2 text-sm leading-7 text-white/76">{currentNode.subtitle}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/7 bg-[#101319] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/36">Checklist</p>
                <p className="mt-2 text-base font-black text-white">
                  {formatChecklistStatus(progress, currentNode.completionRules.map((rule) => rule.id))}
                </p>
              </div>
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

      <div className="mt-8">
        <Link href="/gameplan" className="inline-flex items-center gap-2 text-sm font-semibold text-white/42 transition hover:text-white/72">
          <ChevronLeft className="h-4 w-4" />
          Zurueck zum Gameplan
        </Link>
      </div>
    </div>
  )
}
