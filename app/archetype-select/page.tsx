'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ARCHETYPES } from '@/lib/archetypes'
import { readArchetypeResult, saveArchetypeResult, type ArchetypeResultData } from '@/lib/public-archetype-result'

const ARCHETYPE_IMAGE_PATHS: Record<string, string> = {
  'flexible-guard-technician': '/archetypes/flexible-guard-technician.png',
  'compact-pressure-passer': '/archetypes/compact-pressure-passer.png',
  'long-flexible-guard': '/archetypes/long-flexible-guard-player.png',
  'long-explosive-scrambler': '/archetypes/long-explosive-scrambler.png',
  'compact-explosive-wrestler': '/archetypes/compact-explosive-wrestler.png',
  'heavy-pressure-grappler': '/archetypes/heavy-pressure-grappler.png',
}

function buildUpdatedResult(current: ArchetypeResultData, nextPrimaryId: string) {
  const nextPrimary = ARCHETYPES.find((entry) => entry.id === nextPrimaryId) ?? current.primary
  const fallbackSecondary =
    current.secondary.id !== nextPrimary.id
      ? current.secondary
      : current.primary.id !== nextPrimary.id
        ? current.primary
        : ARCHETYPES.find((entry) => entry.id !== nextPrimary.id) ?? ARCHETYPES[0]

  return {
    ...current,
    primary: nextPrimary,
    secondary: fallbackSecondary,
    scores: {
      ...current.scores,
      [nextPrimary.id]: Math.max(current.scores[nextPrimary.id] ?? 0, 1),
    },
  }
}

export default function ArchetypeSelectPage() {
  const router = useRouter()
  const [result, setResult] = useState<ArchetypeResultData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const stored = readArchetypeResult()
    if (!stored) {
      router.push('/archetype-test')
      return
    }

    setResult(stored)
    setSelectedId(stored.primary.id)
  }, [router])

  function handleContinue() {
    if (!result || !selectedId) return
    const nextResult = buildUpdatedResult(result, selectedId)
    saveArchetypeResult(nextResult, true)
    router.push('/archetype-result')
  }

  if (!result || !selectedId) {
    return <div className="min-h-screen bg-[#0d0b09]" />
  }

  return (
    <div className="min-h-screen bg-[#0d0b09] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 md:px-8">
        <section className="w-full rounded-[2.8rem] border border-bjj-border bg-[#120f0d] px-6 py-8 shadow-card md:px-10 md:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Archetyp auswählen</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-6xl">Wähle deinen finalen Archetyp</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/64 md:text-base">
            Das geht nur jetzt im Onboarding. Danach bleibt dein Archetyp im Profil fest gesetzt.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ARCHETYPES.map((entry) => {
              const active = selectedId === entry.id

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`overflow-hidden rounded-[2rem] border text-left transition ${
                    active
                      ? 'border-bjj-gold/40 bg-[rgba(212,135,95,0.08)] shadow-orange-glow-sm'
                      : 'border-white/8 bg-[#171310] hover:border-bjj-gold/20'
                  }`}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(180deg,rgba(34,26,20,0.98),rgba(17,13,10,0.98))]">
                    {brokenImages[entry.id] ? null : (
                      <img
                        src={ARCHETYPE_IMAGE_PATHS[entry.id]}
                        alt={entry.name}
                        className="h-full w-full object-cover"
                        onError={() => setBrokenImages((current) => ({ ...current, [entry.id]: true }))}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(8,7,6,0.92))] px-5 pb-5 pt-16">
                      <h2 className="text-2xl font-black leading-tight text-white">{entry.name}</h2>
                      <p className="mt-2 text-sm leading-6 text-white/68">{entry.description}</p>
                    </div>
                    {brokenImages[entry.id] ? (
                      <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                        <div>
                          <p className="text-xl font-black text-white">{entry.name}</p>
                          <p className="mt-3 text-sm leading-6 text-white/55">Bild folgt, sobald die Datei im Projekt liegt.</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleContinue}
              className="rounded-2xl bg-bjj-gold px-8 py-4 text-base font-black uppercase tracking-[0.12em] text-bjj-coal transition hover:bg-bjj-orange-light"
            >
              Auswahl übernehmen
            </button>
            <button
              onClick={() => router.push('/archetype-result')}
              className="rounded-2xl border border-bjj-border bg-bjj-card px-8 py-4 text-base font-black uppercase tracking-[0.12em] text-white/82 transition hover:border-bjj-gold/25 hover:text-white"
            >
              Zurück zum Ergebnis
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
