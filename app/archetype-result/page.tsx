'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ARCHETYPES } from '@/lib/archetypes'
import { ArchetypeCard } from '@/components/ArchetypeCard'
import { clearPendingArchetypeResult, readArchetypeResult, readPendingArchetypeResult, saveArchetypeResult, type ArchetypeResultData } from '@/lib/public-archetype-result'
import { createClient } from '@/lib/supabase/client'

export default function ArchetypeResultPage() {
  const router = useRouter()
  const supabase = createClient()
  const [result, setResult] = useState<ArchetypeResultData | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [hasPendingSelection, setHasPendingSelection] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingSelection, setSavingSelection] = useState(false)

  const loadResult = useCallback(async () => {
    const stored = readArchetypeResult()
    const pending = readPendingArchetypeResult()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isAuthenticated = Boolean(user)
    setAuthenticated(isAuthenticated)
    setHasPendingSelection(Boolean(pending))

    // Wenn ein pending Result existiert und User eingeloggt ist, verwende das pending Result
    if (pending && isAuthenticated) {
      setResult(pending)
      // Speichere es auch als reguläres Result
      saveArchetypeResult(pending)
      setLoading(false)
      return
    }

    if (!stored && !user) {
      router.push('/archetype-test')
      return
    }

    if (user) {
      if (stored) {
        setResult(stored)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('primary_archetype, secondary_archetype')
        .eq('id', user.id)
        .maybeSingle()

      const primary = ARCHETYPES.find((entry) => entry.id === profile?.primary_archetype)
      const secondary = ARCHETYPES.find((entry) => entry.id === profile?.secondary_archetype) ?? ARCHETYPES[1]

      if (primary) {
        setResult({
          primary,
          secondary,
          scores: Object.fromEntries(ARCHETYPES.map((entry) => [entry.id, entry.id === primary.id ? 1 : entry.id === secondary.id ? 0.6 : 0])),
        })
        setLoading(false)
        return
      }
    }

    if (stored) {
      setResult(stored)
      setLoading(false)
      return
    }

    router.push('/archetype-test')
  }, [router, supabase])

  async function continueWithArchetype() {
    if (!result) return

    if (!authenticated) {
      router.push('/register')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setSavingSelection(true)

    // Speichere die Archetypen im Profil
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      primary_archetype: result.primary.id,
      secondary_archetype: result.secondary.id,
    })

    setSavingSelection(false)
    if (error) {
      return
    }

    clearPendingArchetypeResult()
    setHasPendingSelection(false)
    window.dispatchEvent(new Event('profile-ready-changed'))
    // Leite zur Namensabfrage weiter, dann Onboarding für Gym
    window.location.assign('/name-input')
  }

  useEffect(() => {
    void loadResult()
  }, [loadResult])

  // Re-check authentication status periodically in case user just registered
  useEffect(() => {
    if (authenticated) return

    const checkAuth = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setAuthenticated(true)
        void loadResult()
        clearInterval(checkAuth)
      }
    }, 500)

    // Stop checking after 10 seconds
    const timeout = setTimeout(() => clearInterval(checkAuth), 10000)

    return () => {
      clearInterval(checkAuth)
      clearTimeout(timeout)
    }
  }, [authenticated, supabase, loadResult])

  if (loading || !result) {
    return <div className="min-h-screen bg-[#0d0b09]" />
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0d0b09] text-white">
        <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 md:px-8">
          <section className="w-full rounded-[2.8rem] border border-bjj-border bg-[#120f0d] px-6 py-8 text-center shadow-card md:px-10 md:py-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Quiz abgeschlossen</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-6xl">Dein Archetyp ist bereit</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/64 md:text-base">
              Registriere dich, dann speichern wir dein Ergebnis direkt im Profil und starten mit deinem passenden Gameplan.
            </p>

            <div className="mt-10 rounded-[2rem] border border-bjj-border bg-bjj-card p-5 md:p-7">
              <div className="mx-auto max-w-2xl blur-[6px] saturate-75">
                <ArchetypeCard archetype={result.primary} highlight />
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {['Dein Haupt-Archetyp', 'Persoenlicher Startplan', 'Direkter Einstieg ins System'].map((item) => (
                  <div key={item} className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-4 text-sm font-semibold text-white/85">
                    {item}
                  </div>
                ))}
              </div>
            </div>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-bjj-gold px-8 py-4 text-base font-black uppercase tracking-[0.12em] text-bjj-coal transition hover:bg-bjj-orange-light"
              >
                Ergebnis freischalten
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-bjj-border bg-bjj-card px-8 py-4 text-base font-black uppercase tracking-[0.12em] text-white/82 transition hover:border-bjj-gold/25 hover:text-white"
              >
                Einloggen
              </Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0b09] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 md:px-8">
        <section className="w-full rounded-[2.8rem] border border-bjj-border bg-[#120f0d] px-6 py-8 shadow-card md:px-10 md:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Dein Ergebnis</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-6xl">Das ist dein Archetyp</h1>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <ArchetypeCard archetype={result.primary} highlight />

            <div className="rounded-[2rem] border border-[rgba(212,135,95,0.14)] bg-[linear-gradient(180deg,rgba(28,21,16,0.96),rgba(20,15,12,0.98))] p-6 shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Warum das passt</p>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Win Path</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.primary.winPath.map((step) => (
                    <span key={step} className="rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-3 py-1 text-xs font-semibold text-bjj-gold">
                      {step}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Schwerpunkt</p>
                <p className="mt-3 text-lg font-semibold text-white">{result.primary.topStyle}</p>
              </div>

              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Primaere Systeme</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.primary.primarySystems.map((system) => (
                    <span key={system} className="rounded-full border border-bjj-border bg-bjj-surface px-3 py-1 text-xs font-semibold text-white/82">
                      {system}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void continueWithArchetype()}
              disabled={savingSelection}
              className="rounded-2xl bg-bjj-gold px-8 py-4 text-base font-black uppercase tracking-[0.12em] text-bjj-coal transition hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSelection ? 'Speichert...' : 'Weiter'}
            </button>
            <button
              onClick={() => router.push('/archetype-test')}
              className="rounded-2xl border border-bjj-border bg-bjj-card px-8 py-4 text-base font-black uppercase tracking-[0.12em] text-white/82 transition hover:border-bjj-gold/25 hover:text-white"
            >
              Test wiederholen
            </button>
            {hasPendingSelection ? (
              <button
                onClick={() => router.push('/archetype-select')}
                className="rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 px-8 py-4 text-base font-black uppercase tracking-[0.12em] text-bjj-gold transition hover:bg-bjj-gold/15"
              >
                Archetypen auswaehlen
              </button>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}
