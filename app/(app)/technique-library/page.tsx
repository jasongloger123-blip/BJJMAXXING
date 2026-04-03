'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  Award,
  Layers,
  Lock,
  Play,
  Search,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Target,
  User,
  Zap,
} from 'lucide-react'
import { LONG_FLEXIBLE_GUARD_NODES } from '@/lib/nodes'

type TechniqueItem = {
  id: string
  title: string
  tag: string
  tagColor: string
  level: number
  duration: string
  prereq: string
  icon: typeof Shield
  image: string
  locked?: boolean
  fighter: string
  creator: string
  stage: 'setup' | 'position' | 'transition' | 'finish'
  nodeId?: string
}

type CreatorPlan = {
  id: string
  title: string
  creator: string
  fighter: string
  price: string
  techniques: number
  focus: string
  description: string
}

const STAGE_TAG_COLORS: Record<TechniqueItem['stage'], string> = {
  setup: 'bg-[#f59e0b]/20 text-[#fdba74] border-[#f59e0b]/30',
  position: 'bg-[#3b82f6]/20 text-[#93c5fd] border-[#3b82f6]/30',
  transition: 'bg-[#8b5cf6]/20 text-[#b794f4] border-[#8b5cf6]/30',
  finish: 'bg-[#22c55e]/20 text-[#86efac] border-[#22c55e]/30',
}

const STAGE_LABELS: Record<TechniqueItem['stage'], string> = {
  setup: 'Setup',
  position: 'Position',
  transition: 'Transition',
  finish: 'Finish',
}

const CREATOR_GAMEPLANS: CreatorPlan[] = [
  {
    id: 'craig-jones-a-plan',
    title: 'Craig Jones Backtake Plan',
    creator: 'BJJMAXXING',
    fighter: 'Craig Jones',
    price: '29 EUR',
    techniques: 14,
    focus: 'Guard to back exposure',
    description: 'Ein kompletter Creator-Plan mit Technikpaket, Review-Ziel und sauberer Reihenfolge fuer Guard Player.',
  },
  {
    id: 'lachlan-guard-system',
    title: 'Lachlan Giles Guard System',
    creator: 'Open Mat Studio',
    fighter: 'Lachlan Giles',
    price: '39 EUR',
    techniques: 18,
    focus: 'Retention and off-balance',
    description: 'Fokussiert auf Distanzmanagement, Retention und Uebergaenge in Sweeps oder Backtakes.',
  },
  {
    id: 'mikey-connection-pack',
    title: 'Mikey Connection Pack',
    creator: 'Submission Forge',
    fighter: 'Mikey Musumeci',
    price: '19 EUR',
    techniques: 9,
    focus: 'Grip and connection detail',
    description: 'Ein kompakter Creator-Plan mit hochdetaillierten Verbindungs- und Timing-Sequenzen.',
  },
]

function extractYoutubeId(url?: string) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match?.[1] ?? null
}

function getThumbnail(url?: string) {
  const id = extractYoutubeId(url)
  if (id) {
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  }

  return 'https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?auto=format&fit=crop&q=80&w=900'
}

function guessStage(title: string) {
  const normalized = title.toLowerCase()

  if (
    normalized.includes('finish') ||
    normalized.includes('backtake') ||
    normalized.includes('choke') ||
    normalized.includes('submission')
  ) {
    return 'finish'
  }

  if (normalized.includes('off-balance') || normalized.includes('transition') || normalized.includes('sweep')) {
    return 'transition'
  }

  if (normalized.includes('connection') || normalized.includes('retention') || normalized.includes('guard')) {
    return 'position'
  }

  return 'setup'
}

function guessFighter(title: string) {
  const normalized = title.toLowerCase()
  if (normalized.includes('back') || normalized.includes('guillotine')) return 'Craig Jones'
  if (normalized.includes('dlr') || normalized.includes('guard')) return 'Lachlan Giles'
  if (normalized.includes('connection') || normalized.includes('retention')) return 'Mikey Musumeci'
  return 'BJJMAXXING'
}

const staticTechniques: TechniqueItem[] = [
  {
    id: 'leg-drag',
    title: 'Leg Drag Connection',
    tag: STAGE_LABELS.transition,
    tagColor: STAGE_TAG_COLORS.transition,
    level: 3,
    duration: '03:45',
    prereq: 'Closed Guard Opening',
    icon: Shield,
    image: 'https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?auto=format&fit=crop&q=80&w=900',
    stage: 'transition',
    fighter: 'Gordon Ryan',
    creator: 'BJJMAXXING',
  },
  {
    id: 'side-control',
    title: 'Side Control Anchor',
    tag: STAGE_LABELS.position,
    tagColor: STAGE_TAG_COLORS.position,
    level: 2,
    duration: '02:15',
    prereq: 'Weight Placement 101',
    icon: User,
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=900',
    stage: 'position',
    fighter: 'Roger Gracie',
    creator: 'BJJMAXXING',
  },
  {
    id: 'berimbolo',
    title: 'Berimbolo Entry',
    tag: STAGE_LABELS.transition,
    tagColor: STAGE_TAG_COLORS.transition,
    level: 5,
    duration: '04:10',
    prereq: 'De La Riva Setup',
    icon: Zap,
    image: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&q=80&w=900',
    locked: true,
    stage: 'transition',
    fighter: 'Mikey Musumeci',
    creator: 'Open Mat Studio',
  },
]

const ratingStars = (value: number) =>
  Array.from({ length: 5 }).map((_, index) => ({
    id: index,
    active: index < value,
  }))

export default function TechniqueLibraryPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | TechniqueItem['stage']>('all')
  const [query, setQuery] = useState('')
  const [fighterFilter, setFighterFilter] = useState('all')

  const libraryNodes: TechniqueItem[] = useMemo(
    () =>
      LONG_FLEXIBLE_GUARD_NODES.map((node) => {
        const stage = guessStage(node.title)
        const tag = STAGE_LABELS[stage]

        return {
          id: node.id,
          nodeId: node.id,
          title: node.title,
          tag,
          tagColor: STAGE_TAG_COLORS[stage],
          level: node.level,
          duration: `${node.videos.length} Videos`,
          prereq: node.prerequisites.length
            ? LONG_FLEXIBLE_GUARD_NODES.find((entry) => entry.id === node.prerequisites[0])?.title ?? 'Prerequisite'
            : 'Start',
          icon: Shield,
          image: getThumbnail(node.videos[0]?.url),
          locked: Boolean(node.isComingSoon),
          stage,
          fighter: guessFighter(node.title),
          creator: 'BJJMAXXING',
        }
      }),
    []
  )

  const allTechniques = useMemo(() => [...libraryNodes, ...staticTechniques], [libraryNodes])
  const fighterOptions = useMemo(
    () => ['all', ...Array.from(new Set(allTechniques.map((tech) => tech.fighter))).sort()],
    [allTechniques]
  )

  const filteredTechniques = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return allTechniques.filter((tech) => {
      const matchesFilter = activeFilter === 'all' || tech.stage === activeFilter
      const matchesQuery = !normalized || [tech.title, tech.creator, tech.fighter, tech.prereq].join(' ').toLowerCase().includes(normalized)
      const matchesFighter = fighterFilter === 'all' || tech.fighter === fighterFilter
      return matchesFilter && matchesQuery && matchesFighter
    })
  }, [activeFilter, allTechniques, fighterFilter, query])

  const filterConfig = useMemo(() => {
    const counts = {
      all: allTechniques.length,
      setup: allTechniques.filter((tech) => tech.stage === 'setup').length,
      position: allTechniques.filter((tech) => tech.stage === 'position').length,
      transition: allTechniques.filter((tech) => tech.stage === 'transition').length,
      finish: allTechniques.filter((tech) => tech.stage === 'finish').length,
    }

    return [
      { id: 'all', label: 'All Nodes', count: counts.all },
      { id: 'setup', label: 'Setup', count: counts.setup },
      { id: 'position', label: 'Position', count: counts.position },
      { id: 'transition', label: 'Transition', count: counts.transition },
      { id: 'finish', label: 'Finish', count: counts.finish },
    ] as const
  }, [allTechniques])

  return (
    <div className="min-h-screen bg-bjj-bg">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-0 px-4 py-6 md:px-6">
        <aside className="hidden w-72 shrink-0 border-r border-white/5 bg-black/20 px-6 py-8 lg:flex lg:flex-col">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">Technique Filter</p>
          <nav className="mt-6 space-y-2">
            {filterConfig.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] transition ${
                  activeFilter === filter.id
                    ? 'border border-bjj-gold/40 bg-bjj-gold/15 text-bjj-gold'
                    : 'border border-transparent text-white/50 hover:border-white/10 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeFilter === filter.id ? 'bg-bjj-gold text-bjj-coal' : 'text-white/40'}`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              <Award className="h-4 w-4 text-bjj-gold" />
              Fighter Sortierung
            </div>
            <select
              value={fighterFilter}
              onChange={(event) => setFighterFilter(event.target.value)}
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#151d2a] px-4 py-3 text-sm text-white outline-none"
            >
              {fighterOptions.map((fighter) => (
                <option key={fighter} value={fighter}>
                  {fighter === 'all' ? 'Alle Kaempfer' : fighter}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-auto rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              <ShoppingBag className="h-4 w-4 text-bjj-gold" />
              Creator Gameplans
            </div>
            <p className="mt-4 text-sm font-semibold text-white">Marketplace direkt in der Library</p>
            <p className="mt-3 text-sm text-white/55">Sortiere Techniken nach Kaempfern und kaufe ganze Creator-Pakete an einer Stelle.</p>
          </div>
        </aside>

        <main className="flex-1">
          <header className="flex flex-col gap-6 border-b border-white/5 pb-6 pt-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
                <span className="h-2 w-2 rounded-full bg-bjj-gold" />
                Resource Database
              </div>
              <h1 className="mt-3 text-2xl font-black uppercase tracking-tight text-white">Technique Library</h1>
              <p className="mt-3 max-w-3xl text-sm text-white/55">Techniken, Fighter-Sortierung und kaufbare Creator-Gameplans an einem Ort.</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  placeholder="Suche nach Technik, Fighter oder Creator..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-72 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-white/40 focus:border-bjj-gold/40 focus:outline-none"
                />
              </div>
              <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/10">
                <SlidersHorizontal className="h-4 w-4 text-white/50" />
                Sort
              </button>
            </div>
          </header>

          <section className="mt-8 grid gap-4 xl:grid-cols-3">
            {CREATOR_GAMEPLANS.map((plan) => (
              <article key={plan.id} className="rounded-[1.8rem] border border-white/6 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-bjj-gold">
                    {plan.price}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{plan.techniques} Techniken</span>
                </div>
                <h2 className="mt-4 text-2xl font-black text-white">{plan.title}</h2>
                <p className="mt-2 text-sm text-white/65">Von {plan.creator} • Fighter: {plan.fighter}</p>
                <p className="mt-4 text-sm leading-7 text-white/58">{plan.description}</p>
                <div className="mt-4 rounded-xl border border-white/6 bg-black/10 px-4 py-3 text-sm text-white/72">{plan.focus}</div>
                <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-bjj-gold px-4 py-3 text-sm font-black text-bjj-coal transition hover:bg-bjj-orange-light">
                  Gameplan kaufen
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </section>

          <div className="grid gap-8 py-10 md:grid-cols-2 xl:grid-cols-3">
            {filteredTechniques.map((tech) => {
              const Icon = tech.icon
              const card = (
                <>
                  <div className="relative aspect-video overflow-hidden">
                    {tech.locked ? (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75">
                        <Lock className="h-6 w-6 text-white/40" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Locked Node</span>
                      </div>
                    ) : null}

                    <img
                      src={tech.image}
                      alt={tech.title}
                      className="h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />
                    <span className={`absolute left-4 top-4 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${tech.tagColor}`}>
                      {tech.tag}
                    </span>
                    {!tech.locked ? (
                      <button className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                        <Play className="h-5 w-5 text-white" />
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-white">{tech.title}</h3>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                          {tech.fighter} • {tech.creator}
                        </p>
                      </div>
                      <Icon className="h-5 w-5 text-white/40" />
                    </div>

                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      <span>Level {tech.level}</span>
                      <div className="flex items-center gap-0.5 text-bjj-gold">
                        {ratingStars(Math.min(tech.level, 5)).map((star) => (
                          <span key={star.id} className={star.active ? 'text-bjj-gold' : 'text-white/20'}>
                            *
                          </span>
                        ))}
                      </div>
                      <span className="ml-auto">{tech.duration}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.2em] text-white/30">Prerequisite</p>
                        <p className="mt-1 text-[11px] text-white/60">{tech.prereq}</p>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-bjj-gold/20 bg-bjj-gold/10 text-bjj-gold transition group-hover:bg-bjj-gold group-hover:text-bjj-coal">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </>
              )

              const cardClasses = `group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0d1117] transition ${
                tech.locked ? 'opacity-45 grayscale' : 'hover:-translate-y-1 hover:border-bjj-gold/40'
              }`

              return tech.nodeId ? (
                <Link key={tech.id} href={`/node/${tech.nodeId}`} className={cardClasses}>
                  {card}
                </Link>
              ) : (
                <article key={tech.id} className={cardClasses}>
                  {card}
                </article>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
