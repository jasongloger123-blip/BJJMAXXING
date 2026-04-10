'use client'

import { getTechniqueStyleLabel, type TechniqueStyle } from '@/lib/technique-style'

type TechniqueStyleToggleProps = {
  value: TechniqueStyle
  onChange: (value: TechniqueStyle) => void
  className?: string
}

export function TechniqueStyleToggle({ value, onChange, className = '' }: TechniqueStyleToggleProps) {
  return (
    <div className={`inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1 ${className}`.trim()}>
      {(['gi', 'nogi'] as TechniqueStyle[]).map((style) => {
        const active = style === value

        return (
          <button
            key={style}
            type="button"
            onClick={() => onChange(style)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
              active ? 'bg-bjj-gold text-black shadow-[0_8px_20px_rgba(240,171,60,0.28)]' : 'text-white/60 hover:text-white'
            }`}
          >
            {getTechniqueStyleLabel(style)}
          </button>
        )
      })}
    </div>
  )
}
