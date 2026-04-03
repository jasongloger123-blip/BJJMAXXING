import { LONG_FLEXIBLE_GUARD_TREE, type SkillNode } from '@/lib/seed-data'

export type { SkillNode }

export const LONG_FLEXIBLE_GUARD_NODES = LONG_FLEXIBLE_GUARD_TREE
export const MVP_PLAN_IDS = [
  'node-1-guard-identity',
  'node-2-guard-entry',
  'node-3-dlr-connection',
  'node-4-dlr-retention',
  'node-5-dlr-off-balance',
] as const
export const MVP_PHASE_LABELS = ['Identity', 'Entry', 'Position', 'Retention', 'Off-Balance'] as const

export function getNodeById(id: string) {
  return LONG_FLEXIBLE_GUARD_TREE.find((node) => node.id === id)
}

export function getPlanNodes(planIds: readonly string[] = MVP_PLAN_IDS) {
  return planIds.map((id) => getNodeById(id)).filter(Boolean) as SkillNode[]
}

export function getUnlockedNodes(completedNodeIds: string[]) {
  return LONG_FLEXIBLE_GUARD_TREE.filter((node) =>
    node.prerequisites.every((prerequisite) => completedNodeIds.includes(prerequisite))
  ).map((node) => node.id)
}

export function calculateLevel(completedNodeIds: string[]) {
  const completedFoundation = LONG_FLEXIBLE_GUARD_TREE.filter(
    (node) => node.track === 'foundation' && completedNodeIds.includes(node.id)
  ).length

  return Math.min(10, completedFoundation + 1)
}

export function getCurrentPlanNode(completedNodeIds: string[], planIds: readonly string[] = MVP_PLAN_IDS) {
  const planNodes = getPlanNodes(planIds)
  return planNodes.find((node) => !completedNodeIds.includes(node.id)) ?? null
}

export function getPlanLevel(completedNodeIds: string[], planIds: readonly string[] = MVP_PLAN_IDS) {
  const planNodes = getPlanNodes(planIds)
  const completedPlanCount = planNodes.filter((node) => completedNodeIds.includes(node.id)).length
  return Math.min(planNodes.length, completedPlanCount + 1)
}

export function isPlanComplete(completedNodeIds: string[], planIds: readonly string[] = MVP_PLAN_IDS) {
  const planNodes = getPlanNodes(planIds)
  return planNodes.length > 0 && planNodes.every((node) => completedNodeIds.includes(node.id))
}

export function getLevelMeaning(completedNodeIds: string[], planIds: readonly string[] = MVP_PLAN_IDS) {
  const planNodes = getPlanNodes(planIds)
  const completedPlanCount = planNodes.filter((node) => completedNodeIds.includes(node.id)).length
  const currentNode = getCurrentPlanNode(completedNodeIds, planIds)
  const lastCompletedNode = [...planNodes].reverse().find((node) => completedNodeIds.includes(node.id))

  if (completedPlanCount >= planNodes.length) {
    return `Level ${planNodes.length} - ${planNodes[planNodes.length - 1]?.title ?? 'Plan abgeschlossen'}`
  }

  if (lastCompletedNode) {
    return `Level ${completedPlanCount + 1} - ${lastCompletedNode.title} abgeschlossen`
  }

  return `Level 1 - ${currentNode?.title ?? 'Start'} aktiv`
}
