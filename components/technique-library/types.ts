import type { LucideIcon } from 'lucide-react'
import type { TechniqueStyleCoverage } from '@/lib/technique-style'

export type TechniqueStage = 'position' | 'pass' | 'submission'

export type TechniqueItem = {
  id: string
  techniqueId?: string
  title: string
  description: string
  tag: string
  tagColor: string
  level: number
  duration: string
  prereq: string
  icon: LucideIcon
  image: string
  coachAvatar: string
  locked?: boolean
  unlockState?: 'unlocked' | 'locked'
  fighter: string
  creator: string
  stage: TechniqueStage
  difficulty: string
  style: string
  styleCoverage: TechniqueStyleCoverage
}

export type CreatorPlan = {
  id: string
  title: string
  creator: string
  fighter: string
  price: string
  techniques: number
  focus: string
  description: string
}

export type TechniqueSort = 'featured' | 'level-desc' | 'level-asc' | 'title-asc'
export type TechniqueFilters = {
  query: string
  stages: TechniqueStage[]
  difficulties: string[]
  styles: string[]
  fighters: string[]
  sort: TechniqueSort
}

export type TechniqueFilterOption = {
  id: 'all' | TechniqueStage
  label: string
  count: number
}

export type TechniqueFilterGroupOption<T extends string> = {
  id: T
  label: string
  count?: number
}

export type ActiveTechniqueFilter = {
  id: string
  label: string
}
