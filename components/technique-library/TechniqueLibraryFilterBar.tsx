'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, RotateCcw, Search, X } from 'lucide-react'
import type {
  TechniqueFilterGroupOption,
  TechniqueFilters,
  TechniqueStage,
  TechniqueSort,
} from '@/components/technique-library/types'

type TechniqueLibraryFilterBarProps = {
  filters: TechniqueFilters
  query: string
  sort: TechniqueSort
  categoryOptions: TechniqueFilterGroupOption<TechniqueStage>[]
  styleOptions: TechniqueFilterGroupOption<string>[]
  coachOptions: TechniqueFilterGroupOption<string>[]
  onQueryChange: (value: string) => void
  onToggleCategory: (value: TechniqueStage) => void
  onToggleStyle: (value: string) => void
  onToggleCoach: (value: string) => void
  onSortChange: (value: TechniqueSort) => void
  onReset: () => void
}

const SORT_LABELS: Record<TechniqueSort, string> = {
  featured: 'Featured',
  'level-desc': 'Level ↓',
  'level-asc': 'Level ↑',
  'title-asc': 'Titel A-Z',
}

function FilterDropdown<T extends string>({
  label,
  options,
  values,
  onToggle,
}: {
  label: string
  options: TechniqueFilterGroupOption<T>[]
  values: string[]
  onToggle: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedCount = values.length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition ${
          selectedCount > 0
            ? 'border-bjj-gold/40 bg-bjj-gold/10 text-bjj-gold'
            : 'border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white'
        }`}
      >
        {label}
        {selectedCount > 0 && (
          <span className="ml-1 rounded-full bg-bjj-gold/20 px-1.5 py-0.5 text-[10px]">{selectedCount}</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-white/10 bg-[#141923] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
          <div className="max-h-[280px] space-y-1 overflow-y-auto">
            {options.map((option) => {
              const checked = values.includes(option.id)
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(option.id)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent accent-bjj-gold"
                  />
                  <span className={`text-sm ${checked ? 'font-semibold text-white' : 'text-white/72'}`}>
                    {option.label}
                  </span>
                  {option.count !== undefined && (
                    <span className="ml-auto text-[10px] text-white/40">{option.count}</span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function TechniqueLibraryFilterBar({
  filters,
  query,
  sort,
  categoryOptions,
  styleOptions,
  coachOptions,
  onQueryChange,
  onToggleCategory,
  onToggleStyle,
  onToggleCoach,
  onSortChange,
  onReset,
}: TechniqueLibraryFilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sortOpen) return
    function handleClick(e: MouseEvent) {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [sortOpen])

  const activeFiltersCount =
    filters.stages.length +
    filters.styles.length +
    filters.fighters.length

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md group">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-bjj-gold" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Suche Techniken, Coaches..."
            className="w-full rounded-full border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-bjj-gold/40 focus:bg-white/[0.05]"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Kategorie"
            options={categoryOptions}
            values={filters.stages}
            onToggle={onToggleCategory}
          />
          <FilterDropdown
            label="Stil (Gi/No-Gi)"
            options={styleOptions}
            values={filters.styles}
            onToggle={onToggleStyle}
          />
          <FilterDropdown
            label="Coach"
            options={coachOptions}
            values={filters.fighters}
            onToggle={onToggleCoach}
          />

          {/* Sort Dropdown */}
          <div ref={sortRef} className="relative">
            <button
              type="button"
              onClick={() => setSortOpen(!sortOpen)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white/72 transition hover:border-white/20 hover:text-white"
            >
              {SORT_LABELS[sort]}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>

            {sortOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[160px] rounded-xl border border-white/10 bg-[#141923] p-2 shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
                {(['featured', 'level-desc', 'level-asc', 'title-asc'] as TechniqueSort[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onSortChange(option)
                      setSortOpen(false)
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      sort === option
                        ? 'bg-bjj-gold/14 font-semibold text-bjj-gold'
                        : 'text-white/72 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    {SORT_LABELS[option]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reset */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/40 transition hover:text-bjj-gold"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </button>
        )}
      </div>

      {/* Active Filter Tags */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.stages.map((stage) => (
            <span
              key={stage}
              className="inline-flex items-center gap-1.5 rounded-full border border-bjj-gold/30 bg-bjj-gold/10 px-3 py-1.5 text-xs font-medium text-bjj-gold"
            >
              {stage}
              <button
                type="button"
                onClick={() => onToggleCategory(stage)}
                className="rounded-full p-0.5 hover:bg-bjj-gold/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filters.styles.map((style) => (
            <span
              key={style}
              className="inline-flex items-center gap-1.5 rounded-full border border-bjj-gold/30 bg-bjj-gold/10 px-3 py-1.5 text-xs font-medium text-bjj-gold"
            >
              {style}
              <button
                type="button"
                onClick={() => onToggleStyle(style)}
                className="rounded-full p-0.5 hover:bg-bjj-gold/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filters.fighters.map((fighter) => (
            <span
              key={fighter}
              className="inline-flex items-center gap-1.5 rounded-full border border-bjj-gold/30 bg-bjj-gold/10 px-3 py-1.5 text-xs font-medium text-bjj-gold"
            >
              {fighter}
              <button
                type="button"
                onClick={() => onToggleCoach(fighter)}
                className="rounded-full p-0.5 hover:bg-bjj-gold/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
