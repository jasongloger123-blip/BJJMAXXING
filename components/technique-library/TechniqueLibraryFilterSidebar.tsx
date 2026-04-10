'use client'

import { useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import type {
  TechniqueFilterGroupOption,
  TechniqueFilters,
  TechniqueStage,
} from '@/components/technique-library/types'

type TechniqueLibraryFilterSidebarProps = {
  filters: TechniqueFilters
  categoryOptions: TechniqueFilterGroupOption<TechniqueStage>[]
  difficultyOptions: TechniqueFilterGroupOption<string>[]
  styleOptions: TechniqueFilterGroupOption<string>[]
  coachOptions: TechniqueFilterGroupOption<string>[]
  onToggleCategory: (value: TechniqueStage) => void
  onToggleDifficulty: (value: string) => void
  onToggleStyle: (value: string) => void
  onToggleCoach: (value: string) => void
  onReset: () => void
  mode?: 'desktop' | 'mobile'
}

type FilterSectionProps<T extends string> = {
  title: string
  options: TechniqueFilterGroupOption<T>[]
  values: string[]
  open: boolean
  onToggleOpen: () => void
  onToggleValue: (value: T) => void
}

function FilterSection<T extends string>({
  title,
  options,
  values,
  open,
  onToggleOpen,
  onToggleValue,
}: FilterSectionProps<T>) {
  return (
    <div className="border-b border-white/[0.06] pb-3">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <span className="text-[11px] font-black uppercase tracking-[0.24em] text-white/56">{title}</span>
        <ChevronDown className={`h-4 w-4 text-white/36 transition-transform ${open ? 'rotate-180 text-[#f59e0b]' : ''}`} />
      </button>

      {open ? (
        <div className="mt-3 space-y-2.5 pb-1">
          {options.map((option) => {
            const checked = values.includes(option.id)
            return (
              <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-white/[0.03]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleValue(option.id)}
                  className="h-[17px] w-[17px] rounded border border-white/20 bg-transparent accent-[#f59e0b]"
                />
                <span className={`text-sm transition-colors ${checked ? 'font-bold text-[#f59e0b]' : 'text-white/68'}`}>{option.label}</span>
                {option.count !== undefined ? <span className="ml-auto text-[10px] font-bold text-white/24">{option.count}</span> : null}
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function TechniqueLibraryFilterSidebar({
  filters,
  categoryOptions,
  difficultyOptions,
  styleOptions,
  coachOptions,
  onToggleCategory,
  onToggleDifficulty,
  onToggleStyle,
  onToggleCoach,
  onReset,
  mode = 'desktop',
}: TechniqueLibraryFilterSidebarProps) {
  const [openSections, setOpenSections] = useState({
    category: false,
    difficulty: false,
    style: false,
    coach: false,
  })

  const containerClasses =
    mode === 'desktop'
      ? 'sticky top-[88px] flex flex-col gap-4'
      : 'flex flex-col gap-4'

  const scrollClasses =
    mode === 'desktop'
      ? 'space-y-4'
      : 'max-h-[calc(100vh-290px)] space-y-4 overflow-y-auto pr-2'

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">Filter</h2>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/38 transition hover:text-[#f59e0b]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Zuruecksetzen
        </button>
      </div>

      <div className={scrollClasses}>
        <FilterSection
          title="Kategorie"
          options={categoryOptions}
          values={filters.stages}
          open={openSections.category}
          onToggleOpen={() => setOpenSections((current) => ({ ...current, category: !current.category }))}
          onToggleValue={onToggleCategory}
        />
        <FilterSection
          title="Schwierigkeit"
          options={difficultyOptions}
          values={filters.difficulties}
          open={openSections.difficulty}
          onToggleOpen={() => setOpenSections((current) => ({ ...current, difficulty: !current.difficulty }))}
          onToggleValue={onToggleDifficulty}
        />
        <FilterSection
          title="Stil"
          options={styleOptions}
          values={filters.styles}
          open={openSections.style}
          onToggleOpen={() => setOpenSections((current) => ({ ...current, style: !current.style }))}
          onToggleValue={onToggleStyle}
        />
        <FilterSection
          title="Coach"
          options={coachOptions}
          values={filters.fighters}
          open={openSections.coach}
          onToggleOpen={() => setOpenSections((current) => ({ ...current, coach: !current.coach }))}
          onToggleValue={onToggleCoach}
        />
      </div>
    </div>
  )
}
