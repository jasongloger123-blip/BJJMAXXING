import type { LucideIcon } from 'lucide-react'

export type TechniqueStage = 'setup' | 'position' | 'transition' | 'finish'

export type TechniqueItem = {
  id: string
  title: string
  tag: string
  tagColor: string
  level: number
  duration: string
  prereq: string
  icon: LucideIcon
  image: string
  locked?: boolean
  fighter: string
  creator: string
  stage: TechniqueStage
  nodeId?: string
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
export type TechniqueAvailability = 'all' | 'available' | 'locked'

export type TechniqueFilters = {
  query: string
  stage: 'all' | TechniqueStage
  fighter: string
  availability: TechniqueAvailability
  sort: TechniqueSort
}

export type TechniqueFilterOption = {
  id: 'all' | TechniqueStage
  label: string
  count: number
}

export type ActiveTechniqueFilter = {
  id: string
  label: string
}
