'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen bg-[#0a0908] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 md:px-8">
        <div className="w-full">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="text-sm font-bold text-bjj-gold">
              Frage {currentStep + 1} / {QUESTIONS.length}
            </div>
            {!authenticated && (
              <Link
                href="/login"
                className="rounded-xl bg-bjj-gold px-4 py-2 text-sm font-bold text-black transition hover:bg-bjj-gold/90"
              >
                Login
              </Link>
            )}
          </div>

          {/* Title */}
          <h1 className="mb-6 text-3xl font-black tracking-tight md:text-5xl">
            Welcher BJJ-Typ bist du?
          </h1>

          {/* Progress bar */}
          <div className="mb-8 h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-bjj-gold transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Question Card - Cleaner design */}
          <div className="mb-6">
            <h2 className="mb-6 text-xl font-bold md:text-2xl">{question.question}</h2>
            {question.helper ? <p className="mb-6 text-white/60">{question.helper}</p> : null}

            <div className={`grid gap-3 ${optionGridClass}`}>
              {question.options.map((option, index) => {
                const active = answers[question.id] === index

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => void handleAnswer(index)}
                    disabled={loading}
                    className={`rounded-xl p-4 text-left transition ${
                      active
                        ? 'bg-bjj-gold text-black'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {option.icon ? (
                        <span className="text-xl">{option.icon}</span>
                      ) : null}
                      <span className="font-bold">{option.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((value) => value - 1)}
                className="text-sm text-white/60 transition hover:text-white"
              >
                ← Zurück
              </button>
            ) : (
              <div />
            )}

            {loading && <span className="text-sm text-bjj-gold">Analysiere...</span>}
          </div>
        </div>
      </main>
    </div>
  )
}
