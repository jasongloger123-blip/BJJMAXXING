'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ReviewPage() {
  const [supabase] = useState(() => createClient())
  const [videoUrl, setVideoUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [reviewType, setReviewType] = useState<'manual' | 'ai'>('manual')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSuccess(null)
    setError(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setSaving(false)
      setError('Nicht eingeloggt.')
      return
    }

    const response = await fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        videoUrl,
        notes: notes || null,
        reviewType,
      }),
    })
    const payload = (await response.json()) as { error?: string }

    setSaving(false)

    if (!response.ok) {
      setError(payload.error || 'Review konnte nicht eingereicht werden.')
      return
    }

    setSuccess('Review eingereicht. Jetzt kann manuell oder spaeter per KI bewertet werden, ob du den A-Plan stabil kannst.')
    setVideoUrl('')
    setNotes('')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Review</p>
        <h1 className="mt-2 font-display text-4xl font-black">Sende dein A-Plan Video ein.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bjj-muted">
          Wenn deine ersten vier Core-Nodes im Gameplan erledigt sind, nimm ein Video auf und schick es zur Bewertung ein.
          Entweder manuell durch dich oder spaeter optional per KI.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
        <div className="grid gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Video Link</p>
            <input
              type="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://drive.google.com/... oder https://youtube.com/..."
              className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3"
              required
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Bewertungsart</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {[
                { id: 'manual', label: 'Manuell' },
                { id: 'ai', label: 'KI spaeter' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReviewType(option.id as 'manual' | 'ai')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    reviewType === option.id ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Technik</p>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="Was genau soll bewertet werden? Welche Sequenz zeigst du?"
              className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3"
            />
          </div>

          {error && <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}
          {success && <div className="rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-3 text-sm text-bjj-text">{success}</div>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-bjj-gold px-6 py-4 text-lg font-black text-bjj-coal transition-colors hover:bg-bjj-orange-light"
          >
            {saving ? 'Sendet...' : 'Review einreichen'}
          </button>
        </div>
      </form>
    </div>
  )
}
