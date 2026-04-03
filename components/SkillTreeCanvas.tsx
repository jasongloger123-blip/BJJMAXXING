import { NodeCard } from '@/components/NodeCard'
import type { SkillNode } from '@/lib/seed-data'

type SkillTreeCanvasProps = {
  nodes: SkillNode[]
  completedIds: string[]
  unlockedIds: string[]
}

function getStatus(node: SkillNode, completedIds: string[], unlockedIds: string[]) {
  if (completedIds.includes(node.id)) {
    return 'completed' as const
  }

  if (unlockedIds.includes(node.id)) {
    return 'unlocked' as const
  }

  return 'locked' as const
}

export function SkillTreeCanvas({ nodes, completedIds, unlockedIds }: SkillTreeCanvasProps) {
  const sections = [
    { label: 'Foundation Track', track: 'foundation' },
    { label: 'Secondary Track', track: 'secondary' },
    { label: 'Top Game Track', track: 'top-game' },
  ] as const

  return (
    <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
      {sections.map((section, index) => {
        const trackNodes = nodes.filter((node) => node.track === section.track)

        return (
          <div key={section.track} className={index === sections.length - 1 ? '' : 'mb-10'}>
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-bjj-border" />
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-orange">{section.label}</p>
              <div className="h-px flex-1 bg-bjj-border" />
            </div>

            <div className="space-y-4">
              {trackNodes.map((node) => (
                <div key={node.id}>
                  <NodeCard node={node} status={getStatus(node, completedIds, unlockedIds)} />
                  {node.prerequisites.length > 0 && <div className="ml-5 mt-2 h-5 w-px bg-bjj-border" />}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
