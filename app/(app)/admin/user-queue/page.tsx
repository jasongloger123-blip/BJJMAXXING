'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BarChart3, ExternalLink, Info, Play, RefreshCw, Search, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getNodeById } from '@/lib/nodes'
import type { QueueCard } from '@/lib/start-queue'

type QueueItem = QueueCard & {
  position: number
}

type ResolvedQueueClip = {
  title: string
  url: string
  thumbnailUrl: string | null
  source: 'queue' | 'archive' | 'node'
}

function extractYoutubeId(url: string) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match?.[1] ?? null
}

function getYoutubeThumbnail(url: string) {
  const id = extractYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

const ALGORITHM_RULES = [
  { label: '+100', title: 'Schwaeche', description: 'Zuletzt Kann ich nicht.' },
  { label: '+90', title: 'Hilfsclip', description: 'Nach einem Fehlschlag kommt erst Drill oder Counter.' },
  { label: '+70', title: 'Review faellig', description: 'Das Review-Intervall ist erreicht.' },
  { label: '+40', title: 'Neu', description: 'Clip wurde noch nie gesehen.' },
  { label: '+25', title: 'Core', description: 'main_reference zaehlt als Pflichtvideo.' },
  { label: '+30', title: 'Naechster Core', description: 'Naechstes Core-Video in didaktischer Reihenfolge.' },
  { label: '-80', title: 'Anti-Nerv-Gap', description: 'Gerade gezeigter Clip wird nicht sofort wiederholt.' },
  { label: '-50', title: 'Mastered', description: 'Stabile Clips werden seltener gezeigt.' },
]

const LEARNING_STATUS_LABELS: Record<string, string> = {
  NEW: 'Neu',
  LEARNING: 'Lernen',
  UNSTABLE: 'Instabil',
  STABLE: 'Stabil',
  MASTERED: 'Mastered',
}

function getScoreTone(value: number) {
  if (value > 0) return 'text-[#8bffc7]'
  if (value < 0) return 'text-[#ff9f9f]'
  return 'text-white/50'
}

export default function AdminUserQueuePage() {
  const supabase = createClient()
  const [userQuery, setUserQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [userProfile, setUserProfile] = useState<{ id: string; username: string | null; full_name: string | null; email: string | null } | null>(null)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [resolvedClips, setResolvedClips] = useState<Record<string, ResolvedQueueClip>>({})

  const loadUserQueue = useCallback(
    async (targetUserId: string) => {
      setLoading(true)
      setError(null)

      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, username, full_name, email')
          .eq('id', targetUserId)
          .maybeSingle()

        if (profileError) {
          setError(`Profil konnte nicht geladen werden: ${profileError.message}`)
          setLoading(false)
          return
        }

        if (!profile) {
          setError('Kein User mit dieser ID gefunden')
          setLoading(false)
          return
        }

        setUserProfile(profile)

        const { data: progressData, error: progressError } = await supabase
          .from('progress')
          .select('node_id, completed')
          .eq('user_id', targetUserId)

        if (progressError) {
          console.error('Progress error:', progressError)
        }

        const completed = (progressData ?? []).filter((entry) => entry.completed).map((entry) => entry.node_id)
        setCompletedIds(completed)

        const {
          data: { session },
        } = await supabase.auth.getSession()

        const queueResponse = await fetch(`/api/start-queue?userId=${encodeURIComponent(targetUserId)}`, {
          cache: 'no-store',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        })
        const queuePayload = (await queueResponse.json()) as { queue?: QueueCard[]; error?: string }

        if (!queueResponse.ok) {
          setError(queuePayload.error ?? 'Queue konnte nicht geladen werden.')
          setQueue([])
          setLoading(false)
          return
        }

        const builtQueue = queuePayload.queue ?? []
        const queueWithPosition = builtQueue.slice(0, 10).map((card, index) => ({
          ...card,
          position: index + 1,
        }))

        setQueue(queueWithPosition)
      } catch (err) {
        setError(`Fehler beim Laden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  const handleSearch = useCallback(async () => {
    const trimmed = userQuery.trim()
    if (!trimmed) return

    const { data: users, error: searchError } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, email')
      .or(`username.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
      .limit(5)

    if (searchError) {
      setError(`Suche fehlgeschlagen: ${searchError.message}`)
      return
    }

    if (users && users.length > 0) {
      void loadUserQueue(users[0].id)
    } else {
      void loadUserQueue(trimmed)
    }
  }, [loadUserQueue, supabase, userQuery])

  useEffect(() => {
    if (queue.length === 0) {
      setResolvedClips({})
      return
    }

    let active = true

    async function resolveQueueClips() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
      const nextResolved: Record<string, ResolvedQueueClip> = {}

      await Promise.all(
        queue.map(async (item) => {
          if (item.clipUrl) {
            nextResolved[item.id] = {
              title: item.clipTitle,
              url: item.clipUrl,
              thumbnailUrl: getYoutubeThumbnail(item.clipUrl),
              source: 'queue',
            }
            return
          }

          try {
            const response = await fetch(`/api/node-clips?nodeId=${encodeURIComponent(item.nodeId)}`, {
              cache: 'no-store',
              headers,
            })

            if (response.ok) {
              const payload = (await response.json()) as {
                groups?: {
                  main_reference?: { title: string; video_url?: string | null; source_url?: string | null }[]
                  counter_reference?: { title: string; video_url?: string | null; source_url?: string | null }[]
                  drill_reference?: { title: string; video_url?: string | null; source_url?: string | null }[]
                  related_reference?: { title: string; video_url?: string | null; source_url?: string | null }[]
                }
              }

              const archiveClip =
                [
                  ...(payload.groups?.main_reference ?? []),
                  ...(payload.groups?.counter_reference ?? []),
                  ...(payload.groups?.drill_reference ?? []),
                  ...(payload.groups?.related_reference ?? []),
                ].find((clip) => Boolean(clip.video_url || clip.source_url)) ?? null

              if (archiveClip) {
                const url = archiveClip.video_url || archiveClip.source_url || ''
                if (url) {
                  nextResolved[item.id] = {
                    title: archiveClip.title,
                    url,
                    thumbnailUrl: getYoutubeThumbnail(url),
                    source: 'archive',
                  }
                  return
                }
              }
            }
          } catch {
            // fall through to node fallback
          }

          const fallbackVideo = getNodeById(item.nodeId)?.videos?.[0] ?? null
          if (fallbackVideo?.url) {
            nextResolved[item.id] = {
              title: fallbackVideo.title,
              url: fallbackVideo.url,
              thumbnailUrl: getYoutubeThumbnail(fallbackVideo.url),
              source: 'node',
            }
          }
        })
      )

      if (!active) return
      setResolvedClips(nextResolved)
    }

    void resolveQueueClips()
    return () => {
      active = false
    }
  }, [queue, supabase])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-black text-white">User Queue Preview</h1>
        <p className="mt-2 text-bjj-muted">Zeige die naechsten 10 Videos in der Startseiten-Queue eines Users</p>
      </div>

      <div className="mx-auto max-w-2xl rounded-[1.6rem] border border-white/10 bg-[#141923] p-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="User ID, Username oder Email..."
              className="w-full rounded-full border border-white/10 bg-white/[0.03] py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-bjj-gold/40"
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={loading || !userQuery.trim()}
            className="rounded-full bg-bjj-gold px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-bjj-coal transition hover:bg-bjj-gold/90 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Anzeigen'}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </div>

      {userProfile ? (
        <div className="mx-auto max-w-2xl rounded-[1.4rem] border border-white/10 bg-[#141923]/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bjj-gold/20">
              <User className="h-5 w-5 text-bjj-gold" />
            </div>
            <div>
              <p className="font-semibold text-white">{userProfile.username || userProfile.full_name || 'Unbekannt'}</p>
              <p className="text-xs text-white/50">{userProfile.email} · {completedIds.length} Nodes completed</p>
            </div>
          </div>
        </div>
      ) : null}

      {queue.length > 0 ? (
        <section className="mx-auto max-w-5xl rounded-[1.4rem] border border-white/10 bg-[#141923]/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-bjj-gold">
                <BarChart3 className="h-4 w-4" />
                Algorithmus Debug
              </p>
              <h2 className="mt-2 text-xl font-black text-white">Adaptiver Lernfeed V1</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/62">
                Der Feed sortiert Videos deterministisch nach Lernhebel: Schwaechen zuerst, dann faellige Reviews,
                dann neue Core-Clips. Sichere Clips werden nach hinten geschoben, aber nicht komplett entfernt.
              </p>
            </div>
            <div className="rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Aktuelle Top-Karte</p>
              <p className="mt-1 text-2xl font-black text-bjj-gold">{queue[0]?.priorityScore ?? 0}</p>
              <p className="text-xs text-white/50">Priority Score</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[1.1rem] border border-white/10 bg-black/20 p-4">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                <Info className="h-4 w-4" />
                Prinzip
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['Kann ich', 'Confidence +20, Review spaeter: +1, +3, +7, danach +14 Feed-Schritte.'],
                  ['Kann ich nicht', 'Confidence -25, Status instabil, Review nach 2 Feed-Schritten.'],
                  ['Completion', 'Node erst fertig, wenn alle Core-Clips 2x Kann ich, Confidence >= 60 und zuletzt nicht Kann ich nicht.'],
                  ['Anti-Nerv', 'Gleicher Clip wird nicht direkt wiederholt, solange ein anderer Clip verfuegbar ist.'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="mt-2 text-xs leading-6 text-white/55">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.1rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">Score-Regeln</p>
              <div className="mt-4 grid gap-2">
                {ALGORITHM_RULES.map((rule) => (
                  <div key={rule.title} className="grid grid-cols-[58px_minmax(0,1fr)] gap-3 rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-3">
                    <span className={`text-sm font-black ${getScoreTone(Number(rule.label))}`}>{rule.label}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{rule.title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/50">{rule.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {queue[0]?.scoreReasons?.length ? (
            <div className="mt-4 rounded-[1.1rem] border border-bjj-gold/20 bg-bjj-gold/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-bjj-gold">Warum liegt Platz 1 vorne?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {queue[0].scoreReasons.map((reason) => (
                  <span key={`${reason.label}-${reason.value}`} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/78">
                    <span className={getScoreTone(reason.value)}>{reason.value > 0 ? `+${reason.value}` : reason.value}</span>
                    {' '}
                    {reason.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {queue.length > 0 ? (
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-bjj-gold">Queue Reihenfolge (Top {queue.length})</p>

          <section className="rounded-[1.2rem] border border-white/10 bg-[#141923]/80 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Clips in Reihenfolge</p>
            <div className="mt-3 space-y-2">
              {queue.map((item, index) => {
                const resolvedClip = resolvedClips[item.id]
                const clipTitle = resolvedClip?.title ?? item.clipTitle ?? 'Kein Clip gefunden'
                return (
                  <div key={`${item.id}-summary`} className="flex items-start gap-3 text-sm text-white/78">
                    <span className="mt-0.5 inline-flex min-w-7 justify-center rounded-full bg-bjj-gold/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bjj-gold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{clipTitle}</p>
                      <p className="text-xs text-white/45">{getNodeById(item.nodeId)?.title || item.title}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {queue.map((item) => {
            const node = getNodeById(item.nodeId)
            const resolvedClip = resolvedClips[item.id]
            const thumbnailUrl = resolvedClip?.thumbnailUrl ?? getYoutubeThumbnail(item.clipUrl)
            const clipTitle = resolvedClip?.title ?? item.clipTitle
            const clipUrl = resolvedClip?.url ?? item.clipUrl

            return (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#141923] p-4 transition hover:border-bjj-gold/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bjj-gold/10">
                    <span className="text-lg font-black text-bjj-gold">#{item.position}</span>
                  </div>

                  {thumbnailUrl ? (
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-[#0f1520]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbnailUrl} alt={clipTitle} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#17273a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8ab4ff]">
                        {item.type}
                      </span>
                      <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                        {item.categoryTag}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">Technik</p>
                    <p className="mt-1 text-base font-bold text-white transition group-hover:text-bjj-gold">{node?.title || item.title}</p>

                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">Startseiten-Clip</p>
                    <p className="mt-1 text-sm text-white/72">{clipTitle || 'Kein Clip gefunden'}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/40">
                      <span>Node: {item.nodeId}</span>
                      <span>Clip: {clipUrl ? item.clipSource : 'fallback'}</span>
                      {resolvedClip ? <span>Quelle: {resolvedClip.source}</span> : null}
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-bjj-gold/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bjj-gold">
                          Score {item.priorityScore ?? 0}
                        </span>
                        <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                          {LEARNING_STATUS_LABELS[item.learningStatus ?? 'NEW'] ?? item.learningStatus ?? 'Neu'}
                        </span>
                        {item.isCore ? (
                          <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Core</span>
                        ) : (
                          <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Support</span>
                        )}
                        {typeof item.confidenceScore === 'number' ? (
                          <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                            Confidence {item.confidenceScore}
                          </span>
                        ) : null}
                        {item.isDue ? (
                          <span className="rounded-full bg-[#17273a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8ab4ff]">Review faellig</span>
                        ) : null}
                      </div>

                      {item.scoreReasons?.length ? (
                        <div className="mt-3 grid gap-2">
                          {item.scoreReasons.map((reason) => (
                            <div key={`${item.id}-${reason.label}-${reason.value}`} className="grid grid-cols-[54px_minmax(0,1fr)] gap-2 text-xs">
                              <span className={`font-black ${getScoreTone(reason.value)}`}>{reason.value > 0 ? `+${reason.value}` : reason.value}</span>
                              <span className="text-white/58">
                                <span className="font-semibold text-white/78">{reason.label}:</span> {reason.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-white/45">Keine Score-Beitraege. Fallback-Karte oder neutraler Score.</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/node/${item.nodeId}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-bjj-gold/30 hover:text-bjj-gold"
                      >
                        Technik oeffnen
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      {clipUrl ? (
                        <a
                          href={clipUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-2 text-xs font-semibold text-bjj-gold transition hover:bg-bjj-gold/15"
                        >
                          Clip oeffnen
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1 text-white/30 group-hover:text-bjj-gold transition">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {queue.length === 0 && userProfile && !loading ? (
        <div className="mx-auto max-w-2xl rounded-[1.4rem] border border-white/10 bg-[#141923]/30 p-8 text-center">
          <p className="text-white/60">Keine Queue verfuegbar. Der User hat moeglicherweise alle Nodes abgeschlossen oder noch keine Fortschritte.</p>
        </div>
      ) : null}
    </div>
  )
}
