import Link from 'next/link'
import type { SkillNode } from '@/lib/seed-data'

type NodeCardProps = {
  node: SkillNode
  status: 'completed' | 'unlocked' | 'locked'
}

export function NodeCard({ node, status }: NodeCardProps) {
  const content = (
    <div
      className={`relative rounded-[1.75rem] border p-5 transition-all ${
        node.isComingSoon
          ? 'border-bjj-border bg-bjj-surface opacity-60'
          : status === 'completed'
            ? 'border-bjj-green/30 bg-bjj-green/10'
            : status === 'unlocked'
              ? 'border-bjj-orange/40 bg-bjj-orange/10 shadow-orange-glow-sm'
              : 'border-bjj-border bg-bjj-surface'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black ${
            status === 'completed'
              ? 'bg-bjj-green text-white'
              : status === 'unlocked'
                ? 'bg-bjj-orange text-white'
                : 'bg-bjj-border text-bjj-muted'
          }`}
        >
          {status === 'completed' ? 'OK' : node.level}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold">{node.title}</p>
            {node.isComingSoon && (
              <span className="rounded-full border border-bjj-border px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-bjj-muted">
                Coming Soon
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-bjj-muted">{node.subtitle}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-bjj-muted">
            {node.track.replace('-', ' ')} Track
          </p>
        </div>
      </div>
    </div>
  )

  if (node.isComingSoon || status === 'locked') {
    return content
  }

  return <Link href={`/node/${node.id}`}>{content}</Link>
}
