type ProgressBarProps = {
  current: number
  total: number
  label?: string
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-bjj-muted">{label ?? 'Fortschritt'}</span>
        <span className="font-bold text-bjj-orange">
          {current}/{total} ({percentage}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bjj-surface">
        <div className="h-full rounded-full bg-bjj-orange transition-all duration-500" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
