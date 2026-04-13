'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ResetResult = {
  ok?: boolean
  message?: string
  error?: string
  profile?: {
    id: string
    username: string | null
    full_name: string | null
    email: string | null
  }
}

export default function AdminProgressResetPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResetResult | null>(null)

  async function resetProgress() {
    if (!query.trim() || loading) return

    setLoading(true)
    setResult(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/admin/progress-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ query: query.trim() }),
      })
      const payload = (await response.json()) as ResetResult
      setResult(payload)
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unbekannter Fehler.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-bjj-gold">Admin Tool</p>
        <h1 className="mt-2 text-3xl font-black text-white">Fortschritt resetten</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          Setzt `training_clip_events` und `progress` fuer einen User zurueck. Danach startet Startseite und Gameplan wieder bei 0.
        </p>
      </div>

      <section className="rounded-[1.6rem] border border-red-500/25 bg-red-500/[0.06] p-5">
        <div className="flex gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <h2 className="font-bold text-white">Achtung</h2>
            <p className="mt-1 text-sm leading-6 text-white/62">
              Diese Aktion loescht den kompletten Fortschritt des ausgewaehlten Users. Das ist absichtlich fuer Tests gedacht.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
        <label className="text-sm font-bold text-white" htmlFor="user-query">
          User suchen
        </label>
        <input
          id="user-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="E-Mail, Username oder User-ID"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-bjj-gold/40"
        />

        <button
          type="button"
          onClick={() => void resetProgress()}
          disabled={loading || !query.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Fortschritt resetten
        </button>
      </section>

      {result ? (
        <section className={`rounded-[1.4rem] border p-4 ${result.ok ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-red-400/25 bg-red-500/10'}`}>
          <p className="font-bold text-white">{result.ok ? result.message ?? 'Fortschritt wurde zurueckgesetzt.' : result.error ?? 'Reset fehlgeschlagen.'}</p>
          {result.profile ? (
            <p className="mt-2 text-sm text-white/62">
              {result.profile.email ?? result.profile.username ?? result.profile.id} · {result.profile.id}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
