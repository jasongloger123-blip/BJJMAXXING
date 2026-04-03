import type { Archetype } from '@/lib/archetypes'

export type ArchetypeResultData = {
  primary: Archetype
  secondary: Archetype
  scores: Record<string, number>
}

const RESULT_KEY = 'archetype_result'
const PENDING_RESULT_KEY = 'bjj_pending_archetype_result'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function saveArchetypeResult(result: ArchetypeResultData, pending = false) {
  if (!isBrowser()) return

  const serialized = JSON.stringify(result)
  window.sessionStorage.setItem(RESULT_KEY, serialized)

  if (pending) {
    window.sessionStorage.setItem(PENDING_RESULT_KEY, serialized)
  } else {
    window.sessionStorage.removeItem(PENDING_RESULT_KEY)
  }
}

export function readArchetypeResult() {
  if (!isBrowser()) return null

  const stored = window.sessionStorage.getItem(RESULT_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as ArchetypeResultData
  } catch {
    return null
  }
}

export function readPendingArchetypeResult() {
  if (!isBrowser()) return null

  const stored = window.sessionStorage.getItem(PENDING_RESULT_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as ArchetypeResultData
  } catch {
    return null
  }
}

export function clearPendingArchetypeResult() {
  if (!isBrowser()) return
  window.sessionStorage.removeItem(PENDING_RESULT_KEY)
}
