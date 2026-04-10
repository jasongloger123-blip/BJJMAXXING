export const SAVED_CLIPS_STORAGE_KEY = 'bjj-saved-clip-ids'
export const SAVED_CLIPS_EVENT = 'saved-clips-changed'

export type SavedClipPreview = {
  id: string
  external_source_id?: string | null
  title: string
  summary: string | null
  source_url: string
  video_url: string | null
  video_platform: string | null
  provider: string
  timestamp_label: string | null
  hashtags: string[]
  created_at: string
}

export function readSavedClipIdsFromStorage() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(SAVED_CLIPS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

export function writeSavedClipIdsToStorage(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SAVED_CLIPS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))))
}

export function dispatchSavedClipsChanged(ids: string[]) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SAVED_CLIPS_EVENT, { detail: ids }))
}
