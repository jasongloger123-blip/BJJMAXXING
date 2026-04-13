export const CLIP_CONTENT_TYPES = [
  'concept_explanation',
  'technical_demo',
  'drill',
  'sparring_footage',
  'competition_footage',
  'mistake_analysis',
  'counter_example',
] as const

export const CLIP_LEARNING_PHASES = [
  'overview',
  'core_mechanic',
  'entry',
  'control',
  'finish',
  'common_mistake',
  'troubleshooting',
  'advanced',
] as const

export type ClipContentType = (typeof CLIP_CONTENT_TYPES)[number]
export type ClipLearningPhase = (typeof CLIP_LEARNING_PHASES)[number]

export const CLIP_CONTENT_TYPE_LABELS: Record<ClipContentType, string> = {
  concept_explanation: 'Erklaerung / Talk',
  technical_demo: 'Technik-Demo',
  drill: 'Drill',
  sparring_footage: 'Sparring Footage',
  competition_footage: 'Kampf Footage',
  mistake_analysis: 'Fehleranalyse',
  counter_example: 'Counter-Beispiel',
}

export const CLIP_LEARNING_PHASE_LABELS: Record<ClipLearningPhase, string> = {
  overview: 'Overview',
  core_mechanic: 'Core Mechanic',
  entry: 'Entry',
  control: 'Control',
  finish: 'Finish',
  common_mistake: 'Common Mistake',
  troubleshooting: 'Troubleshooting',
  advanced: 'Advanced',
}

export function normalizeClipContentType(value: unknown, fallback: ClipContentType = 'technical_demo'): ClipContentType {
  return CLIP_CONTENT_TYPES.includes(value as ClipContentType) ? (value as ClipContentType) : fallback
}

export function normalizeClipLearningPhase(value: unknown, fallback: ClipLearningPhase = 'core_mechanic'): ClipLearningPhase {
  return CLIP_LEARNING_PHASES.includes(value as ClipLearningPhase) ? (value as ClipLearningPhase) : fallback
}

export function getClipContentTypeLabel(value?: string | null) {
  return CLIP_CONTENT_TYPE_LABELS[normalizeClipContentType(value)]
}

export function getClipLearningPhaseLabel(value?: string | null) {
  return CLIP_LEARNING_PHASE_LABELS[normalizeClipLearningPhase(value)]
}
