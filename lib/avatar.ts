export type GiMode = 'gi' | 'nogi'

export type AvatarData = {
  userId: string
  displayName: string
  archetype: string
  archetypeTitle: string
  level: number
  giMode: GiMode
  currentFocusNode: string
  lastProgressNode?: string | null
  rankVisual: string
  avatarStyleVariant: string
  levelMeaning: string
  progressReason: string
}

type FocusState = 'identity' | 'entry' | 'connection' | 'control' | 'finish'

type ArchetypeAvatarConfig = {
  label: string
  bodyScaleX: number
  bodyScaleY: number
  shoulder: number
  hip: number
  armSpread: number
  legSpread: number
  posture: number
  silhouette: string
  presence: string
}

type FocusPose = {
  postureShift: number
  armSpreadShift: number
  legSpreadShift: number
  hipShiftY: number
  shoulderTilt: number
  label: string
}

const ARCHETYPE_AVATAR_CONFIG: Record<string, ArchetypeAvatarConfig> = {
  'long-flexible-guard': {
    label: 'Long Guard Player',
    bodyScaleX: 0.88,
    bodyScaleY: 1.12,
    shoulder: 50,
    hip: 32,
    armSpread: 26,
    legSpread: 28,
    posture: -7,
    silhouette: 'lange, offene Guard-Haltung',
    presence: 'locker, mobil, guard-orientiert',
  },
  'long-explosive-scrambler': {
    label: 'Long Scrambler',
    bodyScaleX: 0.9,
    bodyScaleY: 1.1,
    shoulder: 51,
    hip: 33,
    armSpread: 21,
    legSpread: 22,
    posture: 12,
    silhouette: 'lange aktive Scramble-Silhouette',
    presence: 'vorwaerts geneigt und reaktionsbereit',
  },
  'compact-explosive-wrestler': {
    label: 'Compact Wrestler',
    bodyScaleX: 1.12,
    bodyScaleY: 0.95,
    shoulder: 60,
    hip: 40,
    armSpread: 12,
    legSpread: 15,
    posture: 16,
    silhouette: 'breit, tief, bereit zu schiessen',
    presence: 'kompakt mit aggressivem Vorwaertsdruck',
  },
  'compact-pressure-passer': {
    label: 'Pressure Passer',
    bodyScaleX: 1.1,
    bodyScaleY: 0.98,
    shoulder: 62,
    hip: 42,
    armSpread: 10,
    legSpread: 12,
    posture: 8,
    silhouette: 'stabiler kompakter Passer',
    presence: 'ruhig, dominant, druckvoll',
  },
  'heavy-pressure-grappler': {
    label: 'Heavy Pressure Grappler',
    bodyScaleX: 1.18,
    bodyScaleY: 0.97,
    shoulder: 66,
    hip: 46,
    armSpread: 8,
    legSpread: 10,
    posture: 4,
    silhouette: 'massiv mit niedrigem Schwerpunkt',
    presence: 'schwer, unbewegt, sehr stabil',
  },
  'flexible-guard-technician': {
    label: 'Guard Technician',
    bodyScaleX: 0.86,
    bodyScaleY: 1.14,
    shoulder: 47,
    hip: 30,
    armSpread: 30,
    legSpread: 30,
    posture: -9,
    silhouette: 'leichte agile Guard-Silhouette',
    presence: 'technisch, modern, beweglich',
  },
}

const FOCUS_POSES: Record<FocusState, FocusPose> = {
  identity: {
    postureShift: -2,
    armSpreadShift: 4,
    legSpreadShift: 3,
    hipShiftY: 0,
    shoulderTilt: -2,
    label: 'A-Game aufbauen',
  },
  entry: {
    postureShift: 8,
    armSpreadShift: -2,
    legSpreadShift: -4,
    hipShiftY: 2,
    shoulderTilt: 4,
    label: 'in den Kontakt ziehen',
  },
  connection: {
    postureShift: -4,
    armSpreadShift: 1,
    legSpreadShift: 1,
    hipShiftY: -1,
    shoulderTilt: -1,
    label: 'Connection sichern',
  },
  control: {
    postureShift: 4,
    armSpreadShift: -5,
    legSpreadShift: -6,
    hipShiftY: 3,
    shoulderTilt: 3,
    label: 'Druck und Kontrolle halten',
  },
  finish: {
    postureShift: 6,
    armSpreadShift: -8,
    legSpreadShift: -2,
    hipShiftY: 1,
    shoulderTilt: 6,
    label: 'Finish schliessen',
  },
}

const RANK_VISUALS = [
  {
    maxLevel: 1,
    name: 'White',
    belt: '#f1f0eb',
    sleeve: '#dad4ca',
    accent: '#ede7dc',
    noGiLabel: 'White Rank',
    noGiAccent: '#d8d2c7',
  },
  {
    maxLevel: 2,
    name: 'Blue',
    belt: '#446ea8',
    sleeve: '#5a87c4',
    accent: '#759bd0',
    noGiLabel: 'Blue Rank',
    noGiAccent: '#6a95cf',
  },
  {
    maxLevel: 3,
    name: 'Purple',
    belt: '#7a57aa',
    sleeve: '#8c6bc0',
    accent: '#a186d0',
    noGiLabel: 'Purple Rank',
    noGiAccent: '#9b79cb',
  },
  {
    maxLevel: 4,
    name: 'Brown',
    belt: '#6d4c38',
    sleeve: '#8b6248',
    accent: '#a67b5d',
    noGiLabel: 'Brown Rank',
    noGiAccent: '#92664c',
  },
  {
    maxLevel: 5,
    name: 'Black',
    belt: '#111319',
    sleeve: '#252932',
    accent: '#e8dcc0',
    noGiLabel: 'Black Rank',
    noGiAccent: '#d8c8a6',
  },
]

export function getRankVisual(level: number) {
  return RANK_VISUALS.find((entry) => level <= entry.maxLevel) ?? RANK_VISUALS[RANK_VISUALS.length - 1]
}

export function getAvatarConfig(archetype: string) {
  return ARCHETYPE_AVATAR_CONFIG[archetype] ?? ARCHETYPE_AVATAR_CONFIG['long-flexible-guard']
}

export function getFocusState(currentFocusNode: string) {
  const label = currentFocusNode.toLowerCase()

  if (label.includes('entry') || label.includes('guard identity')) {
    return label.includes('identity') ? 'identity' : 'entry'
  }

  if (label.includes('connection')) {
    return 'connection'
  }

  if (label.includes('control') || label.includes('off-balance') || label.includes('back')) {
    return 'control'
  }

  if (label.includes('finish') || label.includes('rnc') || label.includes('choke')) {
    return 'finish'
  }

  return 'identity'
}

export function getFocusPose(currentFocusNode: string) {
  return FOCUS_POSES[getFocusState(currentFocusNode)]
}

export function getAvatarData(input: {
  userId: string
  displayName: string
  archetype: string
  level: number
  giMode: GiMode
  currentFocusNode: string
  lastProgressNode?: string | null
  levelMeaning: string
}): AvatarData {
  const rankVisual = getRankVisual(input.level)
  const avatarConfig = getAvatarConfig(input.archetype)
  const lastProgressNode = input.lastProgressNode ?? null

  return {
    userId: input.userId,
    displayName: input.displayName,
    archetype: input.archetype,
    archetypeTitle: avatarConfig.label,
    level: input.level,
    giMode: input.giMode,
    currentFocusNode: input.currentFocusNode,
    lastProgressNode,
    rankVisual: input.giMode === 'gi' ? rankVisual.name : rankVisual.noGiLabel,
    avatarStyleVariant: avatarConfig.silhouette,
    levelMeaning: input.levelMeaning,
    progressReason: lastProgressNode
      ? `Node abgeschlossen -> Level gestiegen: ${lastProgressNode}`
      : 'Naechster Schritt bestimmt deinen Level',
  }
}
