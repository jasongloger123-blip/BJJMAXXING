'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Clock3, Link2 } from 'lucide-react'
import { SavedClipButton } from '@/components/SavedClipButton'
import type { SavedClipPreview } from '@/lib/saved-clips'
import { SAVED_CLIPS_EVENT } from '@/lib/saved-clips'
import { createClient } from '@/lib/supabase/client'

function extractYoutubeId(url: string) {
  const short = url.match(/youtu\.be\/([^?&]+)/)
  if (short?.[1]) return short[1]

  const long = url.match(/[?&]v=([^&]+)/)
  if (long?.[1]) return long[1]

  return null
}

function getYoutubeThumbnail(url: string) {
  const id = extractYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

function getClipSourceLabel(clip: SavedClipPreview) {
  return clip.video_platform ?? clip.provider ?? 'Video'
}

export function ProfileSavedClips() {
  const supabase = createClient()
  const [clips, setClips] = useState<SavedClipPreview[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadSavedClips = useCallback(async () => {
    setIsLoading(true)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user

    if (!user) {
      setClips([])
      setIsLoading(false)
      return
    }

    const { data: savedRows, error: savedError } = await supabase
      .from('user_saved_clips')
      .select('clip_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (savedError || !savedRows || savedRows.length === 0) {
      setClips([])
      setIsLoading(false)
      return
    }

    const clipIds = savedRows.map((row) => row.clip_id).filter((value): value is string => typeof value === 'string')

    // First try: search by clip_archive.id
    const { data: clipRows, error: clipError } = await supabase
      .from('clip_archive')
      .select('id, external_source_id, title, summary, source_url, video_url, video_platform, provider, timestamp_label, hashtags, created_at')
      .in('id', clipIds)

    if (clipError) {
      console.error('Error loading saved clips by id:', clipError)
    }

    let foundClips = (clipRows ?? []) as SavedClipPreview[]

    // Fallback: if no clips found, try searching by external_source_id
    if (foundClips.length === 0 && clipIds.length > 0) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from('clip_archive')
        .select('id, external_source_id, title, summary, source_url, video_url, video_platform, provider, timestamp_label, hashtags, created_at')
        .in('external_source_id', clipIds)

      if (fallbackError) {
        console.error('Error loading saved clips by external_source_id:', fallbackError)
      }

      foundClips = (fallbackRows ?? []) as SavedClipPreview[]
    }

    // Build lookup map by both id and external_source_id
    const clipMap = new Map<string, SavedClipPreview>()
    for (const clip of foundClips) {
      const enrichedClip = {
        ...clip,
        hashtags: Array.isArray(clip.hashtags) ? clip.hashtags : [],
      }
      clipMap.set(clip.id, enrichedClip)
      if (clip.external_source_id) {
        clipMap.set(clip.external_source_id, enrichedClip)
      }
    }

    const mappedClips = savedRows
      .map((row) => {
        const clip = clipMap.get(row.clip_id)
        return clip ? { ...clip, created_at: row.created_at ?? clip.created_at } : null
      })
      .filter((value): value is SavedClipPreview => Boolean(value))

    // Remove duplicates (in case both id and external_source_id matched)
    const uniqueClips = Array.from(new Map(mappedClips.map(c => [c.id, c])).values())

    setClips(uniqueClips)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadSavedClips()
  }, [loadSavedClips])

  useEffect(() => {
    function handleSavedClipsChanged(event: Event) {
      const detail = (event as CustomEvent<string[]>).detail
      if (!Array.isArray(detail)) return
      
      // Only reload if the saved clips actually changed
      const currentIds = clips.map(c => c.id).sort()
      const newIds = detail.sort()
      
      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
        void loadSavedClips()
      }
    }

    window.addEventListener(SAVED_CLIPS_EVENT, handleSavedClipsChanged)
    return () => window.removeEventListener(SAVED_CLIPS_EVENT, handleSavedClipsChanged)
  }, [loadSavedClips, clips])

  const emptyState = useMemo(
    () => (
      <div className="rounded-[1.35rem] border border-white/[0.06] bg-[#111827] px-5 py-6 text-sm leading-7 text-white/62">
        Du hast noch keine Videos gespeichert. Oeffne einen Clip und tippe auf das Favoritenzeichen, dann taucht er hier auf.
      </div>
    ),
    []
  )

  return (
    <section className="relative mt-6">
      <div className="rounded-[1.55rem] border border-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.18)_100%)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">
              <Clock3 className="h-4 w-4" />
              Gespeicherte Videos
            </div>
            <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-white">Deine Favoriten</h2>
            <p className="mt-1 text-sm leading-relaxed text-bjj-muted">
              Alles, was du auf der Clipseite speicherst, wird hier gesammelt.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/68">
            {clips.length} gespeichert
          </span>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-52 rounded-[1.35rem] border border-white/[0.06] bg-white/[0.03] shimmer" />
              ))}
            </div>
          ) : clips.length === 0 ? (
            emptyState
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {clips.map((clip) => {
                const videoUrl = clip.video_url ?? clip.source_url
                const thumbnailUrl = getYoutubeThumbnail(videoUrl)
                return (
                  <article
                    key={clip.id}
                    className="overflow-hidden rounded-[1.35rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,18,26,0.94),rgba(10,13,20,0.92))]"
                  >
                    <Link href={`/clips/${clip.id}`} className="block">
                      <div className="relative h-44 overflow-hidden bg-[#0f1520]">
                        {thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbnailUrl} alt={clip.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_50%),linear-gradient(180deg,#272f3f,#131924)] px-6 text-center">
                            <span className="text-sm font-semibold text-white/78">{getClipSourceLabel(clip)}</span>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#090c12] to-transparent" />
                      </div>
                    </Link>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/42">
                            <span>{getClipSourceLabel(clip)}</span>
                            {clip.timestamp_label ? <span>{clip.timestamp_label}</span> : null}
                          </div>
                          <h3 className="mt-2 line-clamp-2 text-lg font-black tracking-[-0.03em] text-white">{clip.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <SavedClipButton clipId={clip.id} className="h-10 w-10 shrink-0" />
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bjj-gold/20 bg-bjj-gold/10 text-bjj-gold transition hover:bg-bjj-gold/16"
                            title="Original Video öffnen"
                            aria-label="Original Video öffnen"
                          >
                            <Link2 className="h-4 w-4" />
                          </a>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-7 text-white/68">
                        {clip.summary ?? 'Kein Beschreibungstext für diesen Clip gespeichert.'}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/clips/${clip.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/84"
                        >
                          Clip öffnen
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
