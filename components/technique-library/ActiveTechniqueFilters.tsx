'use client'

import { X } from 'lucide-react'
import type { ActiveTechniqueFilter } from '@/components/technique-library/types'

type ActiveTechniqueFiltersProps = {
  chips: ActiveTechniqueFilter[]
  onRemove: (id: string) => void
  onReset: () => void
}

export function ActiveTechniqueFilters({ chips, onRemove, onReset }: ActiveTechniqueFiltersProps) {
  if (chips.length === 0) {
    return null
  }

  return (
    <section className="mt-6 rounded-[1.8rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Aktive Filter</p>
          <p className="mt-2 text-sm text-white/55">Ein Klick entfernt einzelne Filter, Reset leert das ganze Deck.</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-white/62 transition hover:border-bjj-gold/30 hover:text-white"
        >
          Alles zuruecksetzen
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onRemove(chip.id)}
            className="inline-flex items-center gap-2 rounded-full border border-bjj-gold/25 bg-bjj-gold/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-bjj-gold transition hover:bg-bjj-gold/18"
          >
            {chip.label}
            <X className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </section>
  )
}
