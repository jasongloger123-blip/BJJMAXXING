'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bookmark, ChevronLeft, ChevronRight, EyeOff, RotateCcw, Send, Volume2, VolumeX } from 'lucide-react'
import type { CuratedClip } from '@/lib/curated-clips'
import {
  extractInstagramEmbedUrl,
  extractYoutubeId,
  getVideoFormatLabel,
  isPortraitVideoFormat,
} from '@/lib/video-format'

type GameplanClipDeckProps = {
  clips: CuratedClip[]
  detailHref?: string
  detailCtaLabel?: string
}

const SAVED_CLIPS_STORAGE_KEY = 'gameplan-saved-clips'

function parseClipStartSeconds(clipWindow?: string) {
  if (!clipWindow) return 0
  const match = clipWindow.match(/^(\d+):(\d+)/)
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

function slugifyTag(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

function buildHashtags(clip: CuratedClip) {
  const tags = [
    clip.category,
    clip.levelLabel,
    clip.source === 'youtube' ? 'youtube' : clip.source === 'instagram' ? 'instagram' : 'video',
    ...clip.title.split(' ').slice(0, 4),
  ]

  return Array.from(new Set(tags.map(slugifyTag).filter((tag) => tag.length >= 3))).slice(0, 8)
}

function buildYoutubeEmbedUrl(url: string, muted: boolean, clipWindow?: string) {
  const id = extractYoutubeId(url)
  if (!id) return null

  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  })

  const start = parseClipStartSeconds(clipWindow)
  if (start > 0) {
    params.set('start', String(start))
  }

  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

export function GameplanClipDeck({ clips, detailHref, detailCtaLabel }: GameplanClipDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [restartNonce, setRestartNonce] = useState(0)
  const [savedClipIds, setSavedClipIds] = useState<string[]>([])
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied'>('idle')

  useEffect(() => {
    setActiveIndex(0)
    setMuted(true)
    setRestartNonce((value) => value + 1)
  }, [clips])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(SAVED_CLIPS_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as string[]
      if (Array.isArray(parsed)) {
        setSavedClipIds(parsed)
      }
    } catch {
      setSavedClipIds([])
    }
  }, [])

  const clip = clips[activeIndex] ?? null
  const hashtags = useMemo(() => (clip ? buildHashtags(clip) : []), [clip])
  const isSaved = clip ? savedClipIds.includes(clip.id) : false
  const activeInstagramEmbedUrl = useMemo(() => (clip ? extractInstagramEmbedUrl(clip.sourceUrl) : null), [clip])

  useEffect(() => {
    if (shareFeedback !== 'copied') return
    const timeout = window.setTimeout(() => setShareFeedback('idle'), 1800)
    return () => window.clearTimeout(timeout)
  }, [shareFeedback])

  useEffect(() => {
    if (!activeInstagramEmbedUrl) return
    const timeout = window.setTimeout(() => setRestartNonce((value) => value + 1), 35000)
    return () => window.clearTimeout(timeout)
  }, [activeInstagramEmbedUrl, restartNonce])

  if (!clip) {
    return null
  }

  const canGoPrev = activeIndex > 0
  const canGoNext = activeIndex < clips.length - 1
  const youtubeEmbedUrl = buildYoutubeEmbedUrl(clip.sourceUrl, muted, clip.clipWindow)
  const instagramEmbedUrl = activeInstagramEmbedUrl
  const isPortrait = isPortraitVideoFormat(clip.videoFormat)
  const formatLabel = getVideoFormatLabel(clip.videoFormat)

  async function handleShare() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(clip.sourceUrl)
      setShareFeedback('copied')
    } catch {
      setShareFeedback('idle')
    }
  }

  function handleToggleSave() {
    if (typeof window === 'undefined') return

    const next = isSaved ? savedClipIds.filter((id) => id !== clip.id) : [...savedClipIds, clip.id]
    setSavedClipIds(next)
    window.localStorage.setItem(SAVED_CLIPS_STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <div className="overflow-hidden rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(26,32,45,0.92),rgba(14,18,27,0.95))]">
      <div className={`clip-embed-shell ${isPortrait ? 'clip-embed-shell-portrait' : 'clip-embed-shell-landscape'}`}>
        <div className="clip-embed-titlebar">
          <span className="clip-embed-format-badge">{formatLabel}</span>
        </div>

        <div className={`clip-embed-media ${isPortrait ? 'clip-embed-media-portrait' : 'clip-embed-media-landscape'}`}>
          {youtubeEmbedUrl ? (
            <div className="clip-embed-frame">
              <iframe
                key={`${clip.id}-${muted ? 'muted' : 'sound'}-${restartNonce}`}
                src={youtubeEmbedUrl}
                title={clip.title}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : instagramEmbedUrl ? (
            <div className="clip-embed-frame clip-embed-frame-instagram">
              <iframe
                key={`${clip.id}-${restartNonce}`}
                src={instagramEmbedUrl}
                title={clip.title}
                className="absolute inset-0 h-full w-full border-0"
                allowTransparency
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <a
              href={clip.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_50%),linear-gradient(180deg,#272f3f,#131924)] px-6 text-center"
            >
              <span className="text-sm font-semibold text-white/84">Video extern öffnen</span>
            </a>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/72">
              <EyeOff className="h-3.5 w-3.5" />
              Shared
            </span>
            <button
              type="button"
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
              disabled={!canGoPrev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] text-white/78 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Vorheriges Video"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[52px] text-center text-xs font-semibold text-white/68">
              {activeIndex + 1} / {clips.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveIndex((index) => Math.min(clips.length - 1, index + 1))}
              disabled={!canGoNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] text-white/78 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Naechstes Video"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] text-white/78 transition hover:bg-white/[0.08]"
              aria-label={muted ? 'Ton einschalten' : 'Stummschalten'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setRestartNonce((value) => value + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] text-white/78 transition hover:bg-white/[0.08]"
              aria-label="Clip neu starten"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleToggleSave}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                isSaved
                  ? 'bg-bjj-gold/16 text-bjj-gold'
                  : 'bg-white/[0.03] text-white/78 hover:bg-white/[0.08]'
              }`}
              aria-label={isSaved ? 'Clip gespeichert' : 'Clip speichern'}
            >
              <Bookmark className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-white/[0.03] px-3 text-xs font-semibold text-white/78 transition hover:bg-white/[0.08]"
              aria-label="Clip teilen"
            >
              <Send className="h-3.5 w-3.5" />
              {shareFeedback === 'copied' ? 'Kopiert' : 'Teilen'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-1">
        <p className="text-base font-bold text-white">{clip.title}</p>
      </div>

      {hashtags.length > 0 ? (
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-[#132742] px-2.5 py-1 text-[11px] font-semibold text-[#9cc2ff] transition hover:bg-[#193152]"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {clip.detailHref ? (
            <Link
              href={clip.detailHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              Clip ansehen
            </Link>
          ) : null}
          {detailHref && detailCtaLabel ? (
            <Link
              href={detailHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              {detailCtaLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
