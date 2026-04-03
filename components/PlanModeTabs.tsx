'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/skill-tree', label: 'Skill Tree' },
  { href: '/gameplan', label: 'Gameplan' },
]

export function PlanModeTabs() {
  const pathname = usePathname()

  return (
    <div className="inline-flex rounded-full border border-bjj-border bg-bjj-surface p-1">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors ${
              active ? 'bg-bjj-gold text-bjj-coal' : 'text-bjj-muted hover:text-bjj-text'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
