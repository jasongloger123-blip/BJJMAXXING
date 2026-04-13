'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { readArchetypeResult, readPendingArchetypeResult, clearPendingArchetypeResult, type ArchetypeResultData } from '@/lib/public-archetype-result'
import { ARCHETYPES } from '@/lib/archetypes'

export default function NameInputPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [result, setResult] = useState<ArchetypeResultData | null>(null)

  const loadResult = useCallback(async () => {
    const stored = readArchetypeResult()
    const pending = readPendingArchetypeResult()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Wenn pending Result existiert, verwende es
    if (pending) {
      setResult(pending)
      setChecking(false)
      return
    }

    // Wenn kein Result existiert, prüfe ob Archetypen bereits im Profil sind
    if (!stored) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('primary_archetype, full_name')
        .eq('id', user.id)
        .maybeSingle()

      // Wenn bereits Name und Archetyp vorhanden, direkt zur Startseite
      if (profile?.full_name && profile?.primary_archetype) {
        router.push('/')
        return
      }

      // Wenn Archetyp vorhanden aber kein Name, bleib hier
      if (profile?.primary_archetype) {
        const primary = ARCHETYPES.find((a) => a.id === profile.primary_archetype)
        const secondary = ARCHETYPES.find((a) => a.id === profile.secondary_archetype)
        if (primary) {
          setResult({ primary, secondary: secondary || ARCHETYPES[1], scores: {} })
          setChecking(false)
          return
        }
      }

      // Kein Archetyp, zurück zum Test
      router.push('/archetype-test')
      return
    }

    setResult(stored)
    setChecking(false)
  }, [router, supabase])

  useEffect(() => {
    void loadResult()
  }, [loadResult])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!fullName.trim() || !result) return

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Speichere Archetypen und Name im Profil
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName.trim(),
      primary_archetype: result.primary.id,
      secondary_archetype: result.secondary.id,
    })

    if (error) {
      setLoading(false)
      return
    }

    clearPendingArchetypeResult()
    window.dispatchEvent(new Event('profile-ready-changed'))

    // Weiter zum Onboarding für Gym
    router.push('/onboarding')
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bjj-bg">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-bjj-border border-t-bjj-gold" />
      </div>
    )
  }

  if (!result) {
    return null
  }

  return (
    <div className="min-h-screen bg-bjj-bg text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-10">
        <section className="w-full rounded-[2.8rem] border border-bjj-border bg-bjj-card px-6 py-10 text-center shadow-card md:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Willkommen bei BJJMAXXING</p>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Wie sollen wir dich nennen?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-bjj-muted">
            Dein Archetyp ist <span className="font-bold text-bjj-gold">{result.primary.name}</span>.
            <br />
            Wähle einen Namen für dein Profil.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-bjj-muted">
                Dein Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="z.B. Max Mustermann"
                className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-4 text-center text-lg text-white outline-none transition-all placeholder:text-white/40 focus:border-bjj-gold sm:px-6"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !fullName.trim()}
              className="w-full rounded-2xl bg-bjj-gold py-4 text-lg font-black uppercase tracking-[0.12em] text-bjj-coal transition hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Speichert...' : 'Weiter'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
