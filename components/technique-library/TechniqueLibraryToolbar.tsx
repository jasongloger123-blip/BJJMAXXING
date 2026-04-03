'use client'

import { ListFilter, SlidersHorizontal } from 'lucide-react'

type TechniqueLibraryToolbarProps = {
  resultCount: number
  totalCount: number
  activeFilterCount: number
  onOpenFilters: () => void
}

export function TechniqueLibraryToolbar({
  resultCount,
  totalCount,
  activeFilterCount,
  onOpenFilters,
}: TechniqueLibraryToolbarProps) {
  return (
    <header className="flex flex-col gap-6 border-b border-white/5 pb-6 pt-2">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
            <span className="h-2 w-2 rounded-full bg-bjj-gold" />
            Resource Database
          </div>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-tight text-white md:text-4xl">Technique Library</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/55">
            Techniken, Fighter-Sortierung und kaufbare Creator-Gameplans an einem Ort, jetzt mit echtem Filter-Deck statt verstreuten Controls.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
          <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/38">Resultate</p>
            <p className="mt-3 text-3xl font-black text-white">{resultCount}</p>
            <p className="mt-1 text-sm text-white/52">von {totalCount} Techniken sichtbar</p>
          </div>
          <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/38">Filter Loadout</p>
            <p className="mt-3 text-3xl font-black text-bjj-gold">{activeFilterCount}</p>
            <p className="mt-1 text-sm text-white/52">aktive Modifikatoren auf die Library</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center gap-2 rounded-2xl border border-bjj-gold/30 bg-bjj-gold/12 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-bjj-gold transition hover:border-bjj-gold/45 hover:bg-bjj-gold/18"
        >
          <ListFilter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-bjj-gold px-2 py-0.5 text-[10px] text-bjj-coal">{activeFilterCount}</span>
          ) : null}
        </button>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white/55">
          <SlidersHorizontal className="h-4 w-4 text-white/35" />
          Sidebar Filters Mobile
        </div>
      </div>
    </header>
  )
}
