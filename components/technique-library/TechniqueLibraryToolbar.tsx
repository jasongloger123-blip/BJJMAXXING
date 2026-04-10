'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Filter, Search } from 'lucide-react'
import type { TechniqueSort } from '@/components/technique-library/types'

type TechniqueLibraryToolbarProps = {
  query: string
  sort: TechniqueSort
  onQueryChange: (value: string) => void
  onSortChange: (value: TechniqueSort) => void
  onOpenFilters: () => void
}

const SORT_LABELS: Record<TechniqueSort, string> = {
  featured: 'Featured',
  'level-desc': 'Level absteigend',
  'level-asc': 'Level aufsteigend',
  'title-asc': 'Titel A-Z',
}

const SORT_OPTIONS: TechniqueSort[] = ['featured', 'level-desc', 'level-asc', 'title-asc']

export function TechniqueLibraryToolbar({
  query,
  sort,
  onQueryChange,
  onSortChange,
  onOpenFilters,
}: TechniqueLibraryToolbarProps) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!sortMenuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setSortMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSortMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [sortMenuOpen])

  return (
    <div className="sticky top-[76px] z-20 mb-6 bg-bjj-bg/96 py-2 backdrop-blur-md lg:top-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 group">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/22 transition-colors group-focus-within:text-[#f59e0b]" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Suche Techniken, Coaches oder Positionen..."
            className="w-full rounded-[1.45rem] bg-[#141923] py-3.5 pl-12 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-white/32 focus:ring-1 focus:ring-[#f59e0b]/35"
          />
        </div>

        <div className="flex items-center justify-end gap-1">
          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen((current) => !current)}
              title={`Sortierung: ${SORT_LABELS[sort]}`}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white/58 transition hover:bg-white/[0.04] hover:text-white"
            >
              <ArrowUpDown className="h-5 w-5" />
            </button>

            {sortMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.65rem)] min-w-[220px] rounded-[1.4rem] border border-white/10 bg-[#11161f] p-2 shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
                {SORT_OPTIONS.map((option) => {
                  const active = option === sort
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onSortChange(option)
                        setSortMenuOpen(false)
                      }}
                      className={`flex w-full items-center rounded-[1rem] px-3 py-3 text-left text-sm transition ${
                        active ? 'bg-[#f59e0b]/14 font-bold text-[#f59e0b]' : 'text-white/74 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {SORT_LABELS[option]}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onOpenFilters}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white/58 transition hover:bg-white/[0.04] hover:text-white lg:hidden"
            title="Filter anzeigen"
          >
            <Filter className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
