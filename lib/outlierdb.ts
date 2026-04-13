import { createHash } from 'node:crypto'
import {
  EXTERNAL_SOURCE_PROVIDER,
  detectVideoPlatform,
  normalizeHashtags,
  normalizeWhitespace,
  type ExternalSearchMode,
  type ExternalTechniqueSourceRecord,
} from '@/lib/external-technique-sources'
import { detectVideoFormat } from '@/lib/video-format'

const OUTLIERDB_SEARCH_URL = 'https://outlier-database-production-d591.up.railway.app/search'
const OUTLIERDB_CHAT_URL = 'https://outlier-database-production-d591.up.railway.app/chat'
const OUTLIERDB_SEQUENCE_API_BASE_URL = 'https://outlier-database-production-d591.up.railway.app/sequences'
const MAX_SOURCE_URL_LENGTH = 1024
const MAX_TITLE_LENGTH = 180
const MAX_SUMMARY_LENGTH = 4000
const MAX_QUERY_LENGTH = 512
const MAX_CHAT_TEXT_LENGTH = 20000

// Begriffe die auf Englisch bleiben sollen (BJJ-spezifisch)
const BJJ_TERMS_KEEP_ENGLISH = new Set([
  'guard', 'pass', 'passing', 'sweep', 'submission', 'choke', 'lock',
  'x-guard', 'ashigarami', 'butterfly', 'half guard', 'closed guard',
  'open guard', 'spider guard', 'lasso', 'worm guard', 'berimbolo',
  'de la riva', 'single leg', 'double leg', 'takedown', 'backtake',
  'back take', 'back control', 'mount', 'side control', 'knee on belly',
  'north south', 'kimura', 'guillotine', 'triangle', 'armbar',
  'heel hook', 'kneebar', 'ankle lock', 'wrist lock', ' Americana',
  'omoplata', 'darce', 'anaconda', 'anaconda choke', 'brabo choke',
  'gogoplata', 'baratoplata', 'foot lock', 'toe hold', 'calf slicer',
  'bicep slicer', 'crucifix', 'leg drag', 'torreando', 'knee slide',
  'stack pass', 'over under', 'pressure pass', 'floating pass',
  'scramble', 'inversion', 'granby', 'granby roll', 'technical standup',
  'technical stand up', 'shrimp', 'shrimping', 'frame', 'framing',
  'underhook', 'overhook', 'whizzer', 'crossface', 'posture',
  'base', 'balance', 'hip escape', 'elbow escape', 'bridging',
  'upa', 's-mount', 's mount', 'high mount', 'low mount',
  'turtle', 'turtle guard', 'quarter guard', 'deep half',
  'z-guard', 'z guard', 'knee shield', 'coyote guard',
  'reverse de la riva', 'rdlr', 'shin to shin', 'collar sleeve',
  'lasso guard', 'spiderweb', 'honey hole', 'saddle', 'inside sankaku',
  'ashi garami', 'ashi', 'outside ashi', 'cross ashi', 'kani basami',
  'scissor sweep', 'flower sweep', 'pendulum sweep', 'hook sweep',
  'clock choke', 'loop choke', 'bulldog choke', 'peruvian necktie',
  'ezekiel choke', 'sleeper choke', 'baseball bat choke',
  'lapel choke', 'bow and arrow', 'cross choke', 'rear naked choke',
  'rnc', 'guillotine choke', 'arm triangle', 'anaconda', 'marcelotine',
  'twister', 'crank', 'neck crank', 'can opener', 'butterfly guard',
  'shin on shin', 'body lock', 'seatbelt', 'harness', 'gift wrap',
  'lapel', 'collar', 'sleeve', 'pant grip', 'ankle grip', 'wrist grip',
  'elbow grip', 'kimura grip', 'wrist control', 'ankle pick',
  'sweep single', 'blast double', 'ankle trip', 'uchi mata',
  'osoto gari', 'harai goshi', 'seoi nage', 'ippon seoi nage',
  'morote seoi nage', 'kouchi gari', 'ouchi gari', 'kosoto gari',
  'koshi guruma', 'tsuri komi goshi', 'ogoshi', 'kata guruma',
  'fireman carry', 'double under', 'single under', 'body fold',
  'wrestle up', 'wrestle-up', 'get up', 'technical get up',
  'donkey guard', 'matrix', 'matrix guard', 'polaris', 'ebi',
  'saddle entry', 'leg entanglement', 'entanglement',
  'straight ankle lock', 'achilles lock', 'toe hold', 'knee reaping',
  'reaping', 'berimbolo', 'crab ride', 'twister side control',
  'smash pass', 'smashing', 'knee cut', 'knee slice',
])

// Übersetzungs-Mapping für häufige englische Phrasen
const TRANSLATION_MAP: Record<string, string> = {
  'in this video': 'In diesem Video',
  'we show': 'zeigen wir',
  'we demonstrate': 'zeigen wir',
  'we cover': 'behandeln wir',
  'learn how to': 'Lerne wie man',
  'how to': 'Wie man',
  'step by step': 'Schritt für Schritt',
  'breakdown': 'Aufschlüsselung',
  'details': 'Details',
  'concepts': 'Konzepte',
  'principles': 'Prinzipien',
  'fundamentals': 'Grundlagen',
  'advanced': 'Fortgeschritten',
  'beginner': 'Anfänger',
  'intermediate': 'Mittelstufe',
  'drill': 'Drill',
  'drilling': 'Drilling',
  'sparring': 'Sparring',
  'rolling': 'Rolling',
  'technique': 'Technik',
  'system': 'System',
  'approach': 'Ansatz',
  'method': 'Methode',
  'entry': 'Einstieg',
  'finish': 'Abschluss',
  'setup': 'Aufbau',
  'transition': 'Übergang',
  'escape': 'Escape',
  'defense': 'Verteidigung',
  'counter': 'Konter',
  'attack': 'Angriff',
  'control': 'Kontrolle',
  'pressure': 'Druck',
  'balance': 'Gleichgewicht',
  'weight distribution': 'Gewichtsverteilung',
  'leverage': 'Hebelwirkung',
  'angle': 'Winkel',
  'position': 'Position',
  'dominant position': 'Dominante Position',
  'top position': 'Obere Position',
  'bottom position': 'Untere Position',
  'chain wrestling': 'Chain Wrestling',
  'chain submissions': 'Chain Submissions',
  'flow': 'Flow',
  'flow chart': 'Ablaufdiagramm',
  'sequence': 'Sequenz',
  'combinations': 'Kombinationen',
  'options': 'Optionen',
  'variations': 'Variationen',
  'grips': 'Griffe',
  'gripping': 'Greifen',
  'hand fighting': 'Hand Fighting',
  'pummeling': 'Pummeling',
  'ties': 'Bindungen',
  'clinch': 'Clinch',
  'distance management': 'Distanzmanagement',
  'timing': 'Timing',
  'rhythm': 'Rhythmus',
  'pace': 'Tempo',
  'speed': 'Geschwindigkeit',
  'explosiveness': 'Explosivität',
  'fluidity': 'Flüssigkeit',
  'smooth': 'flüssig',
  'clean': 'sauber',
  'tight': 'eng',
  'loose': 'locker',
  'relaxed': 'entspannt',
  'tense': 'angespannt',
  'posture': 'Haltung',
  'alignment': 'Ausrichtung',
  'structure': 'Struktur',
  'connection': 'Verbindung',
  'disconnection': 'Trennung',
  'isolation': 'Isolation',
  'segment': 'Segment',
  'part': 'Teil',
  'full': 'vollständig',
  'complete': 'komplett',
  'partial': 'teilweise',
  'modified': 'modifiziert',
  'traditional': 'traditionell',
  'modern': 'modern',
  'classic': 'klassisch',
  'no-gi': 'No-Gi',
  'gi': 'Gi',
  'competition': 'Wettkampf',
  'self defense': 'Selbstverteidigung',
  'mma': 'MMA',
  'street': 'Straße',
  'sport': 'Sport',
  'ibjjf': 'IBJJF',
  'adcc': 'ADCC',
  'pan ams': 'Pan Ams',
  'worlds': 'Weltmeisterschaft',
  'euros': 'Europameisterschaft',
  'brasileiro': 'Brasileiro',
  'brazilian nationals': 'Brasilianische Meisterschaft',
}

// Funktion um Beschreibungen intelligent zu übersetzen
function translateDescription(text: string): string {
  if (!text || typeof text !== 'string') return text
  
  let translated = text
  
  // Wörter in Großbuchstaben markieren die BJJ-Terme sind (nicht übersetzen)
  const placeholderMap = new Map<string, string>()
  let placeholderIndex = 0
  
  // BJJ-Terme durch Platzhalter ersetzen
  BJJ_TERMS_KEEP_ENGLISH.forEach((term) => {
    const regex = new RegExp(`\\b${term.replace(/[-]/g, '[-\\s]?')}\\b`, 'gi')
    translated = translated.replace(regex, (match) => {
      const placeholder = `__BJJ_TERM_${placeholderIndex}__`
      placeholderMap.set(placeholder, match)
      placeholderIndex++
      return placeholder
    })
  })
  
  // Bekannte Phrasen übersetzen
  Object.entries(TRANSLATION_MAP).forEach(([en, de]) => {
    const regex = new RegExp(`\\b${en.replace(/[-\s]/g, '[-\\s]?')}\\b`, 'gi')
    translated = translated.replace(regex, de)
  })
  
  // BJJ-Terme wiederherstellen
  placeholderMap.forEach((original, placeholder) => {
    translated = translated.replace(placeholder, original)
  })
  
  return translated
}

type OutlierHashtag = {
  _id?: string
  tag?: string
}

type OutlierSequence = {
  _id: string
  note?: string
  videoURL?: string
  startingTimestamp?: number
  hashtags?: OutlierHashtag[]
  createdAt?: string
  isResource?: boolean
  createdByUser?: string
}

type OutlierGroup = {
  _id?: string
  groupId?: string
  matchingSequences?: OutlierSequence[]
  matchingCount?: number
  matchInfo?: Record<string, unknown>
  totalSequences?: number
}

type OutlierSearchResponse = {
  page: number
  limit: number
  results?: {
    groups?: OutlierGroup[]
  }
  hasMore?: boolean
  error?: string
}

type ImportFailure = {
  url: string
  reason: string
}

type ParsedChatCitation = {
  id?: string
  type?: string
  title?: string
  deeplink?: string
  videoUrl?: string
  timestamp?: number
}

type ParsedChatSupport = {
  segment?: {
    startIndex?: number
    endIndex?: number
    text?: string
  }
  citationIndices?: number[]
}

type ParsedChatLink = {
  title: string | null
  deeplink: string
  index: number
}

type ParsedRunSection = {
  sectionKey: string
  sectionTitle: string
  sectionOrder: number
  sectionSummary: string | null
  sourceUrls: string[]
  sourceOrderByUrl: Record<string, number>
  evidenceTextByUrl: Record<string, string | null>
}

export type ParsedOutlierSequence = Omit<ExternalTechniqueSourceRecord, 'id' | 'imported_at' | 'last_seen_at'> & {
  provider: typeof EXTERNAL_SOURCE_PROVIDER
}

export type OutlierImportResult = {
  mode: ExternalSearchMode
  query: string
  hashtags: string[]
  page: number | null
  limit: number | null
  hasMore: boolean
  groupCount: number
  imported: ParsedOutlierSequence[]
  failed: ImportFailure[]
  sections: ParsedRunSection[]
  requestPayload: Record<string, unknown>
  responsePayload: Record<string, unknown>
}

function buildAuthHeaders(authToken: string) {
  return {
    accept: '*/*',
    authorization: `Bearer ${authToken}`,
    'content-type': 'application/json',
    origin: 'https://outlierdb.com',
    referer: 'https://outlierdb.com/',
    'user-agent': 'BJJMAXXING OutlierDB Importer/1.0',
  }
}

function formatSeconds(seconds?: number | null) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
    return null
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':')
  }

  return [minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}...`
}

function truncatePreservingWhitespace(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value.trim()
  }

  return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}...`
}

function slugifySectionKey(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `section-${hashValue(value)}`
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24)
}

function canonicalizeSourceUrl(candidate: string, fallbackSeed: string) {
  const normalized = candidate.trim()
  if (normalized.length <= MAX_SOURCE_URL_LENGTH) {
    return normalized
  }

  return `outlierdb:oversized:${hashValue(`${fallbackSeed}:${normalized}`)}`
}

function buildSyntheticSequenceUrl(sequence: OutlierSequence) {
  const videoUrl = sequence.videoURL?.trim()
  const timestamp = typeof sequence.startingTimestamp === 'number' ? sequence.startingTimestamp : null

  if (videoUrl && timestamp !== null) {
    return canonicalizeSourceUrl(`${videoUrl}#t=${timestamp}`, sequence._id)
  }

  if (videoUrl) {
    return canonicalizeSourceUrl(videoUrl, sequence._id)
  }

  return `outlierdb:sequence:${sequence._id}`
}

function buildTitleFromText(text: string, fallback: string) {
  const firstSentence = normalizeWhitespace(text).split(/(?<=[.!?])\s+/)[0]?.trim() ?? ''
  const shortened = firstSentence.slice(0, 96).trim()
  return truncateText(shortened.length >= 12 ? shortened : fallback, MAX_TITLE_LENGTH)
}

function mapSequenceToImportRecord(sequence: OutlierSequence, query: string, group?: OutlierGroup): ParsedOutlierSequence {
  // Hashtags können entweder als String-Array oder als OutlierHashtag[] ({ _id, tag }) kommen
  const rawHashtags = (sequence.hashtags ?? []).map((entry) => {
    if (typeof entry === 'string') return entry
    if (entry && typeof entry === 'object') {
      const tagValue = (entry as { tag?: unknown }).tag
      return typeof tagValue === 'string' ? tagValue : ''
    }
    return ''
  }).filter(Boolean)
  const hashtags = normalizeHashtags(rawHashtags)
  const seconds = typeof sequence.startingTimestamp === 'number' ? sequence.startingTimestamp : null
  const videoUrl = sequence.videoURL?.trim() || null
  const fallbackTitle = hashtags.length > 0 ? hashtags.slice(0, 3).join(' ') : `OutlierDB Sequence ${sequence._id.slice(0, 8)}`
  // Uebersetze die Beschreibung, behalte BJJ-Terme auf Englisch
  const rawSummary = truncateText(normalizeWhitespace(sequence.note ?? ''), MAX_SUMMARY_LENGTH) || null
  const summary = rawSummary ? translateDescription(rawSummary) : null

  return {
    provider: EXTERNAL_SOURCE_PROVIDER,
    source_url: buildSyntheticSequenceUrl(sequence),
    source_type: 'sequence',
    title: buildTitleFromText(summary ?? '', fallbackTitle),
    video_url: appendTimestampToVideoUrl(videoUrl, seconds),
    video_platform: detectVideoPlatform(videoUrl),
    video_format: detectVideoFormat(videoUrl),
    timestamp_label: formatSeconds(seconds),
    timestamp_seconds: seconds,
    hashtags,
    summary,
    search_query: truncateText(query, MAX_QUERY_LENGTH),
    raw_payload: {
      sequence,
      group: group ?? null,
    },
  }
}

function extractUrlsFromText(value: string) {
  return Array.from(new Set(value.match(/https?:\/\/[^\s)"'<]+/g) ?? []))
}

function extractRelativeOutlierLinksFromText(value: string) {
  const links: ParsedChatLink[] = []
  const seen = new Set<string>()

  const markdownMatches = Array.from(value.matchAll(/\[([^\]]+)\]\((\/(?:sequences|resource|resources)\/[^)\s]+)\)/g))
  for (const match of markdownMatches) {
    const deeplink = match[2]?.trim()
    if (!deeplink || seen.has(deeplink)) continue
    seen.add(deeplink)
    links.push({
      title: normalizeWhitespace(match[1] ?? '') || null,
      deeplink,
      index: match.index ?? 0,
    })
  }

  const plainMatches = Array.from(value.matchAll(/(^|[\s(])((\/(?:sequences|resource|resources)\/[a-zA-Z0-9]+(?:\?type=[a-z_]+)?))/g))
  for (const match of plainMatches) {
    const deeplink = match[2]?.trim()
    if (!deeplink || seen.has(deeplink)) continue
    seen.add(deeplink)
    links.push({
      title: null,
      deeplink,
      index: match.index ?? 0,
    })
  }

  return links.sort((a, b) => a.index - b.index)
}

function walkUnknown(value: unknown, onString: (text: string) => void) {
  if (typeof value === 'string') {
    onString(value)
    return
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      walkUnknown(entry, onString)
    }
    return
  }

  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      walkUnknown(entry, onString)
    }
  }
}

function extractUrlsFromUnknown(value: unknown) {
  const urls = new Set<string>()
  walkUnknown(value, (text) => {
    for (const url of extractUrlsFromText(text)) {
      urls.add(url)
    }
  })
  return Array.from(urls)
}

function extractHashtagsFromUnknown(value: unknown) {
  const tags = new Set<string>()
  walkUnknown(value, (text) => {
    for (const tag of normalizeHashtags(text)) {
      tags.add(tag)
    }
  })
  return Array.from(tags)
}

function extractBestTextCandidate(value: unknown) {
  let best = ''
  walkUnknown(value, (text) => {
    const normalized = normalizeWhitespace(text)
    if (normalized.length > best.length) {
      best = normalized
    }
  })
  return best || null
}

function extractYoutubeUrl(value: string) {
  const directMatch = value.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/i)
  return directMatch?.[0] ?? null
}

function appendTimestampToVideoUrl(videoUrl: string | null, timestampSeconds?: number | null) {
  if (!videoUrl || typeof timestampSeconds !== 'number' || Number.isNaN(timestampSeconds) || timestampSeconds < 0) {
    return videoUrl
  }

  try {
    const parsed = new URL(videoUrl)

    if (parsed.hostname.includes('youtu.be')) {
      parsed.searchParams.set('t', String(Math.floor(timestampSeconds)))
      return parsed.toString()
    }

    if (parsed.hostname.includes('youtube.com')) {
      parsed.searchParams.set('t', String(Math.floor(timestampSeconds)))
      return parsed.toString()
    }

    return videoUrl
  } catch {
    const separator = videoUrl.includes('?') ? '&' : '?'
    return `${videoUrl}${separator}t=${Math.floor(timestampSeconds)}`
  }
}

async function fetchAsJsonOrText(url: string, authToken: string) {
  const response = await fetch(url, {
    headers: buildAuthHeaders(authToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return {
      kind: 'json' as const,
      data: (await response.json()) as unknown,
    }
  }

  return {
    kind: 'text' as const,
    data: await response.text(),
  }
}

function extractTitleFromHtml(html: string) {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
  if (ogTitle) return normalizeWhitespace(ogTitle)

  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]
  return title ? normalizeWhitespace(title) : null
}

function extractYoutubeUrlFromHtml(html: string) {
  const direct = extractYoutubeUrl(html)
  if (direct) return direct

  const iframeEmbedMatch = html.match(/<iframe[^>]+src=["']([^"']*youtube\.com\/embed\/[^"']+)["']/i)?.[1]
  if (iframeEmbedMatch) {
    try {
      const embedUrl = iframeEmbedMatch.replace(/&amp;/g, '&')
      const parsed = new URL(embedUrl)
      const idMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/)
      const videoId = idMatch?.[1]
      if (videoId) {
        const watchUrl = new URL(`https://www.youtube.com/watch?v=${videoId}`)
        const start = parsed.searchParams.get('start')
        if (start) {
          watchUrl.searchParams.set('t', start)
        }
        return watchUrl.toString()
      }
    } catch {
      // Fall through to the more generic extractors below.
    }
  }

  const srcMatch = html.match(/(?:src|href)=["']([^"']*(?:youtube\.com|youtu\.be)[^"']+)["']/i)?.[1]
  if (srcMatch) return srcMatch.replace(/&amp;/g, '&')

  const escapedMatch = html.match(/https?:\\\/\\\/(?:www\\\/)?(?:youtube\.com|youtu\.be)\\\/[^"'\\<]+/i)?.[0]
  if (escapedMatch) return escapedMatch.replace(/\\\//g, '/')

  const videoFieldMatch = html.match(/"(?:videoUrl|videoURL|embedUrl|contentUrl|playbackUrl)"\s*:\s*"([^"]+)"/i)?.[1]
  if (videoFieldMatch && extractYoutubeUrl(videoFieldMatch)) {
    return videoFieldMatch.replace(/\\\//g, '/')
  }

  return null
}

function extractDescriptionFromHtml(html: string) {
  const visibleParagraphs = Array.from(
    html.matchAll(/<p[^>]*class=["'][^"']*text-sm[^"']*text-foreground[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi)
  )
    .map((match) => stripHtmlTags(match[1] ?? ''))
    .filter((text) => text && !isGenericOutlierDescription(text))

  if (visibleParagraphs.length > 0) {
    return visibleParagraphs[visibleParagraphs.length - 1]
  }

  const ogDescription = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
  if (ogDescription) return normalizeWhitespace(ogDescription)

  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
  if (metaDescription) return normalizeWhitespace(metaDescription)

  return null
}

function extractIframeHtmlSnippet(html: string) {
  return html.match(/<iframe[^>]+src=["'][^"']*youtube\.com\/embed\/[^"']+["'][^>]*>/i)?.[0] ?? null
}

function extractHashtagButtonSnippets(html: string) {
  const snippets = Array.from(
    html.matchAll(/<button[^>]*title=["'][^"']*Add\s+(?:&quot;|")?#?[a-z0-9_-]+(?:&quot;|")?\s+to\s+search[^"']*["'][^>]*>[\s\S]*?<\/button>/gi)
  )
    .map((match) => normalizeWhitespace(match[0] ?? ''))
    .filter(Boolean)

  return snippets.slice(0, 8)
}

function extractDescriptionParagraphSnippet(html: string) {
  const paragraphs = Array.from(
    html.matchAll(/<p[^>]*class=["'][^"']*text-sm[^"']*text-foreground[^"']*["'][^>]*>[\s\S]*?<\/p>/gi)
  )
    .map((match) => normalizeWhitespace(match[0] ?? ''))
    .filter(Boolean)

  return paragraphs.at(-1) ?? null
}

function extractHtmlButtonHashtags(html: string) {
  const hashtagsFromTitles = Array.from(
    html.matchAll(/title=["']Add\s+(?:&quot;|")?(#?[a-z0-9_-]+)(?:&quot;|")?\s+to\s+search["']/gi)
  ).map((match) => match[1] ?? '')

  const hashtagsFromButtons = Array.from(
    html.matchAll(/<button[^>]*>[\s\S]*?<span>(#[a-z0-9_-]+)<\/span>[\s\S]*?<\/button>/gi)
  ).map((match) => match[1] ?? '')

  // Zusaetzliche Patterns fuer OutlierDB Hashtag-Buttons
  const hashtagsFromDataAttributes = Array.from(
    html.matchAll(/data-hashtag=["']([^"']+)["']/gi)
  ).map((match) => match[1] ?? '')

  const hashtagsFromJsonLike = Array.from(
    html.matchAll(/"tag"\s*:\s*"(#[a-z0-9_-]+)"/gi)
  ).map((match) => match[1] ?? '')

  // Suche nach Hashtags in URL-Parametern (z.B. ?hashtag=#nogi)
  const hashtagsFromUrls = Array.from(
    html.matchAll(/[?&]hashtag=([^&\s"']+)/gi)
  ).map((match) => decodeURIComponent(match[1] ?? ''))

  return normalizeHashtags([
    ...hashtagsFromTitles,
    ...hashtagsFromButtons,
    ...hashtagsFromDataAttributes,
    ...hashtagsFromJsonLike,
    ...hashtagsFromUrls
  ])
}

function stripHtmlTags(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
  )
}

function decodeEscapedJsonString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string
  } catch {
    return value
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\\//g, '/')
  }
}

function isGenericOutlierDescription(value: string | null) {
  if (!value) return true

  const normalized = value.toLowerCase()
  // Nur sehr spezifische Marketing-Texte als "generisch" markieren
  // NICHT einfach alle Texte mit "outlierdb" ausschliessen
  return (
    normalized.includes('your gateway to advance brazilian jiu jitsu analytics') ||
    normalized.includes('discover professional match analysis') ||
    normalized === 'outlierdb' ||
    normalized === 'outlier db' ||
    normalized.length < 24
  )
}

function normalizeMeaningfulSummary(value: string | null) {
  if (!value) return null
  const normalized = normalizeWhitespace(value)
  if (!normalized || isGenericOutlierDescription(normalized)) {
    return null
  }
  return truncateText(normalized, MAX_SUMMARY_LENGTH)
}

function extractMeaningfulTextCandidate(value: unknown) {
  const candidates: string[] = []
  walkUnknown(value, (text) => {
    const normalized = normalizeWhitespace(text)
    if (!normalized) return
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) return
    if (isGenericOutlierDescription(normalized)) return
    candidates.push(normalized)
  })

  return candidates.sort((a, b) => b.length - a.length)[0] ?? null
}

function extractJsonLikeBlocksFromHtml(html: string) {
  const candidates = new Set<string>()
  const scriptMatches = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))

  for (const match of scriptMatches) {
    const content = match[1]?.trim()
    if (!content) continue

    if (content.startsWith('{') || content.startsWith('[')) {
      candidates.add(content)
      continue
    }

    const jsonObject = content.match(/\{[\s\S]*\}/)?.[0]
    if (jsonObject) {
      candidates.add(jsonObject)
    }

    const jsonArray = content.match(/\[[\s\S]*\]/)?.[0]
    if (jsonArray) {
      candidates.add(jsonArray)
    }
  }

  return Array.from(candidates)
}

function extractStructuredSequenceDataFromUnknown(value: unknown) {
  const candidates: Array<{
    note: string | null
    hashtags: string[]
    videoUrl: string | null
    timestamp: number | null
    title: string | null
  }> = []

  const visit = (entry: unknown) => {
    if (!entry) return

    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }

    if (typeof entry !== 'object') {
      return
    }

    const record = entry as Record<string, unknown>
    const note =
      typeof record.note === 'string'
        ? normalizeWhitespace(record.note)
        : typeof record.summary === 'string'
          ? normalizeWhitespace(record.summary)
          : typeof record.description === 'string'
            ? normalizeWhitespace(record.description)
            : null
    const hashtags = normalizeHashtags(
      Array.isArray(record.hashtags)
        ? record.hashtags.flatMap((hashtag) => {
            if (typeof hashtag === 'string') return [hashtag]
            if (hashtag && typeof hashtag === 'object') {
              // OutlierDB format: { _id: string, tag: string }
              const tagValue = (hashtag as { tag?: unknown }).tag
              if (typeof tagValue === 'string') return [tagValue]
              // Alternative format: { tag: string }
              const altTag = (hashtag as Record<string, unknown>)['tag']
              if (typeof altTag === 'string') return [altTag]
            }
            return []
          })
        : []
    )
    const videoCandidate =
      typeof record.videoURL === 'string'
        ? record.videoURL
        : typeof record.videoUrl === 'string'
          ? record.videoUrl
          : typeof record.youtubeUrl === 'string'
            ? record.youtubeUrl
            : null
    const videoUrl = videoCandidate ? extractYoutubeUrl(videoCandidate) ?? videoCandidate : null
    const timestamp =
      typeof record.startingTimestamp === 'number'
        ? record.startingTimestamp
        : typeof record.timestamp === 'number'
          ? record.timestamp
          : null
    const title =
      typeof record.title === 'string'
        ? normalizeWhitespace(record.title)
        : typeof record.name === 'string'
          ? normalizeWhitespace(record.name)
          : null

    if (note || hashtags.length > 0 || videoUrl || timestamp !== null || title) {
      candidates.push({ note, hashtags, videoUrl, timestamp, title })
    }

    Object.values(record).forEach(visit)
  }

  visit(value)

  return candidates.sort((a, b) => {
    const score = (candidate: (typeof candidates)[number]) =>
      (candidate.note ? 4 : 0) +
      (candidate.hashtags.length > 0 ? 3 : 0) +
      (candidate.videoUrl ? 2 : 0) +
      (candidate.timestamp !== null ? 1 : 0)
    return score(b) - score(a)
  })[0] ?? null
}

function extractStructuredSequenceDataFromHtml(html: string) {
  const parsedBlocks = extractJsonLikeBlocksFromHtml(html)
    .map((block) => tryParseJsonObject(block) ?? (block.trim().startsWith('[') ? (() => {
      try {
        return JSON.parse(block) as unknown
      } catch {
        return null
      }
    })() : null))
    .filter((entry): entry is unknown => entry !== null)

  const bestStructured = parsedBlocks
    .map((block) => extractStructuredSequenceDataFromUnknown(block))
    .filter((entry): entry is NonNullable<ReturnType<typeof extractStructuredSequenceDataFromUnknown>> => entry !== null)
    .sort((a, b) => {
      const score = (candidate: NonNullable<ReturnType<typeof extractStructuredSequenceDataFromUnknown>>) =>
        (candidate.note ? 4 : 0) +
        (candidate.hashtags.length > 0 ? 3 : 0) +
        (candidate.videoUrl ? 2 : 0) +
        (candidate.timestamp !== null ? 1 : 0)
      return score(b) - score(a)
    })[0] ?? null

  // Versuche "note" aus verschiedenen Quellen zu extrahieren
  // 1. Aus JSON-escaped strings im HTML
  const noteMatchJson = html.match(/"note"\s*:\s*"((?:\\.|[^"])*)"/i)?.[1]
  // 2. Aus meta tags
  const noteMatchMeta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
                        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
  // 3. Aus dem Text direkt nach "note": im HTML body
  const noteMatchBody = html.match(/"note"\s*:\s*"([^"\\]+(?:\\.[^"\\]+)*)"/)?.[1]
  
  const noteFromJson = noteMatchJson ? decodeEscapedJsonString(noteMatchJson) : null
  const noteFromBody = noteMatchBody ? noteMatchBody.replace(/\\"/g, '"').replace(/\\n/g, ' ').trim() : null
  const noteSummary = normalizeWhitespace(noteFromJson ?? noteFromBody ?? noteMatchMeta ?? '')
  
  const visibleSummary = extractDescriptionFromHtml(html)

  // Hashtags aus verschiedenen Quellen extrahieren
  // 1. Aus JSON "tag" Feldern
  const hashtagMatches = Array.from(html.matchAll(/"tag"\s*:\s*"((?:\\.|[^"])*)"/gi)).map((match) =>
    decodeEscapedJsonString(match[1] ?? '')
  )
  // 2. Aus Array-Format: [{"tag": "#value"}, ...]
  const hashtagArrayMatches = Array.from(html.matchAll(/"tag"\s*:\s*"(#[a-z0-9_-]+)"/gi)).map((match) => match[1] ?? '')
  const htmlButtonHashtags = extractHtmlButtonHashtags(html)
  const hashtags = normalizeHashtags([
    ...(bestStructured?.hashtags ?? []),
    ...hashtagMatches,
    ...hashtagArrayMatches,
    ...htmlButtonHashtags,
  ])

  const timestampMatch = html.match(/"startingTimestamp"\s*:\s*(\d+)/i)?.[1]
  const timestamp = bestStructured?.timestamp ?? (timestampMatch ? Number(timestampMatch) : null)

  const videoCandidate =
    html.match(/"(?:videoURL|videoUrl|youtubeUrl|embedUrl|contentUrl|playbackUrl)"\s*:\s*"((?:\\.|[^"])*)"/i)?.[1] ?? null
  const decodedVideoCandidate = videoCandidate ? decodeEscapedJsonString(videoCandidate) : null
  const videoUrl =
    bestStructured?.videoUrl ??
    (decodedVideoCandidate ? extractYoutubeUrl(decodedVideoCandidate) ?? decodedVideoCandidate : null) ??
    extractYoutubeUrlFromHtml(html)
  const titleMatch = html.match(/"title"\s*:\s*"((?:\\.|[^"])*)"/i)?.[1] ?? null
  const iframeTitle = html.match(/<iframe[^>]+title=["']([^"']+)["']/i)?.[1] ?? null
  const title =
    bestStructured?.title ??
    (titleMatch
      ? normalizeWhitespace(decodeEscapedJsonString(titleMatch))
      : iframeTitle
        ? normalizeWhitespace(iframeTitle)
        : null)

  const summary = normalizeMeaningfulSummary(bestStructured?.note) ??
    normalizeMeaningfulSummary(noteSummary) ??
    normalizeMeaningfulSummary(visibleSummary)

  if (!summary && hashtags.length === 0 && !videoUrl && timestamp === null && !title) {
    return null
  }

  return {
    note: summary,
    hashtags,
    videoUrl,
    timestamp,
    title,
  }
}

function tryParseJsonObject(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseSseLikePayload(text: string) {
  const trimmed = text.trim()
  const directJson = tryParseJsonObject(trimmed)
  if (directJson) return directJson

  const dataLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')

  const parsedChunks = dataLines
    .map((chunk) => tryParseJsonObject(chunk))
    .filter((chunk): chunk is Record<string, unknown> => Boolean(chunk))

  if (parsedChunks.length > 0) {
    const mergedText = parsedChunks
      .map((chunk) =>
        [chunk.delta, chunk.text, chunk.message, chunk.content]
          .filter((value): value is string => typeof value === 'string')
          .join('')
      )
      .join('')
      .trim()

    const finalChunk = [...parsedChunks].reverse().find((chunk) => {
      const maybeDone = chunk.done
      const maybeCitations = chunk.citations
      return maybeDone === true || Array.isArray(maybeCitations)
    })

    return {
      chunks: parsedChunks,
      text: (mergedText || trimmed).trim(),
      finalChunk: finalChunk ?? null,
    }
  }

  return {
    text: trimmed,
  }
}

function getChatSupports(payload: unknown) {
  if (!payload || typeof payload !== 'object') return []

  const maybeRecord = payload as Record<string, unknown>
  const rootSupports = Array.isArray(maybeRecord.supports) ? maybeRecord.supports : []
  const finalChunk =
    maybeRecord.finalChunk && typeof maybeRecord.finalChunk === 'object'
      ? (maybeRecord.finalChunk as Record<string, unknown>)
      : null
  const finalSupports = Array.isArray(finalChunk?.supports) ? finalChunk.supports : []

  return [...rootSupports, ...finalSupports].filter((entry): entry is ParsedChatSupport => Boolean(entry && typeof entry === 'object'))
}

function cleanSectionText(value: string) {
  return truncatePreservingWhitespace(value.replace(/\n{3,}/g, '\n\n').trim(), MAX_SUMMARY_LENGTH) || null
}

function parseAiSectionsFromText(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  const matches = Array.from(normalized.matchAll(/^#{2,3}\s+(.+)$/gm))

  if (matches.length === 0) {
    return [
      {
        sectionKey: 'overview',
        sectionTitle: 'Overview',
        sectionOrder: 0,
        startIndex: 0,
        endIndex: normalized.length,
        sectionSummary: cleanSectionText(normalized),
      },
    ]
  }

  const sections: Array<{
    sectionKey: string
    sectionTitle: string
    sectionOrder: number
    startIndex: number
    endIndex: number
    sectionSummary: string | null
  }> = []

  if (matches[0].index > 0) {
    const introText = normalized.slice(0, matches[0].index).trim()
    if (introText) {
      sections.push({
        sectionKey: 'overview',
        sectionTitle: 'Overview',
        sectionOrder: 0,
        startIndex: 0,
        endIndex: matches[0].index,
        sectionSummary: cleanSectionText(introText),
      })
    }
  }

  matches.forEach((match, index) => {
    const title = match[1]?.trim() || `Section ${index + 1}`
    const sectionStart = match.index ?? 0
    const sectionEnd = index < matches.length - 1 ? (matches[index + 1].index ?? normalized.length) : normalized.length
    const sectionBody = normalized.slice(sectionStart, sectionEnd).trim()

    sections.push({
      sectionKey: slugifySectionKey(title),
      sectionTitle: title,
      sectionOrder: sections.length,
      startIndex: sectionStart,
      endIndex: sectionEnd,
      sectionSummary: cleanSectionText(sectionBody.replace(/^#{2,3}\s+.+$/m, '').trim()),
    })
  })

  return sections
}

function addSourceToSection(
  section: {
    sourceUrls: string[]
    sourceOrderByUrl: Record<string, number>
    evidenceTextByUrl: Record<string, string | null>
  },
  sourceUrl: string,
  orderIndex: number,
  evidenceText: string | null
) {
  if (!section.sourceUrls.includes(sourceUrl)) {
    section.sourceUrls.push(sourceUrl)
  }

  if (!(sourceUrl in section.sourceOrderByUrl)) {
    section.sourceOrderByUrl[sourceUrl] = orderIndex
  } else {
    section.sourceOrderByUrl[sourceUrl] = Math.min(section.sourceOrderByUrl[sourceUrl] ?? orderIndex, orderIndex)
  }

  if (evidenceText && !section.evidenceTextByUrl[sourceUrl]) {
    section.evidenceTextByUrl[sourceUrl] = truncatePreservingWhitespace(evidenceText, 700)
  }
}

function extractContextAroundOffset(text: string, offset: number) {
  if (!text.trim()) return null

  const start = Math.max(
    text.lastIndexOf('\n\n', offset),
    text.lastIndexOf('\n- ', offset),
    text.lastIndexOf('\n* ', offset),
    text.lastIndexOf('\n### ', offset),
    text.lastIndexOf('\n## ', offset)
  )
  const nextCandidates = [
    text.indexOf('\n\n', offset),
    text.indexOf('\n- ', offset + 1),
    text.indexOf('\n* ', offset + 1),
    text.indexOf('\n### ', offset + 1),
    text.indexOf('\n## ', offset + 1),
  ].filter((value) => value >= 0)
  const end = nextCandidates.length > 0 ? Math.min(...nextCandidates) : text.length
  const excerpt = text.slice(start >= 0 ? start : 0, end).trim()

  return excerpt ? truncatePreservingWhitespace(excerpt, 700) : null
}

function buildAiRunSections(
  payload: unknown,
  sourceUrlByCitationKey: Map<string, string>,
  textLinks: ParsedChatLink[] = [],
  sourceUrlByLinkKey: Map<string, string> = new Map()
) {
  const compactPayload = compactChatPayload(payload)
  const rawText = typeof compactPayload.text === 'string' ? compactPayload.text : ''
  if (!rawText.trim()) return []

  const sectionsFromText = parseAiSectionsFromText(rawText)
  const citations = compactPayload.citations
  const supports = getChatSupports(payload)
  const assignedSourceUrls = new Set<string>()

  const sectionAccumulator = sectionsFromText.map((section) => ({
    ...section,
    sourceUrls: [] as string[],
    sourceOrderByUrl: {} as Record<string, number>,
    evidenceTextByUrl: {} as Record<string, string | null>,
  }))

  const findSectionIndexForOffset = (offset: number) => {
    const idx = sectionAccumulator.findIndex((section) => offset >= section.startIndex && offset < section.endIndex)
    return idx >= 0 ? idx : 0
  }

  supports.forEach((support) => {
    const offset = typeof support.segment?.startIndex === 'number' ? support.segment.startIndex : 0
    const sectionIndex = findSectionIndexForOffset(offset)
    const section = sectionAccumulator[sectionIndex]

    ;(support.citationIndices ?? []).forEach((citationIndex, orderIndex) => {
      const citation = citations[citationIndex]
      const citationKey = citation?.id ?? citation?.deeplink ?? citation?.videoUrl ?? null
      if (!citationKey) return
      const sourceUrl = sourceUrlByCitationKey.get(citationKey)
      if (!sourceUrl) return
      assignedSourceUrls.add(sourceUrl)
      addSourceToSection(
        section,
        sourceUrl,
        orderIndex,
        support.segment?.text ? truncatePreservingWhitespace(support.segment.text, 700) : extractContextAroundOffset(rawText, offset)
      )
    })
  })

  citations.forEach((citation, citationIndex) => {
    const citationKey = citation?.id ?? citation?.deeplink ?? citation?.videoUrl ?? null
    if (!citationKey) return
    const sourceUrl = sourceUrlByCitationKey.get(citationKey)
    if (!sourceUrl || assignedSourceUrls.has(sourceUrl)) return

    const searchCandidates = [citation.deeplink, citation.title].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    let foundOffset = -1

    for (const candidate of searchCandidates) {
      foundOffset = rawText.indexOf(candidate)
      if (foundOffset >= 0) break
    }

    const sectionIndex = foundOffset >= 0 ? findSectionIndexForOffset(foundOffset) : 0
    const section = sectionAccumulator[sectionIndex]
    assignedSourceUrls.add(sourceUrl)
    addSourceToSection(section, sourceUrl, citationIndex, extractContextAroundOffset(rawText, foundOffset >= 0 ? foundOffset : section.startIndex))
  })

  textLinks.forEach((link, orderIndex) => {
    const sourceUrl = sourceUrlByLinkKey.get(link.deeplink)
    if (!sourceUrl || assignedSourceUrls.has(sourceUrl)) return

    const sectionIndex = findSectionIndexForOffset(link.index)
    const section = sectionAccumulator[sectionIndex]
    assignedSourceUrls.add(sourceUrl)
    addSourceToSection(section, sourceUrl, orderIndex, extractContextAroundOffset(rawText, link.index))
  })

  sourceUrlByCitationKey.forEach((sourceUrl) => {
    if (assignedSourceUrls.has(sourceUrl)) return
    const fallbackSection = sectionAccumulator[0]
    addSourceToSection(fallbackSection, sourceUrl, fallbackSection.sourceUrls.length, fallbackSection.sectionSummary)
  })

  return sectionAccumulator
    .filter((section) => section.sourceUrls.length > 0 || section.sectionSummary)
    .map((section, index) => ({
      sectionKey: section.sectionKey,
      sectionTitle: section.sectionTitle,
      sectionOrder: index,
      sectionSummary: section.sectionSummary,
      sourceUrls: section.sourceUrls,
      sourceOrderByUrl: section.sourceOrderByUrl,
      evidenceTextByUrl: section.evidenceTextByUrl,
    }))
}

function buildAiRunSectionsFromTextLinks(rawText: string, links: ParsedChatLink[], sourceUrlByLinkKey: Map<string, string>) {
  if (!rawText.trim()) return []

  const sectionAccumulator = parseAiSectionsFromText(rawText).map((section) => ({
    ...section,
    sourceUrls: [] as string[],
    sourceOrderByUrl: {} as Record<string, number>,
    evidenceTextByUrl: {} as Record<string, string | null>,
  }))

  const findSectionIndexForOffset = (offset: number) => {
    const idx = sectionAccumulator.findIndex((section) => offset >= section.startIndex && offset < section.endIndex)
    return idx >= 0 ? idx : 0
  }

  links.forEach((link, orderIndex) => {
    const sourceUrl = sourceUrlByLinkKey.get(link.deeplink)
    if (!sourceUrl) return

    const sectionIndex = findSectionIndexForOffset(link.index)
    const section = sectionAccumulator[sectionIndex]
    addSourceToSection(section, sourceUrl, orderIndex, extractContextAroundOffset(rawText, link.index))
  })

  return sectionAccumulator
    .filter((section) => section.sourceUrls.length > 0 || section.sectionSummary)
    .map((section, index) => ({
      sectionKey: section.sectionKey,
      sectionTitle: section.sectionTitle,
      sectionOrder: index,
      sectionSummary: section.sectionSummary,
      sourceUrls: section.sourceUrls,
      sourceOrderByUrl: section.sourceOrderByUrl,
      evidenceTextByUrl: section.evidenceTextByUrl,
    }))
}

function collectChatCitations(value: unknown, citations: Map<string, ParsedChatCitation>) {
  if (!value) return

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectChatCitations(entry, citations)
    }
    return
  }

  if (typeof value !== 'object') {
    return
  }

  const maybeRecord = value as Record<string, unknown>
  const citationGroups = [maybeRecord.citations, maybeRecord.unusedCitations]
  for (const maybeCitations of citationGroups) {
    if (!Array.isArray(maybeCitations)) continue

    for (const entry of maybeCitations) {
      if (!entry || typeof entry !== 'object') continue
      const citation = entry as ParsedChatCitation
      const key = citation.id ?? citation.deeplink ?? citation.videoUrl ?? Math.random().toString(36)
      citations.set(key, citation)
    }
  }

  for (const entry of Object.values(maybeRecord)) {
    collectChatCitations(entry, citations)
  }
}

function extractChatCitations(payload: unknown): ParsedChatCitation[] {
  const citations = new Map<string, ParsedChatCitation>()
  collectChatCitations(payload, citations)
  return Array.from(citations.values())
}

function compactChatPayload(payload: unknown) {
  const bestText = extractBestTextCandidate(payload)
  const citations = extractChatCitations(payload)
  const maybeRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const finalChunk =
    maybeRecord.finalChunk && typeof maybeRecord.finalChunk === 'object'
      ? (maybeRecord.finalChunk as Record<string, unknown>)
      : null

  return {
    text:
      typeof maybeRecord.text === 'string'
        ? truncateText(maybeRecord.text, MAX_CHAT_TEXT_LENGTH)
        : bestText
          ? truncateText(bestText, MAX_CHAT_TEXT_LENGTH)
          : null,
    threadId: typeof finalChunk?.threadId === 'string' ? finalChunk.threadId : null,
    title: typeof finalChunk?.title === 'string' ? truncateText(finalChunk.title, MAX_TITLE_LENGTH) : null,
    grounding: finalChunk?.grounding ?? null,
    citations,
    supports: Array.isArray(finalChunk?.supports)
      ? finalChunk.supports
          .filter((entry): entry is ParsedChatSupport => Boolean(entry && typeof entry === 'object'))
          .slice(0, 100)
      : [],
    chunkCount: Array.isArray(maybeRecord.chunks) ? maybeRecord.chunks.length : 0,
  }
}

function buildOutlierDeeplinkUrl(deeplink?: string) {
  if (!deeplink) return null
  if (deeplink.startsWith('http://') || deeplink.startsWith('https://')) return deeplink
  if (deeplink.startsWith('/')) return `https://outlierdb.com${deeplink}`
  return `https://outlierdb.com/${deeplink}`
}

function extractSequenceIdFromCitation(citation: ParsedChatCitation) {
  if (citation.id?.trim()) {
    return citation.id.trim()
  }

  const deeplink = citation.deeplink?.trim()
  if (!deeplink) {
    return null
  }

  const sequenceMatch = deeplink.match(/\/sequences\/([a-zA-Z0-9]+)(?:\?|$)/)
  if (sequenceMatch?.[1]) {
    return sequenceMatch[1]
  }

  return null
}

function buildOutlierSequenceApiUrl(citation: ParsedChatCitation) {
  const sequenceId = extractSequenceIdFromCitation(citation)
  return sequenceId ? `${OUTLIERDB_SEQUENCE_API_BASE_URL}/${sequenceId}` : null
}

function buildChatImportRecord({
  query,
  candidateUrl,
  videoUrl,
  timestampSeconds,
  text,
  hashtags,
  rawPayload,
}: {
  query: string
  candidateUrl: string
  videoUrl: string | null
  timestampSeconds?: number | null
  text: string | null
  hashtags: string[]
  rawPayload: Record<string, unknown>
}): ParsedOutlierSequence {
  const summary = text ? normalizeWhitespace(text) : null
  const title = buildTitleFromText(summary ?? '', hashtags.length > 0 ? hashtags.slice(0, 3).join(' ') : query)

  return {
    provider: EXTERNAL_SOURCE_PROVIDER,
    source_url: canonicalizeSourceUrl(candidateUrl, query),
    source_type: 'sequence',
    title,
    video_url: appendTimestampToVideoUrl(videoUrl, timestampSeconds),
    video_platform: detectVideoPlatform(videoUrl),
    video_format: detectVideoFormat(videoUrl),
    timestamp_label: formatSeconds(timestampSeconds),
    timestamp_seconds: typeof timestampSeconds === 'number' ? timestampSeconds : null,
    hashtags,
    summary: summary ? truncateText(summary, MAX_SUMMARY_LENGTH) : null,
    search_query: truncateText(query, MAX_QUERY_LENGTH),
    raw_payload: rawPayload,
  }
}

async function resolveChatLinksIntoSources(message: string, authToken: string, payload: unknown) {
  const citations = extractChatCitations(payload)
  const compactPayload = compactChatPayload(payload)
  const rawText = typeof compactPayload.text === 'string' ? compactPayload.text : ''
  const relativeLinks = rawText ? extractRelativeOutlierLinksFromText(rawText) : []
  if (citations.length > 0) {
    const importedFromCitations: ParsedOutlierSequence[] = []
    const seen = new Set<string>()
    const sourceUrlByCitationKey = new Map<string, string>()
    const sourceUrlByLinkKey = new Map<string, string>()
    const linkBackedCitations = relativeLinks
      .filter((link) => !citations.some((citation) => citation.deeplink === link.deeplink))
      .map((link): ParsedChatCitation => ({
        deeplink: link.deeplink,
        title: link.title ?? undefined,
      }))

    for (const citation of [...citations, ...linkBackedCitations]) {
      const sourceUrl = canonicalizeSourceUrl(
        buildOutlierDeeplinkUrl(citation.deeplink) ?? citation.videoUrl ?? `outlierdb:citation:${citation.id ?? citation.title ?? message}`,
        citation.id ?? citation.title ?? message
      )
      const citationKey = citation.id ?? citation.deeplink ?? citation.videoUrl
      if (seen.has(sourceUrl)) {
        if (citationKey) {
          sourceUrlByCitationKey.set(citationKey, sourceUrl)
        }
        if (citation.deeplink) {
          sourceUrlByLinkKey.set(citation.deeplink, sourceUrl)
        }
        continue
      }
      seen.add(sourceUrl)
      if (citationKey) {
        sourceUrlByCitationKey.set(citationKey, sourceUrl)
      }
      if (citation.deeplink) {
        sourceUrlByLinkKey.set(citation.deeplink, sourceUrl)
      }

      const resolvedDeeplink = buildOutlierDeeplinkUrl(citation.deeplink)
      const resolvedSequenceApiUrl = buildOutlierSequenceApiUrl(citation)
      let resolvedSummary: string | null = null
      let resolvedHashtags: string[] = []
      let resolvedVideoUrl = citation.videoUrl?.trim() || null
      let resolvedTimestamp = typeof citation.timestamp === 'number' ? citation.timestamp : null
      let resolvedTitle = citation.title?.trim() || null
      let linkedResourcePayload: unknown = null
      let debugPayload: Record<string, unknown> | null = null

      if (resolvedSequenceApiUrl) {
        try {
          const fetched = await fetchAsJsonOrText(resolvedSequenceApiUrl, authToken)
          linkedResourcePayload = fetched.data

          const structured =
            fetched.kind === 'text'
              ? extractStructuredSequenceDataFromHtml(fetched.data)
              : extractStructuredSequenceDataFromUnknown(fetched.data)
          const urlCandidates = fetched.kind === 'text' ? [] : extractUrlsFromUnknown(fetched.data)
          resolvedSummary = structured?.note ?? null
          resolvedHashtags = structured?.hashtags?.length ? structured.hashtags : []
          resolvedVideoUrl = structured?.videoUrl ?? urlCandidates.find((url) => Boolean(extractYoutubeUrl(url))) ?? resolvedVideoUrl
          resolvedTimestamp = structured?.timestamp ?? resolvedTimestamp
          resolvedTitle = structured?.title ?? resolvedTitle
          debugPayload = {
            resolved_deeplink: resolvedDeeplink,
            resolved_sequence_api_url: resolvedSequenceApiUrl,
            fetch_kind: fetched.kind,
            field_sources: {
              video_url: structured?.videoUrl ? 'structured_json' : 'fallback_none',
              hashtags: resolvedHashtags.length > 0 ? 'structured_json' : 'fallback_none',
              summary: structured?.note ? 'structured_json' : 'fallback_none',
              title: structured?.title ? 'structured_json' : 'fallback_none',
            },
            html_snippets: {
              iframe: null,
              hashtag_buttons: [],
              description_paragraph: null,
            },
          }
        } catch {
          linkedResourcePayload = null
        }
      }

      if (resolvedDeeplink && (!resolvedSummary || resolvedHashtags.length === 0 || !resolvedVideoUrl)) {
        try {
          const fetched = await fetchAsJsonOrText(resolvedDeeplink, authToken)
          const fetchedHtml = fetched.kind === 'text' ? fetched.data : null

          if (fetchedHtml) {
            const structured = extractStructuredSequenceDataFromHtml(fetchedHtml)
            const extractedDescription = extractDescriptionFromHtml(fetchedHtml)
            const iframeSnippet = extractIframeHtmlSnippet(fetchedHtml)
            const hashtagButtonSnippets = extractHashtagButtonSnippets(fetchedHtml)
            const descriptionParagraphSnippet = extractDescriptionParagraphSnippet(fetchedHtml)

            resolvedSummary =
              normalizeMeaningfulSummary(resolvedSummary) ??
              structured?.note ??
              (!isGenericOutlierDescription(extractedDescription) ? extractedDescription : null) ??
              null
            resolvedHashtags = resolvedHashtags.length > 0 ? resolvedHashtags : structured?.hashtags?.length ? structured.hashtags : []
            resolvedVideoUrl = resolvedVideoUrl ?? structured?.videoUrl ?? extractYoutubeUrlFromHtml(fetchedHtml) ?? null
            resolvedTimestamp = structured?.timestamp ?? resolvedTimestamp
            resolvedTitle = resolvedTitle ?? structured?.title ?? extractTitleFromHtml(fetchedHtml) ?? null

            debugPayload = {
              ...(debugPayload ?? {}),
              resolved_deeplink: resolvedDeeplink,
              resolved_sequence_api_url: resolvedSequenceApiUrl,
              html_fetch_kind: fetched.kind,
              field_sources: {
                video_url: resolvedVideoUrl
                  ? debugPayload?.field_sources && typeof debugPayload.field_sources === 'object' && (debugPayload.field_sources as Record<string, unknown>).video_url !== 'fallback_none'
                    ? (debugPayload.field_sources as Record<string, unknown>).video_url
                    : structured?.videoUrl
                      ? 'structured_html'
                      : iframeSnippet
                        ? 'iframe'
                        : 'fallback_none'
                  : 'fallback_none',
                hashtags:
                  resolvedHashtags.length > 0
                    ? debugPayload?.field_sources && typeof debugPayload.field_sources === 'object' && (debugPayload.field_sources as Record<string, unknown>).hashtags !== 'fallback_none'
                      ? (debugPayload.field_sources as Record<string, unknown>).hashtags
                      : structured?.hashtags?.length
                        ? 'structured_html'
                        : hashtagButtonSnippets.length > 0
                          ? 'hashtag_buttons'
                          : 'fallback_none'
                    : 'fallback_none',
                summary:
                  resolvedSummary
                    ? debugPayload?.field_sources && typeof debugPayload.field_sources === 'object' && (debugPayload.field_sources as Record<string, unknown>).summary !== 'fallback_none'
                      ? (debugPayload.field_sources as Record<string, unknown>).summary
                      : structured?.note
                        ? 'structured_html'
                        : extractedDescription && !isGenericOutlierDescription(extractedDescription)
                          ? 'paragraph'
                          : 'fallback_none'
                    : 'fallback_none',
                title:
                  resolvedTitle
                    ? debugPayload?.field_sources && typeof debugPayload.field_sources === 'object' && (debugPayload.field_sources as Record<string, unknown>).title !== 'fallback_none'
                      ? (debugPayload.field_sources as Record<string, unknown>).title
                      : structured?.title
                        ? 'structured_html'
                        : extractTitleFromHtml(fetchedHtml)
                          ? 'html_title'
                          : 'fallback_none'
                    : 'fallback_none',
              },
              html_snippets: {
                iframe: iframeSnippet,
                hashtag_buttons: hashtagButtonSnippets,
                description_paragraph: descriptionParagraphSnippet,
              },
            }
          }
        } catch {
          debugPayload = {
            ...(debugPayload ?? {}),
            resolved_deeplink: resolvedDeeplink,
            resolved_sequence_api_url: resolvedSequenceApiUrl,
            html_fetch_kind: 'error',
            html_snippets: {
              iframe: null,
              hashtag_buttons: [],
              description_paragraph: null,
            },
          }
        }
      }

      if (!debugPayload) {
        debugPayload = {
          resolved_deeplink: resolvedDeeplink,
          resolved_sequence_api_url: resolvedSequenceApiUrl,
          fetch_kind: 'not_fetched',
          field_sources: {
            video_url: 'fallback_none',
            hashtags: 'fallback_none',
            summary: 'fallback_none',
            title: 'fallback_none',
          },
          html_snippets: {
            iframe: null,
            hashtag_buttons: [],
            description_paragraph: null,
          },
        }
      }

      resolvedSummary = normalizeMeaningfulSummary(resolvedSummary)
      resolvedVideoUrl = appendTimestampToVideoUrl(resolvedVideoUrl, resolvedTimestamp)

      importedFromCitations.push({
        provider: EXTERNAL_SOURCE_PROVIDER,
        source_url: sourceUrl,
        source_type: 'sequence',
        title: truncateText(resolvedTitle || citation.title?.trim() || `OutlierDB Citation ${citation.id ?? ''}`.trim(), MAX_TITLE_LENGTH),
        video_url: resolvedVideoUrl,
        video_platform: detectVideoPlatform(resolvedVideoUrl),
        video_format: detectVideoFormat(resolvedVideoUrl),
        timestamp_label: formatSeconds(resolvedTimestamp),
        timestamp_seconds: resolvedTimestamp,
        hashtags: resolvedHashtags,
        summary: resolvedSummary,
        search_query: truncateText(message, MAX_QUERY_LENGTH),
        raw_payload: {
          chat_response: compactPayload,
          citation,
          linked_resource: linkedResourcePayload
            ? {
                summary: resolvedSummary ? truncateText(normalizeWhitespace(resolvedSummary), MAX_SUMMARY_LENGTH) : null,
                hashtags: resolvedHashtags,
                video_url: resolvedVideoUrl,
              }
            : null,
          debug: debugPayload
            ? {
                ...debugPayload,
                extracted: {
                  video_url: resolvedVideoUrl,
                  hashtags: resolvedHashtags,
                  summary: resolvedSummary,
                  title: resolvedTitle,
                  timestamp_seconds: resolvedTimestamp,
                },
              }
            : null,
        },
      })
    }

    return {
      imported: importedFromCitations,
      failed: [],
      sections: buildAiRunSections(payload, sourceUrlByCitationKey, relativeLinks, sourceUrlByLinkKey),
    }
  }

  if (relativeLinks.length > 0) {
    const importedFromLinks: ParsedOutlierSequence[] = []
    const failed: ImportFailure[] = []
    const seen = new Set<string>()
    const sourceUrlByLinkKey = new Map<string, string>()

    for (const link of relativeLinks) {
      const resolvedDeeplink = buildOutlierDeeplinkUrl(link.deeplink)
      if (!resolvedDeeplink) continue

      const sourceUrl = canonicalizeSourceUrl(resolvedDeeplink, link.deeplink)
      if (seen.has(sourceUrl)) continue
      seen.add(sourceUrl)
      sourceUrlByLinkKey.set(link.deeplink, sourceUrl)

      const citationLike: ParsedChatCitation = {
        deeplink: link.deeplink,
        title: link.title ?? undefined,
      }
      const resolvedSequenceApiUrl = buildOutlierSequenceApiUrl(citationLike)

      let resolvedSummary: string | null = null
      let resolvedHashtags: string[] = []
      let resolvedVideoUrl: string | null = null
      let resolvedTimestamp: number | null = null
      let resolvedTitle = link.title
      let linkedResourcePayload: unknown = null
      let debugPayload: Record<string, unknown> | null = null

      if (resolvedSequenceApiUrl) {
        try {
          const fetched = await fetchAsJsonOrText(resolvedSequenceApiUrl, authToken)
          linkedResourcePayload = fetched.data

          const structured =
            fetched.kind === 'text'
              ? extractStructuredSequenceDataFromHtml(fetched.data)
              : extractStructuredSequenceDataFromUnknown(fetched.data)
          const urlCandidates = fetched.kind === 'text' ? [] : extractUrlsFromUnknown(fetched.data)
          resolvedSummary = structured?.note ?? null
          resolvedHashtags = structured?.hashtags?.length ? structured.hashtags : []
          resolvedVideoUrl = structured?.videoUrl ?? urlCandidates.find((url) => Boolean(extractYoutubeUrl(url))) ?? null
          resolvedTimestamp = structured?.timestamp ?? null
          resolvedTitle = structured?.title ?? resolvedTitle
          debugPayload = {
            resolved_deeplink: resolvedDeeplink,
            resolved_sequence_api_url: resolvedSequenceApiUrl,
            fetch_kind: fetched.kind,
            field_sources: {
              video_url: structured?.videoUrl ? 'structured_json' : 'fallback_none',
              hashtags: resolvedHashtags.length > 0 ? 'structured_json' : 'fallback_none',
              summary: structured?.note ? 'structured_json' : 'fallback_none',
              title: structured?.title ? 'structured_json' : 'fallback_none',
            },
            html_snippets: {
              iframe: null,
              hashtag_buttons: [],
              description_paragraph: null,
            },
          }
        } catch {
          linkedResourcePayload = null
        }
      }

      if (!resolvedSummary || resolvedHashtags.length === 0 || !resolvedVideoUrl) {
        try {
          const fetched = await fetchAsJsonOrText(resolvedDeeplink, authToken)
          const fetchedHtml = fetched.kind === 'text' ? fetched.data : null

          if (fetchedHtml) {
            const structured = extractStructuredSequenceDataFromHtml(fetchedHtml)
            const extractedDescription = extractDescriptionFromHtml(fetchedHtml)
            const iframeSnippet = extractIframeHtmlSnippet(fetchedHtml)
            const hashtagButtonSnippets = extractHashtagButtonSnippets(fetchedHtml)
            const descriptionParagraphSnippet = extractDescriptionParagraphSnippet(fetchedHtml)

            resolvedSummary =
              normalizeMeaningfulSummary(resolvedSummary) ??
              structured?.note ??
              (!isGenericOutlierDescription(extractedDescription) ? extractedDescription : null) ??
              null
            resolvedHashtags = resolvedHashtags.length > 0 ? resolvedHashtags : structured?.hashtags?.length ? structured.hashtags : []
            resolvedVideoUrl = resolvedVideoUrl ?? structured?.videoUrl ?? extractYoutubeUrlFromHtml(fetchedHtml) ?? null
            resolvedTimestamp = structured?.timestamp ?? resolvedTimestamp
            resolvedTitle = resolvedTitle ?? structured?.title ?? extractTitleFromHtml(fetchedHtml) ?? null

            debugPayload = {
              ...(debugPayload ?? {}),
              resolved_deeplink: resolvedDeeplink,
              resolved_sequence_api_url: resolvedSequenceApiUrl,
              html_fetch_kind: fetched.kind,
              field_sources: {
                video_url: resolvedVideoUrl
                  ? structured?.videoUrl
                    ? 'structured_html'
                    : iframeSnippet
                      ? 'iframe'
                      : 'fallback_none'
                  : 'fallback_none',
                hashtags: resolvedHashtags.length > 0
                  ? structured?.hashtags?.length
                    ? 'structured_html'
                    : hashtagButtonSnippets.length > 0
                      ? 'hashtag_buttons'
                      : 'fallback_none'
                  : 'fallback_none',
                summary: resolvedSummary
                  ? structured?.note
                    ? 'structured_html'
                    : extractedDescription && !isGenericOutlierDescription(extractedDescription)
                      ? 'paragraph'
                      : 'fallback_none'
                  : 'fallback_none',
                title: resolvedTitle
                  ? structured?.title
                    ? 'structured_html'
                    : extractTitleFromHtml(fetchedHtml)
                      ? 'html_title'
                      : 'fallback_none'
                  : 'fallback_none',
              },
              html_snippets: {
                iframe: iframeSnippet,
                hashtag_buttons: hashtagButtonSnippets,
                description_paragraph: descriptionParagraphSnippet,
              },
            }
          }
        } catch (error) {
          failed.push({
            url: resolvedDeeplink,
            reason: error instanceof Error ? error.message : 'Unknown linked resource error',
          })
        }
      }

      resolvedSummary = normalizeMeaningfulSummary(resolvedSummary)
      resolvedVideoUrl = appendTimestampToVideoUrl(resolvedVideoUrl, resolvedTimestamp)

      importedFromLinks.push({
        provider: EXTERNAL_SOURCE_PROVIDER,
        source_url: sourceUrl,
        source_type: 'sequence',
        title: truncateText(resolvedTitle || `OutlierDB Link ${link.deeplink}`, MAX_TITLE_LENGTH),
        video_url: resolvedVideoUrl,
        video_platform: detectVideoPlatform(resolvedVideoUrl),
        video_format: detectVideoFormat(resolvedVideoUrl),
        timestamp_label: formatSeconds(resolvedTimestamp),
        timestamp_seconds: resolvedTimestamp,
        hashtags: resolvedHashtags,
        summary: resolvedSummary,
        search_query: truncateText(message, MAX_QUERY_LENGTH),
        raw_payload: {
          chat_response: compactPayload,
          link,
          linked_resource: linkedResourcePayload
            ? {
                summary: resolvedSummary ? truncateText(normalizeWhitespace(resolvedSummary), MAX_SUMMARY_LENGTH) : null,
                hashtags: resolvedHashtags,
                video_url: resolvedVideoUrl,
              }
            : null,
          debug: debugPayload
            ? {
                ...debugPayload,
                extracted: {
                  video_url: resolvedVideoUrl,
                  hashtags: resolvedHashtags,
                  summary: resolvedSummary,
                  title: resolvedTitle,
                  timestamp_seconds: resolvedTimestamp,
                },
              }
            : null,
        },
      })
    }

    if (importedFromLinks.length > 0) {
      return {
        imported: importedFromLinks,
        failed,
        sections: buildAiRunSectionsFromTextLinks(rawText, relativeLinks, sourceUrlByLinkKey),
      }
    }
  }

  const candidateUrls = extractUrlsFromUnknown(payload)
  const imported: ParsedOutlierSequence[] = []
  const failed: ImportFailure[] = []
  const seen = new Set<string>()

  for (const candidateUrl of candidateUrls) {
    try {
      const fetched = await fetchAsJsonOrText(candidateUrl, authToken)

      const structured =
        fetched.kind === 'text'
          ? extractStructuredSequenceDataFromHtml(fetched.data)
          : extractStructuredSequenceDataFromUnknown(fetched.data)
      const text =
        fetched.kind === 'text'
          ? structured?.note ?? extractDescriptionFromHtml(fetched.data) ?? null
          : structured?.note ?? null
      const youtubeUrl =
        fetched.kind === 'text'
          ? appendTimestampToVideoUrl(structured?.videoUrl ?? extractYoutubeUrlFromHtml(fetched.data), structured?.timestamp ?? null)
          : appendTimestampToVideoUrl(
              structured?.videoUrl ?? extractUrlsFromUnknown(fetched.data).find((url) => Boolean(extractYoutubeUrl(url))) ?? null,
              structured?.timestamp ?? null
            )
      const title =
        fetched.kind === 'text'
          ? structured?.title ?? extractTitleFromHtml(fetched.data)
          : structured?.title ?? null
      const hashtags = structured?.hashtags?.length ? structured.hashtags : []

      const record = buildChatImportRecord({
        query: message,
        candidateUrl,
        videoUrl: youtubeUrl,
        timestampSeconds: structured?.timestamp ?? null,
        text,
        hashtags,
        rawPayload: {
          chat_response: compactPayload,
          linked_resource: fetched.data,
        },
      })

      if (seen.has(record.source_url)) {
        continue
      }

      seen.add(record.source_url)
      imported.push(record)
    } catch (error) {
      failed.push({
        url: candidateUrl,
        reason: error instanceof Error ? error.message : 'Unknown linked resource error',
      })
    }
  }

  if (imported.length === 0) {
    const bestText = extractBestTextCandidate(payload)
    imported.push(
      buildChatImportRecord({
        query: message,
        candidateUrl: `outlierdb:chat:${message}`,
        videoUrl: null,
        text: bestText ? truncateText(bestText, MAX_SUMMARY_LENGTH) : null,
        hashtags: [],
        rawPayload: {
          chat_response: compactPayload,
        },
      })
    )
  }

  return { imported, failed, sections: [] }
}

export async function importOutlierTagSearch({
  query,
  authToken,
  hashtags,
  page = 1,
  limit = 10,
}: {
  query: string
  authToken: string
  hashtags: string[]
  page?: number
  limit?: number
}): Promise<OutlierImportResult> {
  const normalizedHashtags = normalizeHashtags(hashtags).map((tag) => `#${tag}`)
  const requestPayload = {
    hashtags: normalizedHashtags,
    page,
    limit,
  }

  const response = await fetch(OUTLIERDB_SEARCH_URL, {
    method: 'POST',
    headers: buildAuthHeaders(authToken),
    body: JSON.stringify(requestPayload),
    cache: 'no-store',
  })

  const payload = (await response.json()) as OutlierSearchResponse

  if (!response.ok) {
    throw new Error(payload.error ?? `OutlierDB search failed with status ${response.status}`)
  }

  const groups = payload.results?.groups ?? []
  const imported: ParsedOutlierSequence[] = []
  const failed: ImportFailure[] = []
  const seenSourceUrls = new Set<string>()

  for (const group of groups) {
    for (const sequence of group.matchingSequences ?? []) {
      try {
        const entry = mapSequenceToImportRecord(sequence, query, group)

        if (seenSourceUrls.has(entry.source_url)) continue
        seenSourceUrls.add(entry.source_url)
        imported.push(entry)
      } catch (error) {
        failed.push({
          url: `outlierdb:sequence:${sequence._id}`,
          reason: error instanceof Error ? error.message : 'Unknown mapping error',
        })
      }
    }
  }

  return {
    mode: 'tag_search',
    query,
    hashtags: normalizedHashtags,
    page: payload.page,
    limit: payload.limit,
    hasMore: Boolean(payload.hasMore),
    groupCount: groups.length,
    imported,
    failed,
    sections: [],
    requestPayload,
    responsePayload: payload as unknown as Record<string, unknown>,
  }
}

export async function importOutlierAiChat({
  query,
  authToken,
}: {
  query: string
  authToken: string
}): Promise<OutlierImportResult> {
  const requestPayload = { message: query }
  const response = await fetch(OUTLIERDB_CHAT_URL, {
    method: 'POST',
    headers: buildAuthHeaders(authToken),
    body: JSON.stringify(requestPayload),
    cache: 'no-store',
  })

  const rawText = await response.text()
  const payload = parseSseLikePayload(rawText) as Record<string, unknown> & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? `OutlierDB chat failed with status ${response.status}`)
  }

  const { imported, failed, sections } = await resolveChatLinksIntoSources(query, authToken, payload)

  return {
    mode: 'ai_chat',
    query,
    hashtags: [],
    page: null,
    limit: null,
    hasMore: false,
    groupCount: 0,
    imported,
    failed,
    sections,
    requestPayload,
    responsePayload: compactChatPayload(payload),
  }
}
