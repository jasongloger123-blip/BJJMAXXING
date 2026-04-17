'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  detectVideoFormat,
  extractInstagramEmbedUrl,
  extractVideoStartSeconds,
  extractYoutubeId,
  getVideoFormatLabel,
  isPortraitVideoFormat,
} from '@/lib/video-format'

type YoutubeEmbedProps = {
  title: string
  url: string
  showHeader?: boolean
  hideChrome?: boolean
  playbackRate?: number
  resetKey?: number // Used to trigger seekTo(0) without remounting
}

function buildYoutubeEmbedUrl(url: string, hideChrome = false) {
  const id = extractYoutubeId(url)
  if (!id) return null

  const params = new URLSearchParams({
    autoplay: '1',
    mute: '0',
    playsinline: '1',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  })
  const startSeconds = extractVideoStartSeconds(url)
  if (startSeconds !== null && startSeconds > 0) {
    params.set('start', String(startSeconds))
  }

  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

export function YoutubeEmbed({ title, url, showHeader = true, hideChrome = false, playbackRate = 1, resetKey = 0 }: YoutubeEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const sendYoutubeCommand = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: 'command',
        func,
        args,
      }),
      '*'
    )
  }, [])

  useEffect(() => {
    if (playbackRate === 1) return
    sendYoutubeCommand('setPlaybackRate', [playbackRate])
    const timeout = window.setTimeout(() => sendYoutubeCommand('setPlaybackRate', [playbackRate]), 500)
    return () => window.clearTimeout(timeout)
  }, [playbackRate, sendYoutubeCommand])

  // Reset video to start when resetKey changes (without remounting)
  useEffect(() => {
    if (resetKey > 0) {
      // First pause, then seek to 0, then play
      sendYoutubeCommand('pauseVideo')
      sendYoutubeCommand('seekTo', [0, true])
      // Small delay to ensure seek completes before playing
      const playTimeout = window.setTimeout(() => {
        sendYoutubeCommand('playVideo')
      }, 100)
      return () => window.clearTimeout(playTimeout)
    }
  }, [resetKey, sendYoutubeCommand])

  if (!url) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-bjj-border bg-bjj-surface p-6 text-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-bjj-gold">Noch kein Video</p>
          <p className="mt-3 text-lg font-bold text-white">{title}</p>
          <p className="mt-2 text-sm text-bjj-muted">Fuer diese Technik ist auf der Startseite noch kein Clip hinterlegt.</p>
        </div>
      </div>
    )
  }

  const format = detectVideoFormat(url)
  const youtubeEmbedUrl = buildYoutubeEmbedUrl(url, hideChrome)
  const instagramEmbedUrl = extractInstagramEmbedUrl(url)
  const isPortrait = isPortraitVideoFormat(format)
  const formatLabel = getVideoFormatLabel(format)

  if (!youtubeEmbedUrl && !instagramEmbedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl border border-bjj-border bg-bjj-surface p-4 text-sm text-bjj-orange"
      >
        Video öffnen: {title}
      </a>
    )
  }

  return (
    <div className="clip-preview-frame overflow-hidden rounded-[1.5rem] bg-bjj-surface">
      <div className={`clip-embed-shell ${isPortrait ? 'clip-embed-shell-portrait' : 'clip-embed-shell-landscape'}`}>
        {showHeader ? (
          <div className="clip-embed-titlebar">
            <span className="clip-embed-format-badge">{formatLabel}</span>
            <p className="clip-embed-title">{title}</p>
          </div>
        ) : null}

        <div className={`clip-embed-media ${isPortrait ? 'clip-embed-media-portrait' : 'clip-embed-media-landscape'}`}>
          <div className={`clip-embed-frame ${instagramEmbedUrl ? 'clip-embed-frame-instagram' : ''}`}>
            <iframe
              ref={iframeRef}
              title={title}
              src={instagramEmbedUrl ?? youtubeEmbedUrl ?? undefined}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowTransparency
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => sendYoutubeCommand('setPlaybackRate', [playbackRate])}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
