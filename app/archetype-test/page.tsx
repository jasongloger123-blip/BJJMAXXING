'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Zap } from 'lucide-react'
import { QUESTIONS, calculateArchetype } from '@/lib/archetypes'
import { createClient } from '@/lib/supabase/client'
import { saveArchetypeResult } from '@/lib/public-archetype-result'
import { useRouter } from 'next/navigation'

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
      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
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
    saveArchetypeResult(result, !authenticated)

    if (authenticated) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          primary_archetype: result.primary.id,
          secondary_archetype: result.secondary.id,
        })
        window.dispatchEvent(new Event('profile-ready-changed'))
      }
    }

    router.push('/archetype-result')
  }

  return (
    <div className="landing-shell min-h-screen text-white">
      <main className="relative px-6 pb-12 pt-24 md:pb-20 md:pt-32">
        <div className="fixed -left-24 -top-24 h-64 w-64 rounded-full bg-[#ff00ff]/10 blur-[120px] pointer-events-none md:h-96 md:w-96" />
        <div className="fixed right-[-6rem] top-1/2 h-64 w-64 rounded-full bg-[#00f2ff]/10 blur-[120px] pointer-events-none md:h-96 md:w-96" />

        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ff00ff,#00f2ff)] shadow-[0_0_20px_rgba(255,0,255,0.3)] transition-transform duration-500 group-hover:scale-105">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-public-display text-2xl font-black uppercase tracking-tight">
                BJJ<span className="text-[#ff00ff]">MAXXING</span>
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <Link href="/" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-white">
                Zurueck
              </Link>
              {!authenticated ? (
                <Link href="/login" className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-black uppercase tracking-[0.2em] transition-all hover:bg-white hover:text-black">
                  Login
                </Link>
              ) : null}
            </div>
          </header>

          <div className="mx-auto mb-8 max-w-4xl text-center md:mb-12">
            <h1 className="font-public-display text-3xl font-black uppercase tracking-tight md:text-5xl lg:text-6xl">
              Wer bist du auf der <span className="landing-neon-text">Matte?</span>
            </h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-slate-400 md:text-lg lg:text-xl">Mach den Archetypen-Quiz jetzt kostenlos.</p>
          </div>

          <div className="landing-glass-card relative overflow-hidden rounded-[2rem] border-2 border-white/5 p-6 md:rounded-[3rem] md:p-10 lg:p-12">
            <div className="absolute left-0 top-0 h-2 w-full overflow-hidden bg-white/5">
              <div
                className="h-full bg-[linear-gradient(90deg,#ff00ff,#00f2ff)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mb-8 md:mb-10">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-[#ff00ff]">
                Schritt {String(currentStep + 1).padStart(2, '0')} von {String(QUESTIONS.length).padStart(2, '0')}
              </span>
              <h2 className="font-public-display max-w-3xl text-2xl font-bold uppercase tracking-tight md:text-3xl lg:text-4xl">
                {question.question}
              </h2>
              {question.helper ? <p className="mt-2 max-w-2xl text-sm text-slate-400 md:text-base lg:text-lg">{question.helper}</p> : null}
            </div>

            <div className={`grid gap-3 md:gap-5 ${optionGridClass}`}>
              {question.options.map((option, index) => {
                const active = answers[question.id] === index

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => void handleAnswer(index)}
                    disabled={loading}
                    className={`landing-bento flex w-full rounded-[1.6rem] border-2 p-4 text-left transition-all md:p-6 lg:min-h-[260px] lg:rounded-[2rem] lg:p-7 ${
                      active
                        ? 'border-[#ff00ff] bg-[#ff00ff]/10 shadow-[0_0_20px_rgba(255,0,255,0.2)]'
                        : 'border-white/5 bg-white/5 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-start gap-3 lg:flex-col lg:items-start lg:gap-6">
                      {option.icon ? (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/15 text-2xl md:h-14 md:w-14 md:text-3xl lg:h-16 lg:w-16 lg:text-4xl">
                          <span aria-hidden="true">{option.icon}</span>
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="text-base font-bold leading-tight md:text-xl lg:text-[1.75rem]">{option.label}</div>
                        <div className="mt-1 max-w-[22rem] text-sm leading-relaxed text-slate-400 md:text-base lg:mt-3 lg:text-lg">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-4 md:mt-16 md:flex-row">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((value) => value - 1)}
                  className="order-2 py-3 font-bold text-slate-400 transition-colors hover:text-white md:order-1"
                >
                  Zurueck
                </button>
              ) : (
                <div />
              )}

              <div />
            </div>
          </div>

          {loading ? <p className="mt-4 text-center text-sm text-slate-400">Analyse wird vorbereitet...</p> : null}
        </div>
      </main>
    </div>
  )
}
