import type { Archetype } from '@/lib/archetypes'

type ArchetypeCardProps = {
  archetype: Archetype
  highlight?: boolean
  compact?: boolean
}

export function ArchetypeCard({ archetype, highlight = false, compact = false }: ArchetypeCardProps) {
  return (
    <div
      className={`rounded-[2rem] border bg-bjj-card p-6 shadow-card ${
        highlight ? 'border-bjj-gold/40 shadow-orange-glow' : 'border-bjj-border'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 text-lg font-black text-bjj-gold">
            {archetype.icon}
          </div>
          <h2 className="mt-4 font-display text-3xl font-black">{archetype.name}</h2>
          <p className="mt-2 text-sm font-semibold text-bjj-gold">{archetype.tagline}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-bjj-muted">{archetype.description}</p>

      {!compact && (
        <>
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-muted">Staerken</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {archetype.strengths.map((strength) => (
                <span key={strength} className="rounded-full border border-bjj-border bg-bjj-surface px-3 py-1 text-xs">
                  {strength}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-muted">Win Path</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {archetype.winPath.map((step) => (
                <span key={step} className="rounded-full border border-bjj-gold/30 bg-bjj-gold/10 px-3 py-1 text-xs text-bjj-gold">
                  {step}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
