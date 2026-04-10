'use client'

import Link from 'next/link'
import { useState, useCallback } from 'react'
import { ArrowRight, Search, User, RefreshCw, ExternalLink, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getNodeById } from '@/lib/nodes'
import { buildStartQueue, type QueueCard, type QueueEvent } from '@/lib/start-queue'

type QueueItem = QueueCard & {
  position: number
}

function extractYoutubeId(url: string) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match?.[1] ?? null
}

function getYoutubeThumbnail(url: string) {
  const id = extractYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

export default function AdminUserQueuePage() {
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [userProfile, setUserProfile] = useState<{ id: string; username: string | null; full_name: string | null; email: string | null } | null>(null)
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const loadUserQueue = useCallback(async (targetUserId: string) => {
    setLoading(true)
    setError(null)

    try {
      // Load user profile
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

      // Load progress
      const { data: progressData, error: progressError } = await supabase
        .from('progress')
        .select('node_id, completed')
        .eq('user_id', targetUserId)

      if (progressError) {
        console.error('Progress error:', progressError)
      }

      const completed = (progressData ?? []).filter(p => p.completed).map(p => p.node_id)
      setCompletedIds(completed)

      // Load events
      const { data: eventsData, error: eventsError } = await supabase
        .from('training_clip_events')
        .select('node_id, clip_key, clip_type, result, created_at')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      if (eventsError) {
        console.error('Events error:', eventsError)
      }

      const userEvents = (eventsData ?? []) as QueueEvent[]

      // Build queue
      const builtQueue = buildStartQueue(completed, userEvents)
      
      // Add position numbers and limit to 10
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
  }, [supabase])

  const handleSearch = useCallback(async () => {
    const trimmed = userQuery.trim()
    if (!trimmed) return

    // Try to find by username, email, or id
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
      // Use first match
      loadUserQueue(users[0].id)
    } else {
      // Try exact ID match
      loadUserQueue(trimmed)
    }
  }, [userQuery, supabase, loadUserQueue])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-black text-white">User Queue Preview</h1>
        <p className="mt-2 text-bjj-muted">Zeige die nächsten 10 Videos in der Startseiten-Queue eines Users</p>
      </div>

      {/* Search */}
      <div className="mx-auto max-w-2xl rounded-[1.6rem] border border-white/10 bg-[#141923] p-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="User ID, Username oder Email..."
              className="w-full rounded-full border border-white/10 bg-white/[0.03] py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-bjj-gold/40"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !userQuery.trim()}
            className="rounded-full bg-bjj-gold px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-bjj-coal transition hover:bg-bjj-gold/90 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Anzeigen'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* User Info */}
      {userProfile && (
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
      )}

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-bjj-gold">
            Queue Reihenfolge (Top {queue.length})
          </p>
          
          {queue.map((item) => {
            const node = getNodeById(item.nodeId)
            const thumbnailUrl = getYoutubeThumbnail(item.clipUrl)
            
            return (
              <Link
                key={item.id}
                href={`/clips/${item.id.split('-')[0]}`}
                className="group relative block overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#141923] p-4 transition hover:border-bjj-gold/30"
              >
                <div className="flex items-start gap-4">
                  {/* Position Number */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bjj-gold/10">
                    <span className="text-lg font-black text-bjj-gold">#{item.position}</span>
                  </div>

                  {/* Thumbnail */}
                  {thumbnailUrl && (
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-[#0f1520]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbnailUrl} alt={item.clipTitle} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#17273a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8ab4ff]">
                        {item.type}
                      </span>
                      <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                        {item.categoryTag}
                      </span>
                    </div>

                    <p className="mt-2 text-base font-bold text-white group-hover:text-bjj-gold transition">{node?.title || item.title}</p>
                    <p className="mt-1 text-sm text-white/60">{item.clipTitle}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/40">
                      <span>Node: {item.nodeId}</span>
                      <span>·</span>
                      <span>Clip: {item.clipSource}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1 text-white/30 group-hover:text-bjj-gold transition">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {queue.length === 0 && userProfile && !loading && (
        <div className="mx-auto max-w-2xl rounded-[1.4rem] border border-white/10 bg-[#141923]/30 p-8 text-center">
          <p className="text-white/60">Keine Queue verfügbar. Der User hat möglicherweise alle Nodes abgeschlossen oder noch keine Fortschritte.</p>
        </div>
      )}
    </div>
  )
}
