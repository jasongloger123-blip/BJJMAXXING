import type { TechniqueStage } from '@/components/technique-library/types'
import type { PlanNode, ResolvedGameplan } from '@/lib/gameplans'
import { getNodeById, type SkillNode } from '@/lib/nodes'
import {
  getCustomTechniqueById,
  inferTechniqueVideoType,
  readCustomTechniques,
  type CustomTechniqueRecord,
  type TechniqueStyleOverrides,
  type TechniqueTaggedNote,
  type TechniqueVideo,
  type TechniqueVideoType,
} from '@/lib/custom-techniques'
import { coverageIncludesStyle, type TechniqueStyle, type TechniqueStyleCoverage } from '@/lib/technique-style'

export type TechniqueCatalogEntry =
  | {
      kind: 'node'
      id: string
      title: string
      subtitle: string
      description: string
      stage: TechniqueStage
      fighter: string
      level: number
      image: string
      videos: TechniqueVideo[]
      counters: { id: string; title: string; description: string; styleCoverage?: TechniqueStyleCoverage }[]
      drills: { id: string; title: string; description: string; duration?: string; styleCoverage?: TechniqueStyleCoverage }[]
      keyPoints: TechniqueTaggedNote[]
      commonErrors: TechniqueTaggedNote[]
      prerequisites: string[]
      styleCoverage: TechniqueStyleCoverage
      styleOverrides?: never
    }
  | {
      kind: 'custom'
      id: string
      title: string
      subtitle: string
      description: string
      stage: TechniqueStage
      fighter: string
      level: number
      image: string
      videos: TechniqueVideo[]
      counters: { id: string; title: string; description: string; styleCoverage?: TechniqueStyleCoverage }[]
      drills: { id: string; title: string; description: string; duration?: string; styleCoverage?: TechniqueStyleCoverage }[]
      keyPoints: TechniqueTaggedNote[]
      commonErrors: TechniqueTaggedNote[]
      prerequisites: string[]
      styleCoverage: TechniqueStyleCoverage
      styleOverrides?: TechniqueStyleOverrides
    }

export type TechniqueFollowUpEntry = {
  id: string
  title: string
  subtitle: string
  stage: TechniqueStage
  image: string
  videosCount: number
  sourcePlanNodeId: string
}

function extractYoutubeId(url?: string | null) {
  if (!url) return null
  const short = url.match(/youtu\.be\/([^?&]+)/)
  if (short?.[1]) return short[1]
  const long = url.match(/[?&]v=([^&]+)/)
  if (long?.[1]) return long[1]
  return null
}

function getThumbnail(url?: string | null) {
  const id = extractYoutubeId(url)
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  return 'https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?auto=format&fit=crop&q=80&w=900'
}

function guessStageFromNode(node: SkillNode): TechniqueStage {
  if (node.track === 'top-game') return 'submission'
  if (node.track === 'secondary') return 'pass'
  if (node.title.toLowerCase().includes('finish') || node.title.toLowerCase().includes('choke')) return 'submission'
  return 'position'
}

function nodeToTechnique(node: SkillNode): TechniqueCatalogEntry {
  return {
    kind: 'node',
    id: node.id,
    title: node.title,
    subtitle: node.subtitle,
    description: node.description,
    stage: guessStageFromNode(node),
    fighter: 'BJJMAXXING',
    level: node.level,
    image: getThumbnail(node.videos[0]?.url),
    videos: node.videos.map((video, index) => {
      const platform: TechniqueVideo['platform'] = video.url.includes('instagram.com')
        ? 'instagram'
        : video.url.includes('youtube.com') || video.url.includes('youtu.be')
          ? 'youtube'
          : 'other'

      return {
        id: `${node.id}-video-${index}`,
        title: video.title,
        url: video.url,
        platform,
        videoType: inferTechniqueVideoType(video.url, platform),
        contentType: 'technical_demo',
        learningPhase: index === 0 ? 'overview' : 'core_mechanic',
        targetArchetypeIds: [],
      }
    }),
    counters: [],
    drills: node.drill
      ? [
          {
            id: `${node.id}-drill`,
            title: 'Standard Drill',
            description: node.drill,
            styleCoverage: 'both',
          },
        ]
      : [],
    keyPoints: node.successDefinition.map((text, index) => ({ id: `${node.id}-keypoint-${index}`, text, styleCoverage: 'both' })),
    commonErrors: node.commonErrors.map((text, index) => ({ id: `${node.id}-error-${index}`, text, styleCoverage: 'both' })),
    prerequisites: node.prerequisites,
    styleCoverage: 'both',
  }
}

function customTechniqueToEntry(technique: CustomTechniqueRecord): TechniqueCatalogEntry {
  return {
    kind: 'custom',
    id: technique.id,
    title: technique.title,
    subtitle: technique.subtitle,
    description: technique.description,
    stage: technique.stage,
    fighter: technique.fighter,
    level: technique.level,
    image: technique.image,
    videos: technique.videos,
    counters: technique.counters,
    drills: technique.drills,
    keyPoints: technique.keyPoints,
    commonErrors: technique.commonErrors,
    prerequisites: technique.prerequisites,
    styleCoverage: technique.styleCoverage,
    styleOverrides: technique.styleOverrides,
  }
}

export function resolveTechniqueCatalogContent(entry: TechniqueCatalogEntry, style: TechniqueStyle) {
  if (entry.kind === 'custom') {
    const override = entry.styleOverrides?.[style]
    const resolvedCounters = override?.counters && override.counters.length > 0 ? override.counters : entry.counters
    const resolvedDrills = override?.drills && override.drills.length > 0 ? override.drills : entry.drills

    return {
      description: override?.description?.trim() || entry.description,
      videos: override?.videos && override.videos.length > 0 ? override.videos : entry.videos,
      counters: resolvedCounters.filter((counter) => coverageIncludesStyle(counter.styleCoverage ?? 'both', style)),
      drills: resolvedDrills.filter((drill) => coverageIncludesStyle(drill.styleCoverage ?? 'both', style)),
      keyPoints: (override?.keyPoints && override.keyPoints.length > 0 ? override.keyPoints : entry.keyPoints).filter((item) =>
        coverageIncludesStyle(item.styleCoverage ?? 'both', style)
      ),
      commonErrors: (override?.commonErrors && override.commonErrors.length > 0 ? override.commonErrors : entry.commonErrors).filter((item) =>
        coverageIncludesStyle(item.styleCoverage ?? 'both', style)
      ),
    }
  }

  return {
    description: entry.description,
    videos: entry.videos,
    counters: entry.counters.filter((counter) => coverageIncludesStyle(counter.styleCoverage ?? 'both', style)),
    drills: entry.drills.filter((drill) => coverageIncludesStyle(drill.styleCoverage ?? 'both', style)),
    keyPoints: entry.keyPoints.filter((item) => coverageIncludesStyle(item.styleCoverage ?? 'both', style)),
    commonErrors: entry.commonErrors.filter((item) => coverageIncludesStyle(item.styleCoverage ?? 'both', style)),
  }
}

export function getTechniqueCatalogEntryById(id: string): TechniqueCatalogEntry | null {
  const customTechnique = getCustomTechniqueById(id)
  if (customTechnique) {
    return customTechniqueToEntry(customTechnique)
  }

  const node = getNodeById(id)
  if (node) {
    return nodeToTechnique(node)
  }

  return null
}

export function getTechniqueCatalogEntryForPlanNode(node?: Pick<PlanNode, 'id' | 'sourceNodeId' | 'title' | 'label'> | null) {
  if (!node) return null

  const directIds = [node.sourceNodeId, node.id].filter((value): value is string => Boolean(value))
  for (const id of directIds) {
    const entry = getTechniqueCatalogEntryById(id)
    if (entry) {
      return entry
    }
  }

  const normalizedTitle = (node.title ?? '').trim().toLowerCase()
  const normalizedLabel = (node.label ?? '').trim().toLowerCase()
  const customTechniques = readCustomTechniques()
  const matchedCustomTechnique = customTechniques.find((technique) => {
    const titleMatches = technique.title.trim().toLowerCase() === normalizedTitle
    const subtitleMatches = normalizedLabel.length > 0 && technique.subtitle.trim().toLowerCase() === normalizedLabel
    return titleMatches || subtitleMatches
  })

  if (matchedCustomTechnique) {
    return customTechniqueToEntry(matchedCustomTechnique)
  }

  const matchedNode = getNodeById(node.id) ?? getNodeById(node.sourceNodeId ?? '') ?? null
  if (matchedNode) {
    return nodeToTechnique(matchedNode)
  }

  return null
}

export function getNodeTechniqueCatalog() {
  return [] as TechniqueCatalogEntry[]
}

export function getTechniqueFollowUpsFromPlan(
  techniqueId: string,
  plan?: ResolvedGameplan | null
): TechniqueFollowUpEntry[] {
  if (!plan) return []

  const matchingPlanNodeIds = Object.values(plan.nodes)
    .filter((node) => (node.sourceNodeId ?? node.id) === techniqueId || node.id === techniqueId)
    .map((node) => node.id)

  if (matchingPlanNodeIds.length === 0) return []

  const nextPlanNodeIds = Array.from(
    new Set(plan.layout.edges.filter((edge) => matchingPlanNodeIds.includes(edge.from)).map((edge) => edge.to))
  )

  return nextPlanNodeIds
    .map((planNodeId) => {
      const planNode = plan.nodes[planNodeId]
      if (!planNode) return null

      const techniqueEntry = getTechniqueCatalogEntryById(planNode.sourceNodeId ?? planNode.id)

      if (techniqueEntry) {
        return {
          id: techniqueEntry.id,
          title: techniqueEntry.title,
          subtitle: techniqueEntry.subtitle,
          stage: techniqueEntry.stage,
          image: techniqueEntry.image,
          videosCount: techniqueEntry.videos.length,
          sourcePlanNodeId: planNodeId,
        } satisfies TechniqueFollowUpEntry
      }

      return {
        id: planNode.sourceNodeId ?? planNode.id,
        title: planNode.title,
        subtitle: planNode.description,
        stage: planNode.stage,
        image: '',
        videosCount: 0,
        sourcePlanNodeId: planNodeId,
      } satisfies TechniqueFollowUpEntry
    })
    .filter((entry): entry is TechniqueFollowUpEntry => Boolean(entry))
}
