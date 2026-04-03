'use client'

import { Award, RotateCcw, Search, ShoppingBag, Sparkles } from 'lucide-react'
import type {
  CreatorPlan,
  TechniqueAvailability,
  TechniqueFilterOption,
  TechniqueFilters,
  TechniqueSort,
} from '@/components/technique-library/types'

const availabilityOptions: Array<{ id: TechniqueAvailability; label: string }> = [
  { id: 'all', label: 'Alle Nodes' },
  { id: 'available', label: 'Nur offen' },
  { id: 'locked', label: 'Nur locked' },
]

const sortOptions: Array<{ id: TechniqueSort; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'level-desc', label: 'Level hoch nach tief' },
  { id: 'level-asc', label: 'Level tief nach hoch' },
  { id: 'title-asc', label: 'Titel A-Z' },
]

type TechniqueLibraryFilterSidebarProps = {
  filters: TechniqueFilters
  filterConfig: TechniqueFilterOption[]
  fighterOptions: string[]
  resultCount: number
  totalCount: number
  activeFilterCount: number
  creatorPlans: CreatorPlan[]
  onQueryChange: (value: string) => void
  onStageChange: (value: TechniqueFilterOption['id']) => void
  onFighterChange: (value: string) => void
  onAvailabilityChange: (value: TechniqueAvailability) => void
  onSortChange: (value: TechniqueSort) => void
  onReset: () => void
  mode?: 'desktop' | 'mobile'
}

export function TechniqueLibraryFilterSidebar({
  filters,
  filterConfig,
  fighterOptions,
  resultCount,
  totalCount,
  activeFilterCount,
  creatorPlans,
  onQueryChange,
  onStageChange,
  onFighterChange,
  onAvailabilityChange,
  onSortChange,
  onReset,
  mode = 'desktop',
}: TechniqueLibraryFilterSidebarProps) {
  const panelClasses =
    mode === 'desktop'
      ? 'sticky top-6 rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(16,21,31,0.94),rgba(20,26,38,0.96))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]'
      : 'rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(16,21,31,0.98),rgba(20,26,38,0.98))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.38)]'

  return (
    <div className={panelClasses}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.34em] text-white/38">
            <Sparkles className="h-4 w-4 text-bjj-gold" />
            Filter Deck
          </div>
          <p className="mt-4 text-3xl font-black text-white">{resultCount}</p>
          <p className="mt-1 text-sm text-white/58">von {totalCount} Techniken sichtbar</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/62 transition hover:border-bjj-gold/30 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Aktive Filter</p>
        <p className="mt-3 text-2xl font-black text-bjj-gold">{activeFilterCount}</p>
        <p className="mt-1 text-xs text-white/50">Suche, Stage, Fighter, Verfuegbarkeit und Sortierung laufen hier zusammen.</p>
      </div>

      <div className="mt-5">
        <label htmlFor={`technique-search-${mode}`} className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
          Suche
        </label>
        <div className="relative mt-3">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id={`technique-search-${mode}`}
            placeholder="Technik, Fighter, Creator..."
            value={filters.query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#151d2a] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-bjj-gold/40"
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Stage</p>
        <div className="mt-3 space-y-2">
          {filterConfig.map((filter) => {
            const active = filters.stage === filter.id
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onStageChange(filter.id)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] transition ${
                  active
                    ? 'border-bjj-gold/40 bg-bjj-gold/12 text-bjj-gold'
                    : 'border-white/6 bg-white/[0.02] text-white/58 hover:border-white/12 hover:text-white'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] ${active ? 'bg-bjj-gold text-bjj-coal' : 'bg-white/5 text-white/45'}`}>
                  {filter.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
          <Award className="h-4 w-4 text-bjj-gold" />
          Fighter
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {fighterOptions.map((fighter) => {
            const active = filters.fighter === fighter
            return (
              <button
                key={fighter}
                type="button"
                onClick={() => onFighterChange(fighter)}
                className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                  active
                    ? 'border-bjj-gold/35 bg-bjj-gold/12 text-bjj-gold'
                    : 'border-white/8 bg-white/[0.03] text-white/55 hover:border-white/14 hover:text-white'
                }`}
              >
                {fighter === 'all' ? 'Alle' : fighter}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Verfuegbarkeit</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {availabilityOptions.map((option) => {
            const active = filters.availability === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onAvailabilityChange(option.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] transition ${
                  active
                    ? 'border-bjj-gold/40 bg-bjj-gold/12 text-bjj-gold'
                    : 'border-white/6 bg-white/[0.02] text-white/58 hover:border-white/12 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor={`technique-sort-${mode}`} className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
          Sortierung
        </label>
        <select
          id={`technique-sort-${mode}`}
          value={filters.sort}
          onChange={(event) => onSortChange(event.target.value as TechniqueSort)}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-[#151d2a] px-4 py-3 text-sm text-white outline-none transition focus:border-bjj-gold/40"
        >
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-[1.7rem] border border-white/6 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
          <ShoppingBag className="h-4 w-4 text-bjj-gold" />
          Creator Gameplans
        </div>
        <p className="mt-3 text-sm font-semibold text-white">Marketplace direkt in der Library</p>
        <p className="mt-2 text-sm text-white/55">Creator-Pakete bleiben sichtbar, ohne die Filtersteuerung zu verwaessern.</p>
        <div className="mt-4 space-y-3">
          {creatorPlans.slice(0, 2).map((plan) => (
            <div key={plan.id} className="rounded-2xl border border-white/6 bg-black/15 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">{plan.title}</p>
                <span className="rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-bjj-gold">
                  {plan.price}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/35">{plan.fighter}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
