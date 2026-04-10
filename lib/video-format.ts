export type ClipVideoFormat =
  | 'youtube'
  | 'youtube_shorts'
  | 'instagram_reel'
  | 'instagram_post'
  | 'tiktok'
  | 'external'

export function detectVideoFormat(url?: string | null): ClipVideoFormat {
  if (!url) return 'external'

  const normalized = url.toLowerCase()

  if (normalized.includes('tiktok.com')) return 'tiktok'
  if (normalized.includes('instagram.com/reel/')) return 'instagram_reel'
  if (normalized.includes('instagram.com/p/')) return 'instagram_post'
  if (normalized.includes('/shorts/')) return 'youtube_shorts'
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube'

  return 'external'
}

export function getVideoPlatform(format: ClipVideoFormat) {
  if (format === 'youtube' || format === 'youtube_shorts') return 'youtube'
  if (format === 'instagram_reel' || format === 'instagram_post') return 'instagram'
  if (format === 'tiktok') return 'tiktok'
  return 'external'
}

export function getVideoFormatLabel(format: ClipVideoFormat) {
  switch (format) {
    case 'youtube':
      return 'YouTube'
    case 'youtube_shorts':
      return 'YouTube Shorts'
    case 'instagram_reel':
      return 'Instagram Reel'
    case 'instagram_post':
      return 'Instagram Post'
    case 'tiktok':
      return 'TikTok'
    default:
      return 'Extern'
  }
}

export function isPortraitVideoFormat(format: ClipVideoFormat) {
  return format === 'youtube_shorts' || format === 'instagram_reel' || format === 'instagram_post' || format === 'tiktok'
}

export function extractYoutubeId(url?: string | null) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    if (host.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    }

    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.split('/').filter(Boolean)[1] ?? null
    }

    return parsed.searchParams.get('v')
  } catch {
    const short = url.match(/youtu\.be\/([^?&]+)/)
    if (short?.[1]) return short[1]

    const shorts = url.match(/\/shorts\/([^?&/]+)/)
    if (shorts?.[1]) return shorts[1]

    const long = url.match(/[?&]v=([^&]+)/)
    if (long?.[1]) return long[1]
  }

  return null
}

export function extractInstagramEmbedUrl(url?: string | null) {
  if (!url) return null

  const match = url.match(/instagram\.com\/(reel|p)\/([^/?#]+)/)
  if (!match) return null

  return `https://www.instagram.com/${match[1]}/${match[2]}/embed`
}
