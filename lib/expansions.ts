export type ExpansionNode = {
  id: string
  title: string
  type: 'entry' | 'detail' | 'option' | 'finish'
}

export type ExpansionPath = {
  id: string
  title: string
  anchorNodeId: string
  anchorLabel: string
  summary: string
  benefit: string
  difficulty: 'leicht' | 'mittel' | 'fortgeschritten'
  recommendedLevel: number
  reason: string
  idealWhen: string[]
  miniTree: ExpansionNode[]
}

export const EXPANSION_PATHS: ExpansionPath[] = [
  {
    id: 'k-guard-path',
    title: 'K-Guard Path',
    anchorNodeId: 'node-5-dlr-off-balance',
    anchorLabel: 'aus DLR Off-Balance',
    summary: 'Mehr Angriffe aus deinem bestehenden Guard-Flow.',
    benefit: 'Wenn dein Standard-Backtake nicht sofort aufgeht, bekommst du einen zweiten sauberen Angriffspfad.',
    difficulty: 'mittel',
    recommendedLevel: 5,
    reason: 'Erweitert deine Off-Balance-Phase, ohne deinen Hauptplan zu ersetzen.',
    idealWhen: ['Gegner zieht das Bein weg', 'Du brauchst mehr Angriff statt nur Kontrolle', 'Du willst Backtake und Triangle offen halten'],
    miniTree: [
      { id: 'dlr', title: 'DLR Off-Balance', type: 'entry' },
      { id: 'kguard-entry', title: 'K-Guard Entry', type: 'detail' },
      { id: 'triangle', title: 'Triangle Threat', type: 'option' },
      { id: 'leg-entry', title: 'Leg Entry', type: 'option' },
      { id: 'back-exposure', title: 'Back Exposure', type: 'finish' },
    ],
  },
  {
    id: 'berimbolo-path',
    title: 'Berimbolo Path',
    anchorNodeId: 'node-5-dlr-off-balance',
    anchorLabel: 'aus DLR Off-Balance',
    summary: 'Rueckenfenster ueber Rotation statt nur ueber direkten Pull.',
    benefit: 'Sauberer zweiter Backtake-Weg fuer flexible Guard-Player.',
    difficulty: 'fortgeschritten',
    recommendedLevel: 5,
    reason: 'Bleibt am gleichen Off-Balance-Anker, fuegt aber einen moderneren Angle-Path hinzu.',
    idealWhen: ['Gegner steht schwer auf den Fuessen', 'Das Rueckenfenster ist kurz offen', 'Du willst Rotation statt frontalen Sweep'],
    miniTree: [
      { id: 'dlr-entry', title: 'DLR Angle', type: 'entry' },
      { id: 'bolo-entry', title: 'Berimbolo Entry', type: 'detail' },
      { id: 'hip-line', title: 'Hip Line Chase', type: 'option' },
      { id: 'seatbelt', title: 'Seatbelt Catch', type: 'finish' },
    ],
  },
  {
    id: 'body-triangle-control',
    title: 'Body Triangle Control',
    anchorNodeId: 'node-8-back-control',
    anchorLabel: 'von Back Control',
    summary: 'Mehr Stabilitaet, bevor du auf den Finish gehst.',
    benefit: 'Du verlierst den Ruecken weniger oft und kontrollierst ruhig statt hektisch.',
    difficulty: 'leicht',
    recommendedLevel: 5,
    reason: 'Vertieft nicht den Hauptpfad, sondern macht deine Back-Control robuster.',
    idealWhen: ['Gegner dreht viel', 'Du verlierst oft die Hooks', 'Du willst erst Kontrolle, dann Submission'],
    miniTree: [
      { id: 'back-control', title: 'Back Control', type: 'entry' },
      { id: 'body-triangle', title: 'Body Triangle', type: 'detail' },
      { id: 'hand-fight', title: 'Hand Fight Win', type: 'option' },
      { id: 'rnc-return', title: 'Rueckkehr zum RNC', type: 'finish' },
    ],
  },
  {
    id: 'reverse-triangle-finish',
    title: 'Reverse Triangle Finish',
    anchorNodeId: 'node-8-back-control',
    anchorLabel: 'von Back Control',
    summary: 'Alternative Finish-Option, wenn der Standard-Choke blockiert ist.',
    benefit: 'Du hast nach stabiler Back Control eine klare zweite Finish-Idee.',
    difficulty: 'mittel',
    recommendedLevel: 5,
    reason: 'Die Erweiterung bleibt am gleichen Hauptanker und fuehlt sich wie ein Upgrade deines Systems an.',
    idealWhen: ['Der Gegner verteidigt den Choking Arm', 'Du bekommst Beinposition ueber die Schulter', 'Du willst Finish-Druck ohne Hektik'],
    miniTree: [
      { id: 'back-control-root', title: 'Back Control', type: 'entry' },
      { id: 'trap-arm', title: 'Arm Trap', type: 'detail' },
      { id: 'leg-thread', title: 'Leg Thread', type: 'option' },
      { id: 'reverse-triangle', title: 'Reverse Triangle', type: 'finish' },
    ],
  },
]

export function getExpansionById(id: string | null | undefined) {
  return EXPANSION_PATHS.find((path) => path.id === id) ?? null
}

export function getExpansionsForNode(nodeId: string) {
  return EXPANSION_PATHS.filter((path) => path.anchorNodeId === nodeId)
}
