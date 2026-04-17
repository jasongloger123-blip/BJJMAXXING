'use client'

import { Suspense, useState, useCallback } from 'react'
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

// Get the project reference from the Supabase URL
const getProjectRef = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  const match = url.match(/https:\/\/([^.]+)/)
  return match?.[1] ?? null
}

// Get the expected cookie name
const getCookieName = () => {
  const projectRef = getProjectRef()
  return projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
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
          ? 'Diese E-Mail ist noch nicht bestätigt. Registriere dich bitte noch einmal, damit der Account repariert wird.'
          : data.error ?? 'Login fehlgeschlagen.'
        setError(message)
        setLoading(false)
        return
      }

      // Server has set HTTP-only cookie - give browser time to process it
      await new Promise(resolve => setTimeout(resolve, 500))

      // Manually read the cookie to verify it was set
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null
        return null
      }
      
      const cookieName = getCookieName()
      const authCookie = getCookie(cookieName)
      console.log('Login: Auth cookie after server login:', { cookieName, hasCookie: !!authCookie, cookieLength: authCookie?.length })

      // Try to get session from cookie - retry a few times
      let session = null
      for (let i = 0; i < 10; i++) {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (s) {
          session = s
          console.log('Login: Session found on attempt', i + 1)
          break
        }
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      // Also save token to localStorage as backup for cross-browser compatibility
      if (session?.access_token) {
        try {
          localStorage.setItem('sb-auth-token', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }))
          console.log('Login: Token saved to localStorage as backup')
        } catch {}
      }

      if (!session) {
        console.log('Login: No session from cookie, falling back to direct sign in')
        // Fallback: try direct sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        })
        if (signInError) {
          console.error('Login: Direct sign in failed:', signInError)
          setError('Session konnte nicht erstellt werden. Bitte versuche es erneut.')
          setLoading(false)
          return
        }
        if (!signInData.session) {
          setError('Session konnte nicht erstellt werden. Bitte versuche es erneut.')
          setLoading(false)
          return
        }
        console.log('Login: Direct sign in succeeded')
        
        // Save direct sign in token to localStorage too
        if (signInData.session?.access_token) {
          try {
            localStorage.setItem('sb-auth-token', JSON.stringify({
              access_token: signInData.session.access_token,
              refresh_token: signInData.session.refresh_token,
            }))
          } catch {}
        }
      }

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
          Willkommen <span className="text-bjj-gold">zurück</span>
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
