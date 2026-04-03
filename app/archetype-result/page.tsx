'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ARCHETYPES } from '@/lib/archetypes'
import { ArchetypeCard } from '@/components/ArchetypeCard'
import { clearPendingArchetypeResult, readArchetypeResult, readPendingArchetypeResult, type ArchetypeResultData } from '@/lib/public-archetype-result'
import { createClient } from '@/lib/supabase/client'

export default function ArchetypeResultPage() {
  const router = useRouter()
  const supabase = createClient()
  const [result, setResult] = useState<ArchetypeResultData | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadResult = useCallback(async () => {
    const stored = readArchetypeResult()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isAuthenticated = Boolean(user)
    setAuthenticated(isAuthenticated)

    if (!stored && !user) {
      router.push('/archetype-test')
      return
    }

    if (user) {
      const pending = readPendingArchetypeResult()

      if (pending) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          primary_archetype: pending.primary.id,
          secondary_archetype: pending.secondary.id,
        })
        clearPendingArchetypeResult()
        window.dispatchEvent(new Event('profile-ready-changed'))
      }

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

  useEffect(() => {
    void loadResult()
  }, [loadResult])

  const maxScore = useMemo(() => {
    if (!result) return 0
    return Math.max(...Object.values(result.scores))
  }, [result])

  if (loading || !result) {
    return <div className="landing-shell min-h-screen" />
  }

  if (!authenticated) {
    return (
      <div className="landing-shell min-h-screen text-white">
        <main className="relative px-6 pb-20 pt-24">
          <div className="fixed -left-24 -top-24 h-64 w-64 rounded-full bg-[#ff00ff]/10 blur-[120px] pointer-events-none md:h-96 md:w-96" />
          <div className="fixed right-[-6rem] top-1/2 h-64 w-64 rounded-full bg-[#00f2ff]/10 blur-[120px] pointer-events-none md:h-96 md:w-96" />

          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ccff00]">Quiz abgeschlossen</p>
            <h1 className="font-public-display mt-4 text-4xl font-black uppercase tracking-tight md:text-6xl">
              Dein Ergebnis ist <span className="landing-neon-text">bereit</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 md:text-lg">
              Wir haben deinen Archetyp analysiert. Schalte jetzt dein Ergebnis frei und speichere es direkt in deinem Profil.
            </p>

            <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-md md:p-10">
              <div className="mx-auto max-w-2xl blur-[8px] saturate-75">
                <ArchetypeCard archetype={result.primary} highlight />
              </div>
              <div className="mt-8">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Registrierung noetig fuer:
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {['Voller Archetyp', 'Gespeicherter Startplan', 'Naechster sinnvoller Schritt'].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-semibold text-white/85">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="rounded-full bg-white px-8 py-5 text-lg font-black uppercase tracking-tight text-[#0f1419] transition-transform hover:scale-105"
              >
                Ergebnis freischalten
              </Link>
            </div>

            <p className="mt-5 text-sm text-slate-400">
              Schon registriert?{' '}
              <Link href="/login" className="font-semibold text-white transition-colors hover:text-[#00f2ff]">
                Dann hier einloggen
              </Link>
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="landing-shell min-h-screen text-white">
      <main className="relative px-6 pb-20 pt-24">
        <div className="fixed -left-24 -top-24 h-64 w-64 rounded-full bg-[#ff00ff]/10 blur-[120px] pointer-events-none md:h-96 md:w-96" />
        <div className="fixed right-[-6rem] top-1/2 h-64 w-64 rounded-full bg-[#00f2ff]/10 blur-[120px] pointer-events-none md:h-96 md:w-96" />

        <div className="mx-auto max-w-4xl space-y-6">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#ccff00]">Dein Ergebnis</p>
            <h1 className="font-public-display mt-3 text-4xl font-black uppercase tracking-tight md:text-6xl">
              Dein Archetyp und dein Startpunkt
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 md:text-base">
              Du bekommst keinen riesigen Technikbaum. Du bekommst einen festen BJJ-Plan mit dem naechsten klaren Schritt.
            </p>
          </div>

          <ArchetypeCard archetype={result.primary} highlight />

          <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
            <div className="landing-glass-card rounded-3xl p-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Sekundaerer Archetyp</p>
              <div className="mt-4">
                <ArchetypeCard archetype={result.secondary} compact />
              </div>
            </div>

            <div className="landing-glass-card rounded-3xl p-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Scoring-Matrix</p>
              <div className="mt-5 space-y-4">
                {ARCHETYPES.map((archetype) => {
                  const score = result.scores[archetype.id] ?? 0
                  const width = maxScore ? (score / maxScore) * 100 : 0

                  return (
                    <div key={archetype.id}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{archetype.name}</span>
                        <span className="text-slate-400">{score.toFixed(score % 1 === 0 ? 0 : 1)} Punkte</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff00ff,#00f2ff)]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="landing-glass-card rounded-[2rem] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ccff00]">Dein MVP Plan</p>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {['Entry', 'Position', 'Control', 'Transition', 'Finish'].map((phase, index) => (
                <div key={phase} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Node {index + 1}</p>
                  <p className="mt-2 font-semibold">{phase}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push('/')}
              className="rounded-full bg-white px-8 py-4 text-lg font-black text-[#0f1419] transition-transform hover:scale-105"
            >
              Weiter
            </button>
            <button
              onClick={() => router.push('/archetype-test')}
              className="rounded-full border border-white/20 bg-white/10 px-8 py-4 text-lg font-semibold transition-transform hover:scale-105"
            >
              Test wiederholen
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
