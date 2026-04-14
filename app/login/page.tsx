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

function LoginPageContent() {
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

    try {
      // Use server API for login to set HTTP-only cookies
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const message = data.error?.toLowerCase().includes('email not confirmed')
          ? 'Diese E-Mail ist noch nicht bestaetigt. Registriere dich bitte noch einmal, damit der Account repariert wird.'
          : data.error ?? 'Login fehlgeschlagen.'
        setError(message)
        setLoading(false)
        return
      }

      // Now set the session in the browser client
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })

      if (signInData.session) {
        await supabase.auth.setSession({
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        })
      }

      // Sync and redirect
      await supabase.auth.getSession()
      await waitForAuthenticatedUser(supabase, 8, 250)

      const pendingResult = readPendingArchetypeResult()

      if (pendingResult) {
        window.location.assign('/archetype-result')
        return
      }

      window.location.assign(nextPath)
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Login fehlgeschlagen.')
      setLoading(false)
    }
  }

  return (
    <PublicAuthShell
      title={
        <>
          Willkommen <span className="text-bjj-gold">zurueck</span>
        </>
      }
      subtitle="Logge dich ein, um mit deinem Gameplan weiterzumachen."
      accent="orange"
      footer={
        <p className="text-xs font-bold text-bjj-muted transition-colors">
          Noch kein Konto?{' '}
          <Link href={nextPath === '/' ? '/register' : `/register?next=${encodeURIComponent(nextPath)}`} className="text-white hover:text-bjj-gold">
            Jetzt registrieren
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
            className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-white outline-none transition-all placeholder:text-white/40 focus:border-bjj-gold sm:px-6 sm:py-4"
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
            placeholder="Passwort"
            className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-white outline-none transition-all placeholder:text-white/40 focus:border-bjj-gold sm:px-6 sm:py-4"
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
          className="w-full rounded-2xl bg-bjj-gold py-4 text-lg font-black text-bjj-coal transition-all hover:scale-[1.02] hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60 sm:py-5 sm:text-xl"
        >
          {loading ? 'Anmelden...' : 'ANMELDEN'}
        </button>
      </form>
    </PublicAuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f1419]" />}>
      <LoginPageContent />
    </Suspense>
  )
}
