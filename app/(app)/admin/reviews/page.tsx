'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ReviewSubmission = {
  id: string
  user_id: string
  video_url: string
  notes: string | null
  review_type: string
  status: string
  reviewer_feedback: string | null
  created_at: string
  reviewed_at: string | null
  profile: {
    username?: string | null
    full_name?: string | null
    avatar_url?: string | null
  } | null
}

const reviewStatuses = [
  { id: 'submitted', label: 'Eingereicht' },
  { id: 'in_review', label: 'In Review' },
  { id: 'approved', label: 'Freigegeben' },
  { id: 'needs_work', label: 'Needs Work' },
]

export default function AdminReviewsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feedbackDraft, setFeedbackDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState('submitted')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadReviews() {
    setLoading(true)
    setError(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const response = await fetch('/api/admin/reviews', {
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : {},
    })
    const payload = (await response.json()) as {
      error?: string
      submissions?: ReviewSubmission[]
    }

    setLoading(false)

    if (!response.ok) {
      setError(payload.error ?? 'Reviews konnten nicht geladen werden.')
      return
    }

    const rows = payload.submissions ?? []
    setSubmissions(rows)

    const requestedReviewId = searchParams.get('review')
    const requestedReview = requestedReviewId ? rows.find((entry) => entry.id === requestedReviewId) : null
    const fallbackReview = rows[0] ?? null
    const initialReview = requestedReview ?? fallbackReview

    if (!selectedId && initialReview) {
      setSelectedId(initialReview.id)
      setFeedbackDraft(initialReview.reviewer_feedback ?? '')
      setStatusDraft(initialReview.status)
    }
  }

  useEffect(() => {
    void loadReviews()
  }, [searchParams])

  const selectedReview = useMemo(
    () => submissions.find((entry) => entry.id === selectedId) ?? null,
    [selectedId, submissions]
  )
  const openSubmissions = useMemo(
    () => submissions.filter((entry) => entry.status === 'submitted' || entry.status === 'in_review'),
    [submissions]
  )
  const processedSubmissions = useMemo(
    () => submissions.filter((entry) => entry.status === 'approved' || entry.status === 'needs_work'),
    [submissions]
  )

  useEffect(() => {
    if (!selectedReview) {
      return
    }

    setFeedbackDraft(selectedReview.reviewer_feedback ?? '')
    setStatusDraft(selectedReview.status)
  }, [selectedReview])

  async function saveReview() {
    if (!selectedReview) {
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const response = await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
            }
          : {}),
      },
      body: JSON.stringify({
        id: selectedReview.id,
        status: statusDraft,
        reviewerFeedback: feedbackDraft,
      }),
    })

    const payload = (await response.json()) as { error?: string }
    setSaving(false)

    if (!response.ok) {
      setError(payload.error ?? 'Review konnte nicht gespeichert werden.')
      return
    }

    setSuccess('Review gespeichert.')
    await loadReviews()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-5 shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Admin Review Queue</p>
        <h1 className="mt-3 font-display text-4xl font-black">A-Plan Einreichungen</h1>

        {loading ? <div className="mt-6 h-40 rounded-3xl border border-bjj-border bg-bjj-surface shimmer" /> : null}
        {error ? <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div> : null}
        <div className="mt-6 space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Offen</p>
              <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
                {openSubmissions.length}
              </span>
            </div>
            <div className="space-y-3">
              {openSubmissions.map((submission) => {
                const label = submission.profile?.username ?? submission.profile?.full_name ?? submission.user_id.slice(0, 8)
                const active = submission.id === selectedId

                return (
                  <button
                    key={submission.id}
                    type="button"
                    onClick={() => setSelectedId(submission.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active
                        ? 'border-bjj-gold/40 bg-bjj-gold/10'
                        : 'border-bjj-border bg-bjj-surface hover:border-bjj-gold/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-white">{label}</p>
                      <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
                        {submission.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-bjj-muted">{submission.video_url}</p>
                    <p className="mt-2 text-xs text-bjj-muted">
                      {new Date(submission.created_at).toLocaleString('de-DE')}
                    </p>
                  </button>
                )
              })}
              {!loading && openSubmissions.length === 0 ? (
                <div className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
                  Keine offenen Review-Einreichungen.
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Bereits bearbeitet</p>
              <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
                {processedSubmissions.length}
              </span>
            </div>
            <div className="space-y-3">
              {processedSubmissions.map((submission) => {
                const label = submission.profile?.username ?? submission.profile?.full_name ?? submission.user_id.slice(0, 8)
                const active = submission.id === selectedId

                return (
                  <button
                    key={submission.id}
                    type="button"
                    onClick={() => setSelectedId(submission.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active
                        ? 'border-bjj-gold/40 bg-bjj-gold/10'
                        : 'border-bjj-border bg-bjj-surface hover:border-bjj-gold/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-white">{label}</p>
                      <span className="rounded-full border border-bjj-border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">
                        {submission.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-bjj-muted">{submission.video_url}</p>
                    <p className="mt-2 text-xs text-bjj-muted">
                      {new Date(submission.created_at).toLocaleString('de-DE')}
                    </p>
                  </button>
                )
              })}
              {!loading && processedSubmissions.length === 0 ? (
                <div className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
                  Noch keine bearbeiteten Reviews.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
        {!selectedReview ? (
          <div className="rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-5 text-sm text-bjj-muted">
            Waehle links eine Einreichung aus.
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Review Detail</p>
              <h2 className="mt-2 text-3xl font-black text-white">
                {selectedReview.profile?.username ?? selectedReview.profile?.full_name ?? 'Unbekannter Nutzer'}
              </h2>
              <p className="mt-3 text-sm text-bjj-muted">
                Eingereicht am {new Date(selectedReview.created_at).toLocaleString('de-DE')}
              </p>
            </div>

            <div className="rounded-2xl border border-bjj-border bg-bjj-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Video</p>
              <a
                href={selectedReview.video_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-semibold text-bjj-gold hover:text-bjj-orange-light"
              >
                Link oeffnen
              </a>
              <p className="mt-2 break-all text-sm text-bjj-muted">{selectedReview.video_url}</p>
            </div>

            <div className="rounded-2xl border border-bjj-border bg-bjj-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Nutzer-Notizen</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-bjj-text">
                {selectedReview.notes?.trim() || 'Keine Notizen angegeben.'}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Status</p>
                <div className="mt-3 space-y-2">
                  {reviewStatuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => setStatusDraft(status.id)}
                      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                        statusDraft === status.id ? 'bg-bjj-gold text-bjj-coal' : 'bg-bjj-surface text-bjj-muted'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Feedback fuer den Nutzer</p>
                <textarea
                  value={feedbackDraft}
                  onChange={(event) => setFeedbackDraft(event.target.value)}
                  rows={10}
                  placeholder="Was war gut? Was fehlt noch? Welcher naechste Schritt ist sinnvoll?"
                  className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-3 text-sm text-bjj-text"
                />
              </div>
            </div>

            {success ? <div className="rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-3 text-sm text-bjj-text">{success}</div> : null}

            <button
              type="button"
              onClick={() => void saveReview()}
              disabled={saving}
              className="rounded-2xl bg-bjj-gold px-6 py-4 text-lg font-black text-bjj-coal transition-colors hover:bg-bjj-orange-light"
            >
              {saving ? 'Speichert...' : 'Review speichern'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
