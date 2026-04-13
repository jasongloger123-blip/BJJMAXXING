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

export function parseTimestampToSeconds(value?: string | null) {
  if (!value) return null

  const normalized = decodeURIComponent(value)
    .trim()
    .replace(/^#/, '')
    .replace(/^(?:t|start)=/i, '')

  if (!normalized) return null

  if (/^\d+$/.test(normalized)) {
    return Number(normalized)
  }

  const colonParts = normalized.split(':').map((part) => Number(part))
  if (colonParts.length > 1 && colonParts.every((part) => Number.isFinite(part))) {
    return colonParts.reduce((total, part) => total * 60 + part, 0)
  }

  let seconds = 0
  let matched = false
  const pattern = /(\d+(?:\.\d+)?)(h|m|s)/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(normalized))) {
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) continue

    matched = true
    if (match[2].toLowerCase() === 'h') seconds += amount * 3600
    if (match[2].toLowerCase() === 'm') seconds += amount * 60
    if (match[2].toLowerCase() === 's') seconds += amount
  }

  return matched ? Math.floor(seconds) : null
}

export function extractVideoStartSeconds(url?: string | null) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const queryStart = parseTimestampToSeconds(parsed.searchParams.get('start') ?? parsed.searchParams.get('t'))
    if (queryStart !== null) return queryStart

    if (parsed.hash) {
      const hashStart = parseTimestampToSeconds(parsed.hash)
      if (hashStart !== null) return hashStart

      const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''))
      const hashParamStart = parseTimestampToSeconds(hashParams.get('start') ?? hashParams.get('t'))
      if (hashParamStart !== null) return hashParamStart
    }
  } catch {
    const match = url.match(/[?&#](?:t|start)=([^&#]+)/i)
    const fallbackStart = parseTimestampToSeconds(match?.[1])
    if (fallbackStart !== null) return fallbackStart
  }

  return null
}

export function appendStartSecondsToVideoUrl(url: string | null | undefined, timestampSeconds: number | null | undefined) {
  if (!url || timestampSeconds === null || timestampSeconds === undefined || timestampSeconds <= 0) return url ?? ''
  if (extractVideoStartSeconds(url) !== null) return url

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      parsed.searchParams.set('t', `${Math.floor(timestampSeconds)}s`)
      return parsed.toString()
    }
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(timestampSeconds)}s`
  }

  return url
}

export function extractInstagramEmbedUrl(url?: string | null) {
  if (!url) return null

  const match = url.match(/instagram\.com\/(reel|p)\/([^/?#]+)/)
  if (!match) return null

  return `https://www.instagram.com/${match[1]}/${match[2]}/embed`
}

export function extractInstagramPostId(url?: string | null): string | null {
  if (!url) return null

  // Match both /reel/ and /p/ (post) URLs
  const match = url.match(/instagram\.com\/(?:reel|p)\/([^/?#]+)/)
  return match?.[1] ?? null
}
