'use client'

import { useEffect, useMemo, useState } from 'react'
import { Shield, X } from 'lucide-react'
import { TechniqueLibraryFilterBar } from '@/components/technique-library/TechniqueLibraryFilterBar'
import { TechniqueLibraryGrid } from '@/components/technique-library/TechniqueLibraryGrid'
import type {
  TechniqueFilterGroupOption,
  TechniqueFilters,
  TechniqueItem,
  TechniqueSort,
  TechniqueStage,
} from '@/components/technique-library/types'
import {
  CUSTOM_TECHNIQUES_EVENT,
  readCustomTechniques,
  resolveTechniqueStyleContent,
  type CustomTechniqueRecord,
} from '@/lib/custom-techniques'
import type { ResolvedGameplan } from '@/lib/gameplans'
import {
  coverageIncludesStyle,
  getTechniqueCoverageLabel,
  readPreferredTechniqueStyle,
  writePreferredTechniqueStyle,
  type TechniqueStyle,
  type TechniqueStyleCoverage,
} from '@/lib/technique-style'
import { getNodeTechniqueCatalog } from '@/lib/technique-catalog'

const STAGE_TAG_COLORS: Record<TechniqueItem['stage'], string> = {
  position: 'bg-[#79a9ff]/18 text-[#8db6ff]',
  pass: 'bg-[#f59e0b]/18 text-[#f3ae57]',
  submission: 'bg-[#59c79a]/18 text-[#76d3ad]',
}

const STAGE_LABELS: Record<TechniqueItem['stage'], string> = {
  position: 'Position',
  pass: 'Pass',
  submission: 'Submission',
}

const DEFAULT_THUMBNAIL = '/images/bjjmaxxing-logo.png'

const COACH_AVATARS: Record<string, string> = {
  'Craig Jones': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120&h=120',
  'Lachlan Giles': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120&h=120',
  'John Danaher': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120&h=120',
  'Mikey Musumeci': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=120&h=120',
  'Roger Gracie': 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&q=80&w=120&h=120',
  'Gordon Ryan': 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&q=80&w=120&h=120',
  BJJMAXXING: DEFAULT_THUMBNAIL,
}

const defaultFilters: TechniqueFilters = {
  query: '',
  stages: [],
  difficulties: [],
  styles: [],
  fighters: [],
  sort: 'featured',
}

type StageType = TechniqueItem['stage']

function extractYoutubeId(url?: string) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match?.[1] ?? null
}

function getThumbnail(url?: string) {
  const id = extractYoutubeId(url)
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  return DEFAULT_THUMBNAIL
}

function guessStage(title: string): TechniqueItem['stage'] {
  const normalized = title.toLowerCase()

  if (
    normalized.includes('finish') ||
    normalized.includes('backtake') ||
    normalized.includes('back take') ||
    normalized.includes('choke') ||
    normalized.includes('submission') ||
    normalized.includes('guillotine') ||
    normalized.includes('triangle') ||
    normalized.includes('heel hook') ||
    normalized.includes('foot lock')
  ) {
    return 'submission'
  }
  if (
    normalized.includes('pass') ||
    normalized.includes('passing') ||
    normalized.includes('sweep') ||
    normalized.includes('transition') ||
    normalized.includes('entry') ||
    normalized.includes('rise') ||
    normalized.includes('wrestle') ||
    normalized.includes('isolation') ||
    normalized.includes('off-balance')
  ) {
    return 'pass'
  }
  if (
    normalized.includes('connection') ||
    normalized.includes('retention') ||
    normalized.includes('guard') ||
    normalized.includes('control') ||
    normalized.includes('single leg x')
  ) {
    return 'position'
  }
  return 'position'
}

function guessFighter(title: string) {
  const normalized = title.toLowerCase()
  if (normalized.includes('leg') || normalized.includes('ashi') || normalized.includes('foot lock')) return 'Lachlan Giles'
  if (normalized.includes('back') || normalized.includes('guillotine')) return 'Craig Jones'
  if (normalized.includes('dlr') || normalized.includes('guard')) return 'Lachlan Giles'
  if (normalized.includes('connection') || normalized.includes('retention')) return 'Mikey Musumeci'
  if (normalized.includes('leg drag')) return 'John Danaher'
  return 'BJJMAXXING'
}

function guessDifficulty(level: number) {
  if (level <= 2) return 'Anfaenger'
  if (level <= 4) return 'Fortgeschritten'
  return 'Experte'
}

function guessStyleCoverage(title: string): TechniqueStyleCoverage {
  const normalized = title.toLowerCase()
  if (normalized.includes('lapel') || normalized.includes('collar') || normalized.includes('spider')) {
    return 'gi'
  }
  return 'both'
}

function getCoachAvatar(fighter: string) {
  return COACH_AVATARS[fighter] ?? COACH_AVATARS.BJJMAXXING
}

function sortTechniques(items: TechniqueItem[], sort: TechniqueSort) {
  const next = [...items]
  if (sort === 'level-desc') return next.sort((a, b) => b.level - a.level || a.title.localeCompare(b.title))
  if (sort === 'level-asc') return next.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title))
  if (sort === 'title-asc') return next.sort((a, b) => a.title.localeCompare(b.title))
  return next.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title))
}

function toggleSelection<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
}

function countBy<T extends string>(items: TechniqueItem[], values: T[], getValue: (item: TechniqueItem) => T): TechniqueFilterGroupOption<T>[] {
  return values.map((value) => ({
    id: value,
    label: value,
    count: items.filter((item) => getValue(item) === value).length,
  }))
}

export default function TechniqueLibraryPage() {
  const [hydrated, setHydrated] = useState(false)
  const [filters, setFilters] = useState<TechniqueFilters>(defaultFilters)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [activePlan, setActivePlan] = useState<ResolvedGameplan | null>(null)
  const [customTechniques, setCustomTechniques] = useState<CustomTechniqueRecord[]>([])

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    const sync = () => setCustomTechniques(readCustomTechniques())
    if (hydrated) sync()
    window.addEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
    return () => window.removeEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
  }, [hydrated])

  useEffect(() => {
    let active = true

    async function loadActivePlan() {
      try {
        const response = await fetch('/api/gameplan/active', { cache: 'no-store' })
        const payload = (await response.json()) as { plan?: ResolvedGameplan }
        if (!active || !response.ok || !payload.plan) return
        setActivePlan(payload.plan)
      } catch {
        if (!active) return
        setActivePlan(null)
      }
    }

    void loadActivePlan()

    return () => {
      active = false
    }
  }, [])

  const libraryNodes: TechniqueItem[] = useMemo(
    () => {
      const planNodeBySource = new Map(
        Object.values(activePlan?.nodes ?? {})
          .filter((planNode) => planNode.sourceNodeId)
          .map((planNode) => [planNode.sourceNodeId as string, planNode])
      )

      return getNodeTechniqueCatalog().map((technique) => {
        const planNode = planNodeBySource.get(technique.id)
        const stage = technique.stage ?? guessStage(technique.title)
        const fighter = technique.fighter || guessFighter(technique.title)
        const difficulty = guessDifficulty(technique.level)
        const locked = planNode ? planNode.state === 'locked' || planNode.state === 'silhouette' : true
        return {
          id: technique.id,
          techniqueId: technique.id,
          title: planNode?.title || technique.title,
          description: locked
            ? `${planNode?.title ?? technique.title} bleibt noch gesperrt. Schalte erst deinen aktuellen Schritt im Gameplan frei, dann geht diese Technik auf.`
            : technique.prerequisites.length
              ? `Arbeite von ${technique.prerequisites[0] ?? 'deinem letzten Knoten'} weiter in die naechste Verbindung.`
              : 'Der Einstiegspunkt fuer dein System mit klarer Progression in die naechsten Videos.',
          tag: STAGE_LABELS[stage],
          tagColor: STAGE_TAG_COLORS[stage],
          level: technique.level,
          duration: `${Math.max(technique.videos.length * 3, 4)}:${technique.videos.length ? '00' : '20'}`,
          prereq: technique.prerequisites.length
            ? technique.prerequisites[0] ?? 'Prerequisite'
            : 'Start',
          icon: Shield,
          image: technique.image || getThumbnail(),
          coachAvatar: getCoachAvatar(fighter),
          locked,
          unlockState: locked ? 'locked' : 'unlocked',
          stage: planNode?.stage ?? stage,
          fighter,
          creator: 'BJJMAXXING',
          difficulty,
          style: getTechniqueCoverageLabel(guessStyleCoverage(technique.title)),
          styleCoverage: guessStyleCoverage(technique.title),
        }
      })
    },
    [activePlan]
  )

  const customTechniqueItems = useMemo<TechniqueItem[]>(
    () =>
      customTechniques.map((technique) => {
        const content = resolveTechniqueStyleContent(technique, readPreferredTechniqueStyle())

        return {
          id: technique.id,
          techniqueId: technique.id,
          title: technique.title,
          description: content.description,
          tag: STAGE_LABELS[technique.stage],
          tagColor: STAGE_TAG_COLORS[technique.stage],
          level: technique.level,
          duration: 'Custom',
          prereq: technique.prerequisites[0] ?? 'Custom',
          icon: Shield,
          image: technique.image || getThumbnail(),
          coachAvatar: getCoachAvatar(technique.fighter || 'BJJMAXXING'),
          locked: false,
          unlockState: 'unlocked',
          stage: technique.stage,
          fighter: technique.fighter || 'BJJMAXXING',
          creator: technique.creator || 'BJJMAXXING',
          difficulty: guessDifficulty(technique.level),
          style: getTechniqueCoverageLabel(technique.styleCoverage),
          styleCoverage: technique.styleCoverage,
        }
      }),
    [customTechniques]
  )

  const allTechniques = useMemo(() => [...customTechniqueItems, ...libraryNodes], [customTechniqueItems, libraryNodes])

  const categoryOptions = useMemo<TechniqueFilterGroupOption<TechniqueStage>[]>(
    () => [
      { id: 'position', label: 'Position', count: allTechniques.filter((tech) => tech.stage === 'position').length },
      { id: 'pass', label: 'Pass', count: allTechniques.filter((tech) => tech.stage === 'pass').length },
      { id: 'submission', label: 'Submission', count: allTechniques.filter((tech) => tech.stage === 'submission').length },
    ],
    [allTechniques]
  )

  const styleOptions = useMemo(
    () => [
      {
        id: 'Gi',
        label: 'Gi',
        count: allTechniques.filter((item) => coverageIncludesStyle(item.styleCoverage, 'gi')).length,
      },
      {
        id: 'No-Gi',
        label: 'No-Gi',
        count: allTechniques.filter((item) => coverageIncludesStyle(item.styleCoverage, 'nogi')).length,
      },
    ],
    [allTechniques]
  )

  const coachOptions = useMemo(
    () => countBy(allTechniques, Array.from(new Set(allTechniques.map((tech) => tech.fighter))).sort(), (item) => item.fighter),
    [allTechniques]
  )

  const filteredTechniques = useMemo(() => {
    const normalized = filters.query.trim().toLowerCase()
    const visible = allTechniques.filter((tech) => {
      const matchesQuery =
        !normalized || [tech.title, tech.description, tech.creator, tech.fighter, tech.prereq, tech.style].join(' ').toLowerCase().includes(normalized)
      const matchesStage = !filters.stages.length || filters.stages.includes(tech.stage)
      const matchesStyle =
        !filters.styles.length ||
        filters.styles.some((style) => coverageIncludesStyle(tech.styleCoverage, style === 'Gi' ? 'gi' : 'nogi'))
      const matchesCoach = !filters.fighters.length || filters.fighters.includes(tech.fighter)

      return matchesQuery && matchesStage && matchesStyle && matchesCoach
    })

    return sortTechniques(visible, filters.sort)
  }, [allTechniques, filters])

  function updateFilters(patch: Partial<TechniqueFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function resetFilters() {
    setFilters({
      ...defaultFilters,
      stages: [],
      styles: [],
    })
  }

  return (
    <div className="min-h-screen bg-bjj-bg">
      {/* Header - nur auf Desktop sichtbar */}
      <section className="relative hidden overflow-hidden rounded-[1.65rem] border border-white/10 bg-[linear-gradient(135deg,rgba(17,20,30,0.98),rgba(11,14,21,0.94))] shadow-[0_28px_70px_rgba(0,0,0,0.28)]] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,191,88,0.3),transparent_24%),radial-gradient(circle_at_74%_20%,rgba(122,162,255,0.28),transparent_26%),radial-gradient(circle_at_68%_72%,rgba(238,98,149,0.22),transparent_24%),linear-gradient(135deg,rgba(24,29,42,0.16),rgba(8,11,17,0.08))]" />
        <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.02)_22%,transparent_22%),linear-gradient(145deg,transparent_0%,transparent_54%,rgba(255,255,255,0.08)_54%,rgba(255,255,255,0.01)_74%,transparent_74%)] mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,8,13,0.84)_0%,rgba(8,11,17,0.72)_34%,rgba(8,11,17,0.38)_58%,rgba(8,11,17,0.08)_100%)]" />
        <div className="relative px-6 py-6 sm:px-7 sm:py-6 lg:px-8 lg:py-6">
          <div className="text-center sm:text-left">
            <h1 className="font-display text-[clamp(2.35rem,5.2vw,4.8rem)] font-black leading-[1.08] text-white">
              Technik Bibliothek
            </h1>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="mx-auto mt-6 max-w-7xl px-0">
        <TechniqueLibraryFilterBar
          filters={filters}
          query={filters.query}
          sort={filters.sort}
          categoryOptions={categoryOptions}
          styleOptions={styleOptions}
          coachOptions={coachOptions}
          onQueryChange={(value) => updateFilters({ query: value })}
          onToggleCategory={(value: TechniqueStage) => updateFilters({ stages: toggleSelection(filters.stages, value) })}
          onToggleStyle={(value: string) => updateFilters({ styles: toggleSelection(filters.styles, value) })}
          onToggleCoach={(value: string) => updateFilters({ fighters: toggleSelection(filters.fighters, value) })}
          onSortChange={(value) => updateFilters({ sort: value })}
          onReset={resetFilters}
        />
      </div>

      {/* Grid */}
<div className="mx-auto mt-6 w-full">
        {hydrated ? (
          <TechniqueLibraryGrid techniques={filteredTechniques} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[29rem] rounded-[1.75rem] border border-white/10 bg-white/[0.03] shimmer" />
            ))}
          </div>
        )}
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Techniken Filter">
          <button
            type="button"
            aria-label="Filter schliessen"
            className="absolute inset-0 bg-[#05080d]/80 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 top-12 overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0b0d14] p-4">
            <div className="mx-auto max-w-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/38">Filter</p>
                  <p className="mt-2 text-lg font-black text-white">Techniken</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/70"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="mt-4 w-full rounded-2xl bg-[#f0ab3c] px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-black"
              >
                Techniken anzeigen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
