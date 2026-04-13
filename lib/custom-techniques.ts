import type { StageKey } from '@/lib/gameplans'
import { normalizeHashtags } from '@/lib/external-technique-sources'
import {
  coverageIncludesStyle,
  normalizeTechniqueStyleCoverage,
  type TechniqueStyle,
  type TechniqueStyleCoverage,
} from '@/lib/technique-style'
import { normalizeClipContentType, normalizeClipLearningPhase, type ClipContentType, type ClipLearningPhase } from '@/lib/clip-taxonomy'

export type TechniqueVideo = {
  id: string
  title: string
  url: string
  platform: 'youtube' | 'instagram' | 'other'
  videoType: TechniqueVideoType
  contentType?: ClipContentType
  learningPhase?: ClipLearningPhase
  targetArchetypeIds?: string[]
  description?: string
  hashtags?: string[]
  timestamp?: string
}

export type TechniqueVideoType = 'youtube' | 'youtube_short' | 'instagram_reel' | 'tiktok'

export type TechniqueTaggedNote = {
  id: string
  text: string
  styleCoverage: TechniqueStyleCoverage
}

export type TechniqueCounter = {
  id: string
  title: string
  description: string
  videoUrl?: string
  styleCoverage?: TechniqueStyleCoverage
}

export type TechniqueDrill = {
  id: string
  title: string
  description: string
  duration?: string
  repetitions?: number
  styleCoverage?: TechniqueStyleCoverage
}

export type TechniqueStyleContent = {
  description?: string
  videos?: TechniqueVideo[]
  counters?: TechniqueCounter[]
  drills?: TechniqueDrill[]
  keyPoints?: TechniqueTaggedNote[]
  commonErrors?: TechniqueTaggedNote[]
}

export type TechniqueStyleOverrides = Partial<Record<TechniqueStyle, TechniqueStyleContent>>

export type CustomTechniqueRecord = {
  id: string
  title: string
  subtitle: string
  description: string
  image: string
  stage: StageKey
  track: 'foundation' | 'secondary' | 'top-game'
  creator: string
  fighter: string
  level: number
  // Erweiterte Felder
  videos: TechniqueVideo[]
  counters: TechniqueCounter[]
  drills: TechniqueDrill[]
  keyPoints: TechniqueTaggedNote[]
  commonErrors: TechniqueTaggedNote[]
  prerequisites: string[]
  recommendedArchetypeIds: string[]
  styleCoverage: TechniqueStyleCoverage
  styleOverrides?: TechniqueStyleOverrides
  createdAt: string
  updatedAt: string
}

export const CUSTOM_TECHNIQUES_STORAGE_KEY = 'bjj-custom-techniques-v2'
export const CUSTOM_TECHNIQUES_EVENT = 'custom-techniques-changed'

export function normalizeTechniqueVideoType(value: unknown): TechniqueVideoType {
  if (value === 'youtube' || value === 'youtube_short' || value === 'instagram_reel' || value === 'tiktok') {
    return value
  }

  return 'youtube'
}

export function inferTechniqueVideoType(url?: string, platform?: TechniqueVideo['platform']): TechniqueVideoType {
  const safeUrl = (url ?? '').toLowerCase()

  if (safeUrl.includes('tiktok.com')) return 'tiktok'
  if (safeUrl.includes('instagram.com')) return 'instagram_reel'
  if (safeUrl.includes('/shorts/')) return 'youtube_short'
  if (safeUrl.includes('youtube.com') || safeUrl.includes('youtu.be')) return 'youtube'
  if (platform === 'instagram') return 'instagram_reel'
  return 'youtube'
}

export function getTechniqueVideoTypeLabel(videoType: TechniqueVideoType) {
  if (videoType === 'youtube_short') return 'YouTube Short'
  if (videoType === 'instagram_reel') return 'Instagram Reel'
  if (videoType === 'tiktok') return 'TikTok'
  return 'YouTube-Video'
}

export function getTechniqueVideoOrientation(videoType: TechniqueVideoType) {
  return videoType === 'youtube' ? 'landscape' : 'portrait'
}

export function getTechniqueVideoOrientationLabel(videoType: TechniqueVideoType) {
  return getTechniqueVideoOrientation(videoType) === 'portrait' ? 'Hochformat' : 'Querformat'
}

export function getTechniqueNoteText(note: string | TechniqueTaggedNote) {
  return typeof note === 'string' ? note : note.text
}

function normalizeTechniqueTaggedNote(value: unknown): TechniqueTaggedNote | null {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    return {
      id: `note-${crypto.randomUUID().slice(0, 8)}`,
      text,
      styleCoverage: 'both',
    }
  }

  if (!value || typeof value !== 'object') return null

  const entry = value as Partial<TechniqueTaggedNote> & { label?: string }
  const text = typeof entry.text === 'string' ? entry.text.trim() : typeof entry.label === 'string' ? entry.label.trim() : ''
  if (!text) return null

  return {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : `note-${crypto.randomUUID().slice(0, 8)}`,
    text,
    styleCoverage: normalizeTechniqueStyleCoverage(entry.styleCoverage),
  }
}

function normalizeTechniqueVideo(value: unknown): TechniqueVideo | null {
  if (!value || typeof value !== 'object') return null

  const entry = value as Partial<TechniqueVideo>
  if (typeof entry.id !== 'string' || typeof entry.title !== 'string' || typeof entry.url !== 'string') {
    return null
  }

  const platform: TechniqueVideo['platform'] =
    entry.platform === 'youtube' || entry.platform === 'instagram' || entry.platform === 'other'
      ? entry.platform
      : entry.url.includes('instagram.com')
        ? 'instagram'
        : entry.url.includes('youtube.com') || entry.url.includes('youtu.be')
          ? 'youtube'
          : 'other'

  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    platform,
    videoType: normalizeTechniqueVideoType(entry.videoType ?? inferTechniqueVideoType(entry.url, platform)),
    contentType: normalizeClipContentType(entry.contentType),
    learningPhase: normalizeClipLearningPhase(entry.learningPhase),
    targetArchetypeIds: Array.isArray(entry.targetArchetypeIds)
      ? entry.targetArchetypeIds.filter((item): item is string => typeof item === 'string')
      : [],
    description: typeof entry.description === 'string' && entry.description.trim() ? entry.description : undefined,
    hashtags: normalizeHashtags(Array.isArray(entry.hashtags) ? entry.hashtags : []),
    timestamp: typeof entry.timestamp === 'string' && entry.timestamp.trim() ? entry.timestamp : undefined,
  }
}

export function readCustomTechniques(): CustomTechniqueRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(CUSTOM_TECHNIQUES_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((entry) => normalizeCustomTechniqueRecord(entry))
      .filter((entry): entry is CustomTechniqueRecord => Boolean(entry))
  } catch {
    return []
  }
}

export function getCustomTechniqueById(id: string): CustomTechniqueRecord | undefined {
  const techniques = readCustomTechniques()
  return techniques.find((t) => t.id === id)
}

export function writeCustomTechniques(records: CustomTechniqueRecord[]) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    CUSTOM_TECHNIQUES_STORAGE_KEY,
    JSON.stringify(records.map((record) => normalizeCustomTechniqueRecord(record)).filter(Boolean))
  )
  window.dispatchEvent(new Event(CUSTOM_TECHNIQUES_EVENT))
}

export function updateCustomTechnique(
  id: string, 
  updates: Partial<CustomTechniqueRecord>
): boolean {
  const techniques = readCustomTechniques()
  const index = techniques.findIndex((t) => t.id === id)
  
  if (index === -1) return false
  
  techniques[index] = {
    ...techniques[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  writeCustomTechniques(techniques)
  return true
}

export function deleteCustomTechnique(id: string): boolean {
  const techniques = readCustomTechniques()
  const filtered = techniques.filter((t) => t.id !== id)
  
  if (filtered.length === techniques.length) return false
  
  writeCustomTechniques(filtered)
  return true
}

// Migration von altem Format
export function migrateOldTechniques() {
  const oldKey = 'bjj-custom-techniques-v1'
  const oldRaw = window.localStorage.getItem(oldKey)
  
  if (oldRaw) {
    try {
      const oldTechniques = JSON.parse(oldRaw)
      if (Array.isArray(oldTechniques) && oldTechniques.length > 0) {
        const newTechniques: CustomTechniqueRecord[] = oldTechniques
          .map((old: any) => normalizeCustomTechniqueRecord(old))
          .filter((entry): entry is CustomTechniqueRecord => Boolean(entry))
        
        window.localStorage.setItem(CUSTOM_TECHNIQUES_STORAGE_KEY, JSON.stringify(newTechniques))
        window.localStorage.removeItem(oldKey)
      }
    } catch {
      // Migration failed, ignore
    }
  }
}

export function resolveTechniqueStyleContent(technique: CustomTechniqueRecord, style: TechniqueStyle) {
  const override = coverageIncludesStyle(technique.styleCoverage, style) ? technique.styleOverrides?.[style] : undefined

  return {
    description: override?.description?.trim() || technique.description,
    videos: override?.videos && override.videos.length > 0 ? override.videos : technique.videos,
    counters: override?.counters && override.counters.length > 0 ? override.counters : technique.counters,
    drills: override?.drills && override.drills.length > 0 ? override.drills : technique.drills,
    keyPoints: override?.keyPoints && override.keyPoints.length > 0 ? override.keyPoints : technique.keyPoints,
    commonErrors: override?.commonErrors && override.commonErrors.length > 0 ? override.commonErrors : technique.commonErrors,
  }
}

function normalizeTechniqueStyleContent(value: unknown): TechniqueStyleContent | undefined {
  if (!value || typeof value !== 'object') return undefined

  const entry = value as TechniqueStyleContent
  const next: TechniqueStyleContent = {}

  if (typeof entry.description === 'string' && entry.description.trim()) next.description = entry.description
  if (Array.isArray(entry.videos)) next.videos = entry.videos.map((item) => normalizeTechniqueVideo(item)).filter((item): item is TechniqueVideo => Boolean(item))
  if (Array.isArray(entry.counters)) next.counters = entry.counters
  if (Array.isArray(entry.drills)) next.drills = entry.drills
  if (Array.isArray(entry.keyPoints)) next.keyPoints = entry.keyPoints.map((item) => normalizeTechniqueTaggedNote(item)).filter((item): item is TechniqueTaggedNote => Boolean(item))
  if (Array.isArray(entry.commonErrors)) next.commonErrors = entry.commonErrors.map((item) => normalizeTechniqueTaggedNote(item)).filter((item): item is TechniqueTaggedNote => Boolean(item))

  return Object.keys(next).length > 0 ? next : undefined
}

function normalizeTechniqueCounter(value: unknown): TechniqueCounter | null {
  if (!value || typeof value !== 'object') return null

  const entry = value as Partial<TechniqueCounter>
  if (typeof entry.id !== 'string' || typeof entry.title !== 'string' || typeof entry.description !== 'string') {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    videoUrl: typeof entry.videoUrl === 'string' && entry.videoUrl.trim() ? entry.videoUrl : undefined,
    styleCoverage: normalizeTechniqueStyleCoverage(entry.styleCoverage),
  }
}

function normalizeTechniqueDrill(value: unknown): TechniqueDrill | null {
  if (!value || typeof value !== 'object') return null

  const entry = value as Partial<TechniqueDrill>
  if (typeof entry.id !== 'string' || typeof entry.title !== 'string' || typeof entry.description !== 'string') {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    duration: typeof entry.duration === 'string' && entry.duration.trim() ? entry.duration : undefined,
    repetitions: typeof entry.repetitions === 'number' ? entry.repetitions : undefined,
    styleCoverage: normalizeTechniqueStyleCoverage(entry.styleCoverage),
  }
}

function normalizeCustomTechniqueRecord(entry: unknown): CustomTechniqueRecord | null {
  if (!entry || typeof entry !== 'object') return null

  const record = entry as Partial<CustomTechniqueRecord> & { styleOverrides?: Record<string, unknown> }

  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.subtitle !== 'string' ||
    typeof record.description !== 'string' ||
    typeof record.image !== 'string' ||
    typeof record.stage !== 'string' ||
    typeof record.track !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    title: record.title,
    subtitle: record.subtitle,
    description: record.description,
    image: record.image,
    stage: record.stage as StageKey,
    track: record.track as CustomTechniqueRecord['track'],
    creator: typeof record.creator === 'string' ? record.creator : 'BJJMAXXING',
    fighter: typeof record.fighter === 'string' ? record.fighter : 'BJJMAXXING',
    level: typeof record.level === 'number' ? record.level : 1,
    videos: Array.isArray(record.videos)
      ? record.videos.map((item) => normalizeTechniqueVideo(item)).filter((item): item is TechniqueVideo => Boolean(item))
      : [],
    counters: Array.isArray(record.counters)
      ? record.counters.map((item) => normalizeTechniqueCounter(item)).filter((item): item is TechniqueCounter => Boolean(item))
      : [],
    drills: Array.isArray(record.drills)
      ? record.drills.map((item) => normalizeTechniqueDrill(item)).filter((item): item is TechniqueDrill => Boolean(item))
      : [],
    keyPoints: Array.isArray(record.keyPoints)
      ? record.keyPoints.map((item) => normalizeTechniqueTaggedNote(item)).filter((item): item is TechniqueTaggedNote => Boolean(item))
      : [],
    commonErrors: Array.isArray(record.commonErrors)
      ? record.commonErrors.map((item) => normalizeTechniqueTaggedNote(item)).filter((item): item is TechniqueTaggedNote => Boolean(item))
      : [],
    prerequisites: Array.isArray(record.prerequisites) ? record.prerequisites.filter((item): item is string => typeof item === 'string') : [],
    recommendedArchetypeIds: Array.isArray(record.recommendedArchetypeIds)
      ? record.recommendedArchetypeIds.filter((item): item is string => typeof item === 'string')
      : [],
    styleCoverage: normalizeTechniqueStyleCoverage(record.styleCoverage),
    styleOverrides: {
      gi: normalizeTechniqueStyleContent(record.styleOverrides?.gi),
      nogi: normalizeTechniqueStyleContent(record.styleOverrides?.nogi),
    },
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  }
}
