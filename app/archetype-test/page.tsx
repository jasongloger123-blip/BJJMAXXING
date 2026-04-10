'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { QUESTIONS, calculateArchetype } from '@/lib/archetypes'
import { saveArchetypeResult } from '@/lib/public-archetype-result'
import { createClient } from '@/lib/supabase/client'

export default function ArchetypeTestPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  const question = QUESTIONS[currentStep]
  const progress = useMemo(() => ((currentStep + 1) / QUESTIONS.length) * 100, [currentStep])
  const optionGridClass =
    question.options.length === 4
      ? 'grid-cols-1 sm:grid-cols-2'
      : question.options.length === 3
        ? 'grid-cols-1 md:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2'

  useEffect(() => {
    let active = true

    async function loadAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return
      setAuthenticated(Boolean(user))
    }

    void loadAuthState()
    return () => {
      active = false
    }
  }, [supabase])

  async function handleAnswer(optionIndex: number) {
    const nextAnswers = { ...answers, [question.id]: optionIndex }
    setAnswers(nextAnswers)

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep((value) => value + 1)
      return
    }

    setLoading(true)
    const result = calculateArchetype(nextAnswers)
    saveArchetypeResult(result, true)

    router.push('/archetype-result')
  }

  return (
    <div className="min-h-screen bg-[#0d0b09] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 md:px-8">
        <section className="relative w-full overflow-hidden rounded-[2.8rem] border border-bjj-border bg-[#120f0d] px-6 py-8 shadow-card md:px-10 md:py-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(217,159,92,0.2),transparent_72%)]" />

          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Schritt 2</p>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] md:text-6xl">Welcher Archetyp passt zu dir?</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/64 md:text-base">
                  Beantworte ein paar kurze Fragen und wir legen deinen Startpunkt im System direkt passend fest.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start">
                <Link
                  href={authenticated ? '/' : '/'}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1a1714] px-4 py-3 text-sm font-bold text-white/70 transition hover:border-bjj-gold/25 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Zurueck
                </Link>
                {!authenticated ? (
                  <Link
                    href="/login"
                    className="inline-flex rounded-2xl border border-bjj-gold/20 bg-[rgba(212,135,95,0.12)] px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-bjj-gold transition hover:bg-[rgba(212,135,95,0.18)]"
                  >
                    Login
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-full bg-black/30">
              <div className="h-2 rounded-full bg-[linear-gradient(90deg,#d99f5c,#f0c27b)] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            <div className="rounded-[2rem] border border-[rgba(212,135,95,0.14)] bg-[linear-gradient(180deg,rgba(28,21,16,0.96),rgba(20,15,12,0.98))] p-5 md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-bjj-gold">
                Frage {String(currentStep + 1).padStart(2, '0')} von {String(QUESTIONS.length).padStart(2, '0')}
              </p>
              <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.03em] md:text-4xl">{question.question}</h2>
              {question.helper ? <p className="mt-3 max-w-2xl text-sm leading-7 text-white/64 md:text-base">{question.helper}</p> : null}

              <div className={`mt-8 grid gap-4 ${optionGridClass}`}>
                {question.options.map((option, index) => {
                  const active = answers[question.id] === index

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => void handleAnswer(index)}
                      disabled={loading}
                      className={`rounded-[1.8rem] border px-5 py-5 text-left transition md:px-6 md:py-6 ${
                        active
                          ? 'border-bjj-gold/40 bg-bjj-gold/10 shadow-orange-glow-sm'
                          : 'border-white/8 bg-[#171310] hover:border-bjj-gold/20 hover:bg-[#1d1713]'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {option.icon ? (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10 text-lg font-black text-bjj-gold">
                            <span aria-hidden="true">{option.icon}</span>
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <div className="text-lg font-black text-white md:text-xl">{option.label}</div>
                          <div className="mt-2 text-sm leading-6 text-white/64 md:text-base">{option.description}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex min-h-10 items-center justify-between gap-4">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((value) => value - 1)}
                  className="text-sm font-bold text-white/60 transition hover:text-white"
                >
                  Zurueck zur vorherigen Frage
                </button>
              ) : (
                <div />
              )}

              {loading ? <p className="text-sm font-semibold text-bjj-gold">Analyse wird vorbereitet...</p> : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
