import type { GiMode } from '@/lib/avatar'

type AvatarModeSwitchProps = {
  value: GiMode
  onChange: (value: GiMode) => void
}

export function AvatarModeSwitch({ value, onChange }: AvatarModeSwitchProps) {
  return (
    <div className="inline-flex rounded-full border border-bjj-border bg-bjj-surface p-1">
      {(['gi', 'nogi'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors ${
            value === mode ? 'bg-bjj-gold text-bjj-coal' : 'text-bjj-muted hover:text-bjj-text'
          }`}
        >
          {mode === 'gi' ? 'Gi' : 'No-Gi'}
        </button>
      ))}
    </div>
  )
}
