'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PublicAuthShell from '@/components/PublicAuthShell'
import { readPendingArchetypeResult } from '@/lib/public-archetype-result'

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const pendingResult = readPendingArchetypeResult()

    if (pendingResult) {
      window.location.assign('/archetype-result')
      return
    }

    window.location.assign(nextPath)
  }

  return (
    <PublicAuthShell
      title={
        <>
          Warrior <span className="text-[#00f2ff]">werden</span>
        </>
      }
      subtitle="Erstelle dein Konto und starte dein Training."
      accent="blue"
      footer={
        <p className="text-xs font-bold text-slate-500 transition-colors">
          Bereits angemeldet?{' '}
          <Link href={nextPath === '/' ? '/login' : `/login?next=${encodeURIComponent(nextPath)}`} className="text-white hover:text-[#00f2ff]">
            Zum Login
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Email Adresse
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="deine@email.de"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition-all sm:px-6 sm:py-4"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            placeholder="Mindestens 6 Zeichen"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition-all sm:px-6 sm:py-4"
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
          className="w-full rounded-2xl bg-[#00f2ff] py-4 text-lg font-black text-[#0a0118] shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:py-5 sm:text-xl"
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
