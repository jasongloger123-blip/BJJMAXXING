'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PublicAuthShell from '@/components/PublicAuthShell'
import { readPendingArchetypeResult } from '@/lib/public-archetype-result'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith('/')) {
    return '/'
  }

  return next
}

function RegisterPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nextPath = getSafeNextPath(searchParams.get('next'))

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      setError(payload.error ?? 'Registrierung fehlgeschlagen.')
      setLoading(false)
      return
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    })

    if (loginError) {
      setError(loginError.message ?? 'Login nach Registrierung fehlgeschlagen.')
      setLoading(false)
      return
    }

    await supabase.auth.getSession()
    await waitForAuthenticatedUser(supabase, 8, 250)

    const pendingResult = readPendingArchetypeResult()

    if (pendingResult) {
      // Speichere die Archetypen direkt im Profil
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          email: user.email,
          primary_archetype: pendingResult.primary.id,
          secondary_archetype: pendingResult.secondary.id,
        })
      }
      // Leite zum Archetyp-Ergebnis mit Namensabfrage
      window.location.assign('/archetype-result')
      return
    }

    // Bei neuer Registrierung ohne Archetyp-Test zur Startseite
    window.location.assign(nextPath)
  }

  return (
    <PublicAuthShell
      title={
        <>
          BJJ Athlet <span className="text-bjj-orange">werden</span>
        </>
      }
      subtitle="Erstelle dein Konto und starte dein Training."
      accent="orange"
      footer={
        <p className="text-xs font-bold text-bjj-muted transition-colors">
          Bereits angemeldet?{' '}
          <Link href={nextPath === '/' ? '/login' : `/login?next=${encodeURIComponent(nextPath)}`} className="text-white hover:text-bjj-orange">
            Zum Login
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-bjj-muted">
            Email Adresse
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="deine@email.de"
            className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-white outline-none transition-all placeholder:text-white/40 focus:border-bjj-orange sm:px-6 sm:py-4"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-bjj-muted">
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            placeholder="Mindestens 6 Zeichen"
            className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-white outline-none transition-all placeholder:text-white/40 focus:border-bjj-orange sm:px-6 sm:py-4"
          />
        </div>
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-bjj-orange py-4 text-lg font-black text-white shadow-orange-glow transition-all hover:scale-[1.02] hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60 sm:py-5 sm:text-xl"
        >
          {loading ? 'Registriert...' : 'REGISTRIEREN'}
        </button>
      </form>
    </PublicAuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f1419]" />}>
      <RegisterPageContent />
    </Suspense>
  )
}
