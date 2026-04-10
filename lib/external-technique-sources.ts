import { detectVideoFormat, getVideoPlatform, type ClipVideoFormat } from '@/lib/video-format'
import type { TechniqueStyleCoverage } from '@/lib/technique-style'

export const EXTERNAL_SOURCE_PROVIDER = 'outlierdb' as const

export const EXTERNAL_SOURCE_ROLES = [
  'main_reference',
  'counter_reference',
  'drill_reference',
  'related_reference',
] as const

export type ExternalSourceProvider = typeof EXTERNAL_SOURCE_PROVIDER
export type ExternalSourceRole = (typeof EXTERNAL_SOURCE_ROLES)[number]
export type ExternalSearchMode = 'tag_search' | 'ai_chat'

export type ExternalTechniqueSourceRecord = {
  id: string
  provider: ExternalSourceProvider
  source_url: string
  source_type: 'sequence'
  title: string
  video_url: string | null
  video_platform: string | null
  video_format?: ClipVideoFormat | null
  style_coverage?: TechniqueStyleCoverage | null
  timestamp_label: string | null
  timestamp_seconds: number | null
  hashtags: string[]
  summary: string | null
  search_query: string | null
  raw_payload: Record<string, unknown>
  imported_at: string
  last_seen_at: string
}

export type NodeExternalSourceRecord = {
  id: string
  node_id: string
  external_source_id: string
  role: ExternalSourceRole
  notes: string | null
  created_at: string
}

export type NodeExternalSourceWithSource = {
  mappingId: string
  nodeId: string
  role: ExternalSourceRole
  notes: string | null
  createdAt: string
  source: ExternalTechniqueSourceRecord
}

export type ExternalTechniqueSearchRunRecord = {
  id: string
  provider: ExternalSourceProvider
  mode: ExternalSearchMode
  label: string
  query: string | null
  hashtags: string[]
  page: number | null
  limit_count: number | null
  imported_count: number
  failed_count: number
  has_more: boolean
  request_payload: Record<string, unknown>
  response_payload: Record<string, unknown>
  created_at: string
}

export type ExternalTechniqueSearchRunSectionRecord = {
  id: string
  run_id: string
  section_key: string
  section_title: string
  section_order: number
  section_summary: string | null
  created_at: string
}

export type ExternalTechniqueSearchRunSectionWithSources = {
  id: string
  runId: string
  sectionKey: string
  sectionTitle: string
  sectionOrder: number
  sectionSummary: string | null
  createdAt: string
  sources: ExternalTechniqueSourceRecord[]
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseTimestampLabelToSeconds(value?: string | null) {
  if (!value) return null

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const [, hoursOrMinutes, minutesOrSeconds, seconds] = match

  if (typeof seconds === 'string') {
    return Number(hoursOrMinutes) * 3600 + Number(minutesOrSeconds) * 60 + Number(seconds)
  }

  return Number(hoursOrMinutes) * 60 + Number(minutesOrSeconds)
}

export function detectVideoPlatform(url?: string | null) {
  if (!url) return null
  return getVideoPlatform(detectVideoFormat(url))
}

export function normalizeHashtags(value: string | string[] | null | undefined) {
  if (!value) return []

  const pieces = Array.isArray(value) ? value : value.split(/(?=#)|[\s,]+/)

  return Array.from(
    new Set(
      pieces
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => (entry.startsWith('#') ? entry.slice(1) : entry))
        .map((entry) => entry.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
        .filter(Boolean)
    )
  )
}

export function getExternalSourceRoleLabel(role: ExternalSourceRole) {
  if (role === 'main_reference') return 'Details'
  if (role === 'counter_reference') return 'Counter'
  if (role === 'drill_reference') return 'Drills'
  return 'Follow-ups'
}
