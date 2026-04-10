import {
  detectVideoFormat,
  extractInstagramEmbedUrl,
  extractYoutubeId,
  getVideoFormatLabel,
  isPortraitVideoFormat,
} from '@/lib/video-format'

type YoutubeEmbedProps = {
  title: string
  url: string
}

function buildYoutubeEmbedUrl(url: string) {
  const id = extractYoutubeId(url)
  if (!id) return null

  const params = new URLSearchParams({
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
  })

  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

export function YoutubeEmbed({ title, url }: YoutubeEmbedProps) {
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
  const youtubeEmbedUrl = buildYoutubeEmbedUrl(url)
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
        Video oeffnen: {title}
      </a>
    )
  }

  return (
    <div className="clip-preview-frame overflow-hidden rounded-[1.5rem] bg-bjj-surface">
      <div className={`clip-embed-shell ${isPortrait ? 'clip-embed-shell-portrait' : 'clip-embed-shell-landscape'}`}>
        <div className="clip-embed-titlebar">
          <span className="clip-embed-format-badge">{formatLabel}</span>
          <p className="clip-embed-title">{title}</p>
        </div>

        <div className={`clip-embed-media ${isPortrait ? 'clip-embed-media-portrait' : 'clip-embed-media-landscape'}`}>
          <div className={`clip-embed-frame ${instagramEmbedUrl ? 'clip-embed-frame-instagram' : ''}`}>
            <iframe
              title={title}
              src={instagramEmbedUrl ?? youtubeEmbedUrl ?? undefined}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowTransparency
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
