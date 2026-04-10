import type { CuratedClip } from '@/lib/curated-clips'
import { normalizeHashtags } from '@/lib/external-technique-sources'
import { detectVideoFormat, getVideoPlatform, type ClipVideoFormat } from '@/lib/video-format'

export const CLIP_ARCHIVE_STATUSES = ['unassigned', 'assigned', 'hidden', 'archived'] as const
export const CLIP_ASSIGNMENT_KINDS = ['node', 'connection'] as const

export type ClipArchiveStatus = (typeof CLIP_ARCHIVE_STATUSES)[number]
export type ClipAssignmentKind = (typeof CLIP_ASSIGNMENT_KINDS)[number]

export type ClipArchiveRecord = {
  id: string
  external_source_id: string | null
  source_run_id: string | null
  provider: string
  source_url: string
  source_type: string
  title: string
  video_url: string | null
  video_platform: string | null
  video_format?: ClipVideoFormat | null
  timestamp_label: string | null
  timestamp_seconds: number | null
  hashtags: string[]
  summary: string | null
  search_query: string | null
  raw_payload: Record<string, unknown>
  assignment_status: ClipArchiveStatus
  created_at: string
  last_seen_at: string
}

export type ClipAssignmentRecord = {
  id: string
  clip_id: string
  assignment_kind: ClipAssignmentKind
  node_id: string | null
  from_node_id: string | null
  to_node_id: string | null
  role: 'main_reference' | 'counter_reference' | 'drill_reference' | 'related_reference' | null
  display_order: number
  notes: string | null
  created_at: string
}

export function getClipAssignmentRoleLabel(role: ClipAssignmentRecord['role']) {
  switch (role) {
    case 'main_reference':
      return 'Details'
    case 'counter_reference':
      return 'Counter'
    case 'drill_reference':
      return 'Drills'
    case 'related_reference':
      return 'Follow-ups'
    default:
      return 'Unbekannt'
  }
}

export function detectClipSource(url?: string | null): CuratedClip['source'] {
  if (!url) return 'external'
  const platform = getVideoPlatform(detectVideoFormat(url))
  if (platform === 'instagram') return 'instagram'
  if (platform === 'youtube') return 'youtube'
  return 'external'
}

export function clipArchiveToCuratedClip(
  clip: ClipArchiveRecord,
  fallback: {
    nodeId: string
    category?: string
    levelLabel?: string
  }
): CuratedClip {
  const clipWindow = clip.timestamp_label ? `${clip.timestamp_label}-${clip.timestamp_label}` : '0:00'
  const sourceUrl = clip.video_url ?? clip.source_url
  const videoFormat = clip.video_format ?? detectVideoFormat(sourceUrl)
  return {
    id: clip.id,
    nodeId: fallback.nodeId,
    title: clip.title,
    clipWindow,
    principle: clip.summary ?? clip.search_query ?? clip.title,
    category: fallback.category ?? 'Archive',
    levelLabel: fallback.levelLabel ?? 'Archiv',
    description: clip.summary ?? clip.title,
    source: detectClipSource(sourceUrl),
    videoFormat,
    sourceUrl,
    detailHref: `/clips/${clip.id}`,
    comments: [],
  }
}

export function normalizeClipHashtags(value: string[] | string | null | undefined) {
  return normalizeHashtags(value)
}
