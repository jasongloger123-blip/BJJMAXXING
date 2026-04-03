export type Archetype = {
  id: string
  name: string
  tagline: string
  description: string
  strengths: string[]
  weaknesses: string[]
  primarySystems: string[]
  topStyle: string
  winPath: string[]
  color: string
  icon: string
}

export type Question = {
  id: string
  question: string
  helper?: string
  options: {
    label: string
    description: string
    icon?: string
    scores: Partial<Record<string, number>>
  }[]
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'long-flexible-guard',
    name: 'Long Flexible Guard Player',
    tagline: 'Guard -> Off-Balance -> Backtake -> RNC',
    description:
      'Du gewinnst ueber Guard-Retention, Winkel, Off-Balancing und mobile Backtakes. Lange Hebel und Beweglichkeit machen dich von unten gefaehrlich.',
    strengths: ['Guard Retention', 'Winkelarbeit', 'Backtakes', 'Off-Balancing', 'Leg Entries'],
    weaknesses: ['Direkter Druck', 'Crossface Control', 'Kompakte Wrestler'],
    primarySystems: ['De La Riva', 'K-Guard', 'Berimbolo', 'Triangle', 'Crab Ride'],
    topStyle: 'Speed Passing',
    winPath: ['Guard', 'Off-Balance', 'Backtake', 'RNC'],
    color: '#f97316',
    icon: 'LF',
  },
  {
    id: 'long-explosive-scrambler',
    name: 'Long Explosive Scrambler',
    tagline: 'Scramble -> Back -> Submission',
    description: 'Du lebst in Uebergaengen, Wrestle-Ups und dynamischen Entries.',
    strengths: ['Scrambles', 'Backtakes', 'Single Leg', 'Front Headlock'],
    weaknesses: ['Statisches Top Game', 'Geduldiger Druck'],
    primarySystems: ['Arm Drag', 'Single Leg', 'Wrestle-Up'],
    topStyle: 'Movement Passing',
    winPath: ['Scramble', 'Back', 'Submission'],
    color: '#3b82f6',
    icon: 'LS',
  },
  {
    id: 'compact-explosive-wrestler',
    name: 'Compact Explosive Wrestler',
    tagline: 'Shot -> Top -> Ride -> Finish',
    description: 'Du dominierst mit aggressiven Takedowns, Vorwaertsdruck und Ride Control.',
    strengths: ['Takedowns', 'Top Control', 'Head Position'],
    weaknesses: ['Invertierte Guards', 'Leg Entanglements'],
    primarySystems: ['Double Leg', 'Single Leg', 'Snapdown'],
    topStyle: 'Pressure Passing',
    winPath: ['Shot', 'Top Control', 'Ride', 'Submission'],
    color: '#ef4444',
    icon: 'CW',
  },
  {
    id: 'compact-pressure-passer',
    name: 'Compact Pressure Passer',
    tagline: 'Pass -> Mount -> Submission',
    description: 'Kontrolle ist deine Sprache. Du passt mit Koerperdruck und haeltst Positionen sauber.',
    strengths: ['Guard Passing', 'Crossface', 'Half Guard Smash'],
    weaknesses: ['Mobile Open Guards', 'Berimbolo-Spieler'],
    primarySystems: ['Bodylock', 'Over-Under', 'Knee Cut'],
    topStyle: 'Pressure Passing',
    winPath: ['Pass', 'Mount', 'Submission'],
    color: '#8b5cf6',
    icon: 'PP',
  },
  {
    id: 'heavy-pressure-grappler',
    name: 'Heavy Pressure Grappler',
    tagline: 'Top Control -> Isolieren -> Erdruecken',
    description: 'Du gewinnst ueber Gewicht, Stabilitaet und konsequentes Zermuerben.',
    strengths: ['Mount Pressure', 'Side Control', 'Arm Triangle'],
    weaknesses: ['Mobile Guard Player', 'Schnelle Scrambles'],
    primarySystems: ['Side Control', 'Arm Triangle', 'Head and Arm'],
    topStyle: 'Smash Passing',
    winPath: ['Top Control', 'Isolation', 'Pressure', 'Submission'],
    color: '#64748b',
    icon: 'HP',
  },
  {
    id: 'flexible-guard-technician',
    name: 'Flexible Guard Technician',
    tagline: 'Guard -> Leg Entry -> Sweep / Back',
    description: 'Du spielst mit extremer Mobilitaet, Inversionen und modernen Guard-Systemen.',
    strengths: ['Leg Entries', 'Guard Retention', 'K-Guard', '50/50'],
    weaknesses: ['Wrestler', 'Schneller Druck'],
    primarySystems: ['K-Guard', 'Matrix', 'Inside Sankaku', '50/50'],
    topStyle: 'Leg Drag',
    winPath: ['Guard', 'Leg Entry', 'Back Exposure', 'Finish'],
    color: '#10b981',
    icon: 'GT',
  },
]

export const QUESTIONS: Question[] = [
  {
    id: 'build',
    question: 'Wie ist dein Build?',
    helper: 'Welche Koerperform passt am ehesten zu dir?',
    options: [
      {
        label: 'Lang & schlank',
        description: 'Lange Hebel, eher leicht gebaut',
        icon: '📏',
        scores: { 'long-flexible-guard': 2, 'long-explosive-scrambler': 2 },
      },
      {
        label: 'Kompakt & explosiv',
        description: 'Kurze Hebel, viel Power nach vorne',
        icon: '💥',
        scores: { 'compact-explosive-wrestler': 2, 'compact-pressure-passer': 2, 'heavy-pressure-grappler': 1 },
      },
      {
        label: 'Lang & kraeftig',
        description: 'Lange Hebel mit Druck und Gewicht',
        icon: '🦍',
        scores: { 'heavy-pressure-grappler': 2, 'long-explosive-scrambler': 1 },
      },
    ],
  },
  {
    id: 'flexibility',
    question: 'Wie beweglich bist du?',
    helper: 'Denk an Guard-Winkel, Inversionen und aktive Mobilitaet.',
    options: [
      {
        label: 'Sehr flexibel',
        description: 'Viele Winkel, leichte Inversionen',
        icon: '🧘',
        scores: { 'long-flexible-guard': 2, 'flexible-guard-technician': 2 },
      },
      {
        label: 'Mittel',
        description: 'Solide, aber nicht extrem',
        icon: '⚖️',
        scores: { 'long-explosive-scrambler': 1, 'compact-pressure-passer': 1 },
      },
      {
        label: 'Eher steif',
        description: 'Mehr Druck als Beweglichkeit',
        icon: '🧱',
        scores: { 'compact-explosive-wrestler': 1, 'heavy-pressure-grappler': 2 },
      },
    ],
  },
  {
    id: 'explosivity',
    question: 'Wie explodierst du?',
    helper: 'Geht deine erste Aktion eher ueber Speed oder ueber Kontrolle?',
    options: [
      {
        label: 'Sehr explosiv',
        description: 'Schnelle Bursts und starke erste Aktion',
        icon: '⚡',
        scores: { 'long-explosive-scrambler': 2, 'compact-explosive-wrestler': 2 },
      },
      {
        label: 'Technisch',
        description: 'Timing und Effizienz statt roher Kraft',
        icon: '♟️',
        scores: { 'long-flexible-guard': 1, 'flexible-guard-technician': 2 },
      },
      {
        label: 'Stark & konstant',
        description: 'Weniger Burst, mehr Druck ueber Zeit',
        icon: '🪨',
        scores: { 'heavy-pressure-grappler': 2, 'compact-pressure-passer': 2 },
      },
    ],
  },
  {
    id: 'guard',
    question: 'Was ist dein Default von unten?',
    helper: 'Wie reagierst du typischerweise, wenn du unten landest?',
    options: [
      {
        label: 'Guard spielen',
        description: 'Ich fuehle mich in Guard-Systemen zuhause',
        icon: '🛡️',
        scores: { 'long-flexible-guard': 2, 'flexible-guard-technician': 2 },
      },
      {
        label: 'Aufstehen',
        description: 'Ich suche Standups oder Wrestle-Ups',
        icon: '🦵',
        scores: { 'compact-explosive-wrestler': 2, 'long-explosive-scrambler': 1 },
      },
      {
        label: 'Scramble',
        description: 'Chaotische Uebergaenge sind okay fuer mich',
        icon: '🔄',
        scores: { 'long-explosive-scrambler': 2, 'compact-explosive-wrestler': 1 },
      },
      {
        label: 'Absichern',
        description: 'Ich ueberlebe erst mal und arbeite mich raus',
        icon: '🧷',
        scores: { 'compact-pressure-passer': 1, 'heavy-pressure-grappler': 1 },
      },
    ],
  },
  {
    id: 'passing',
    question: 'Wie gehst du lieber nach vorne?',
    helper: 'Wenn du angreifst: eher Druck, Bewegung oder Praezision?',
    options: [
      {
        label: 'Mit Druck',
        description: 'Bodylock, Smash, Crossface, Geduld',
        icon: '🚜',
        scores: { 'heavy-pressure-grappler': 2, 'compact-pressure-passer': 2 },
      },
      {
        label: 'Mit Bewegung',
        description: 'Winkel, Tempo und viel Fussarbeit',
        icon: '💨',
        scores: { 'long-flexible-guard': 1, 'long-explosive-scrambler': 2, 'compact-explosive-wrestler': 1 },
      },
      {
        label: 'Sehr technisch',
        description: 'Praezise Grips und saubere Beinsteuerung',
        icon: '🎯',
        scores: { 'flexible-guard-technician': 2, 'compact-pressure-passer': 1 },
      },
    ],
  },
  {
    id: 'goal',
    question: 'Was willst du am meisten?',
    helper: 'Welcher Outcome beschreibt dein Ziel am besten?',
    options: [
      {
        label: 'Sauberes System',
        description: 'Ich will ein tiefes, technisches Spiel entwickeln',
        icon: '🧠',
        scores: { 'flexible-guard-technician': 2, 'long-flexible-guard': 1 },
      },
      {
        label: 'Wettkampf',
        description: 'Ich will Turniere gewinnen und dominieren',
        icon: '🏆',
        scores: { 'compact-explosive-wrestler': 1, 'compact-pressure-passer': 1, 'long-flexible-guard': 1 },
      },
      {
        label: 'Kontrolle',
        description: 'Ich will Positionen halten und Leute muede machen',
        icon: '🕹️',
        scores: { 'heavy-pressure-grappler': 2, 'compact-pressure-passer': 1 },
      },
      {
        label: 'Flow & Spass',
        description: 'Ich will fluessig spielen und moderne Positionen lernen',
        icon: '🌊',
        scores: { 'long-explosive-scrambler': 1, 'long-flexible-guard': 1, 'flexible-guard-technician': 1 },
      },
    ],
  },
]

export function calculateArchetype(answers: Record<string, number>) {
  const scores: Record<string, number> = Object.fromEntries(ARCHETYPES.map((archetype) => [archetype.id, 0]))

  for (const question of QUESTIONS) {
    const selectedIndex = answers[question.id]
    const option = question.options[selectedIndex]

    if (!option) {
      continue
    }

    for (const [archetypeId, score] of Object.entries(option.scores)) {
      scores[archetypeId] += score ?? 0
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const primary = ARCHETYPES.find((archetype) => archetype.id === sorted[0][0]) ?? ARCHETYPES[0]
  const secondary = ARCHETYPES.find((archetype) => archetype.id === sorted[1][0]) ?? ARCHETYPES[1]

  return { primary, secondary, scores }
}
