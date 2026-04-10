export type TechniqueStyle = 'gi' | 'nogi'
export type TechniqueStyleCoverage = TechniqueStyle | 'both'

export const TECHNIQUE_STYLES: TechniqueStyle[] = ['gi', 'nogi']
export const TECHNIQUE_STYLE_STORAGE_KEY = 'bjj-technique-style-mode'

export function isTechniqueStyle(value: unknown): value is TechniqueStyle {
  return value === 'gi' || value === 'nogi'
}

export function normalizeTechniqueStyle(value: unknown, fallback: TechniqueStyle = 'gi'): TechniqueStyle {
  return isTechniqueStyle(value) ? value : fallback
}

export function normalizeTechniqueStyleCoverage(value: unknown): TechniqueStyleCoverage {
  if (value === 'gi' || value === 'nogi' || value === 'both') {
    return value
  }

  return 'both'
}

export function coverageIncludesStyle(coverage: TechniqueStyleCoverage, style: TechniqueStyle) {
  return coverage === 'both' || coverage === style
}

export function getTechniqueStyleLabel(style: TechniqueStyle) {
  return style === 'gi' ? 'Gi' : 'No-Gi'
}

export function getTechniqueCoverageLabel(coverage: TechniqueStyleCoverage) {
  if (coverage === 'both') return 'Gi & No-Gi'
  return getTechniqueStyleLabel(coverage)
}

export function getCoverageFilterLabels(coverage: TechniqueStyleCoverage) {
  if (coverage === 'both') return ['Gi', 'No-Gi']
  return [getTechniqueCoverageLabel(coverage)]
}

export function readPreferredTechniqueStyle() {
  if (typeof window === 'undefined') return 'gi' as TechniqueStyle
  return normalizeTechniqueStyle(window.localStorage.getItem(TECHNIQUE_STYLE_STORAGE_KEY), 'gi')
}

export function writePreferredTechniqueStyle(style: TechniqueStyle) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TECHNIQUE_STYLE_STORAGE_KEY, style)
}
