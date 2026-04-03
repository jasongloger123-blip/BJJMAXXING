import { getAvatarConfig, getAvatarData, getFocusPose, getRankVisual, type GiMode } from '@/lib/avatar'

type PassiveAvatarProps = {
  userId?: string
  displayName?: string
  archetype: string
  level: number
  giMode: GiMode
  currentFocusNode: string
  lastProgressNode?: string | null
  levelMeaning?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { frame: 'h-44 w-36', label: 'text-xs', title: 'text-sm' },
  md: { frame: 'h-56 w-44', label: 'text-sm', title: 'text-base' },
  lg: { frame: 'h-80 w-60', label: 'text-base', title: 'text-lg' },
}

export function PassiveAvatar({
  userId = 'local-user',
  displayName = 'BJJ Athlete',
  archetype,
  level,
  giMode,
  currentFocusNode,
  lastProgressNode,
  levelMeaning,
  size = 'md',
}: PassiveAvatarProps) {
  const avatar = getAvatarConfig(archetype)
  const rank = getRankVisual(level)
  const focusPose = getFocusPose(currentFocusNode)
  const sizing = sizeMap[size]
  const avatarData = getAvatarData({
    userId,
    displayName,
    archetype,
    level,
    giMode,
    currentFocusNode,
    lastProgressNode,
    levelMeaning: levelMeaning ?? `Level ${level} - ${currentFocusNode}`,
  })

  const torsoFill = giMode === 'gi' ? '#e7e1d8' : '#1b1f29'
  const sleeveFill = giMode === 'gi' ? '#d7d1c7' : rank.sleeve
  const pantsFill = giMode === 'gi' ? '#c8c4bc' : '#111319'
  const skinFill = '#b38363'
  const posture = avatar.posture + focusPose.postureShift
  const armSpread = Math.max(6, avatar.armSpread + focusPose.armSpreadShift)
  const legSpread = Math.max(8, avatar.legSpread + focusPose.legSpreadShift)
  const shoulder = avatar.shoulder + focusPose.shoulderTilt
  const hipY = 122 + focusPose.hipShiftY
  const noGiMark = giMode === 'nogi'

  return (
    <div className="rounded-[2rem] border border-bjj-border bg-bjj-panel/95 p-4 shadow-card">
      <div className={`relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-bjj-surface ${sizing.frame}`}>
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(214,150,76,0.3),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(10,10,12,0.7))]" />
        <div className="absolute left-3 top-3 rounded-full border border-bjj-gold/20 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-bjj-gold">
          {focusPose.label}
        </div>

        <svg viewBox="0 0 180 240" className="absolute inset-0 h-full w-full">
          <g transform={`translate(90 ${hipY}) rotate(${posture}) scale(${avatar.bodyScaleX} ${avatar.bodyScaleY})`}>
            <ellipse cx="0" cy="80" rx={avatar.hip + 30} ry="20" fill="rgba(0,0,0,0.26)" />
            <circle cx="0" cy="-60" r="21" fill={skinFill} />
            <path
              d={`M-${shoulder} -26 Q0 -48 ${shoulder} -26 L${avatar.hip} 26 Q0 52 -${avatar.hip} 26 Z`}
              fill={torsoFill}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2"
            />
            <path
              d={`M-${shoulder - 10} -18 Q0 -4 ${shoulder - 10} -18`}
              fill="none"
              stroke="rgba(0,0,0,0.18)"
              strokeWidth="4"
            />
            <rect x={-armSpread - 28} y="-22" width="22" height="72" rx="11" fill={sleeveFill} transform={`rotate(${-armSpread})`} />
            <rect x={armSpread + 6} y="-24" width="22" height="76" rx="11" fill={sleeveFill} transform={`rotate(${armSpread})`} />
            <rect x="-34" y="22" width="68" height="11" rx="6" fill={rank.belt} />
            <rect x="-8" y="23" width="16" height="9" rx="4" fill={rank.accent} />
            <rect x={-legSpread - 12} y="38" width="24" height="88" rx="12" fill={pantsFill} transform={`rotate(${-legSpread})`} />
            <rect x={legSpread - 12} y="38" width="24" height="88" rx="12" fill={pantsFill} transform={`rotate(${legSpread})`} />
            {noGiMark && (
              <>
                <rect x={-armSpread - 26} y="0" width="18" height="9" rx="4" fill={rank.noGiAccent} transform={`rotate(${-armSpread})`} />
                <rect x={armSpread + 8} y="0" width="18" height="9" rx="4" fill={rank.noGiAccent} transform={`rotate(${armSpread})`} />
              </>
            )}
          </g>
        </svg>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-bjj-gold/25 bg-bjj-gold/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-bjj-gold">
            {avatarData.rankVisual} {giMode === 'gi' ? 'Gi' : 'No-Gi'}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bjj-muted">Level {level}</span>
        </div>

        <div>
          <p className={`font-display font-black text-bjj-text ${sizing.title}`}>{avatarData.displayName}</p>
          <p className={`font-semibold text-bjj-gold ${sizing.label}`}>{avatarData.archetypeTitle}</p>
          <p className={`text-bjj-muted ${sizing.label}`}>{avatar.silhouette}</p>
          <p className={`text-bjj-muted/80 ${sizing.label}`}>{avatar.presence}</p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/15 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bjj-muted">Aktuell</p>
          <p className={`${sizing.label} mt-1 font-semibold text-bjj-text`}>{currentFocusNode}</p>
          <p className={`${sizing.label} mt-2 text-bjj-muted`}>{avatarData.levelMeaning}</p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/15 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bjj-muted">Letzter Fortschritt</p>
          <p className={`${sizing.label} mt-1 text-bjj-text`}>
            {lastProgressNode ? `${lastProgressNode} geschafft` : 'Noch kein Node abgeschlossen'}
          </p>
          <p className={`${sizing.label} mt-2 text-bjj-muted`}>{avatarData.progressReason}</p>
        </div>
      </div>
    </div>
  )
}
