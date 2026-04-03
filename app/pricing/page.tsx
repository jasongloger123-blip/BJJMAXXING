'use client'

import Link from 'next/link'
import { ArrowLeft, Check, Minus, Sparkles, Star, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { STRIPE_PRODUCTS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/client'

const productCards = [
  {
    key: 'guardPack',
    title: 'Casual',
    badge: 'Starter',
    price: '0EUR',
    cadence: '/monat',
    description: 'Perfekt fuer den Einstieg in die BJJMAXXING Welt.',
    features: [
      { label: 'Archetyp-Test und Einstieg', included: true },
      { label: 'Basis Gameplan', included: true },
      { label: 'Produkt kennenlernen', included: true },
      { label: 'Woechentliche Video Reviews', included: false },
      { label: 'Live Coaching Calls', included: false },
    ],
    href: '/register',
    cta: 'Gratis loslegen',
    featured: false,
  },
  {
    key: 'membership',
    title: 'MAXXING',
    badge: 'Beliebtestes Level',
    price: '20EUR',
    cadence: '/monat',
    description: 'Alles was du brauchst, um dein Spiel ernsthaft zu vertiefen.',
    features: [
      { label: 'Alles aus dem Casual Plan', included: true },
      { label: '1:1 Video Reviews', included: true },
      { label: 'Komplette Technik-Library', included: true },
      { label: 'Live Coaching Calls', included: true },
      { label: 'Premium Erweiterungen', included: true },
    ],
    href: 'checkout',
    cta: 'Jetzt maxxen',
    featured: true,
  },
] as const

const comparisonRows = [
  { label: 'Koerpertyp Analyse', casual: true, maxxing: true },
  { label: 'Persoenlicher Gameplan', casual: true, maxxing: true },
  { label: 'Sparring Video Review', casual: false, maxxing: true },
  { label: 'Live Coaching Calls', casual: false, maxxing: true },
  { label: 'Premium Technik Library', casual: false, maxxing: true },
  { label: 'Pro Support und Erweiterungen', casual: false, maxxing: true },
]

const testimonials = [
  {
    quote: 'Ich hatte zum ersten Mal das Gefuehl, dass mein Training in eine Richtung laeuft statt nur mehr Content zu sammeln.',
    name: 'Luca',
    accent: 'blue',
  },
  {
    quote: 'Der Wechsel von Casual zu MAXXING war fuer mich der Punkt, an dem aus Inspiration ein echter Trainingsplan wurde.',
    name: 'Deniz',
    accent: 'pink',
  },
  {
    quote: 'Besonders stark ist, dass Reviews und Systeme zusammenhaengen. Man bekommt nicht nur Tipps, sondern einen Pfad.',
    name: 'Mara',
    accent: 'green',
  },
]

export default function PricingPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const autoCheckoutStarted = useRef(false)

  useEffect(() => {
    let active = true

    async function loadAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) {
        return
      }

      setAuthenticated(Boolean(user))
      setAuthChecked(true)
    }

    void loadAuthState()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return
      }

      setAuthenticated(Boolean(session?.user))
      setAuthChecked(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  async function startCheckout(productKey: keyof typeof STRIPE_PRODUCTS) {
    setLoadingKey(productKey)
    setMessage(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey, accessToken: session?.access_token ?? null }),
      })

      const payload = (await response.json()) as { url?: string; error?: string }

      if (response.status === 401) {
        if (session?.user || authenticated) {
          setMessage('Deine Session wird gerade synchronisiert. Bitte versuche es noch einmal in 1-2 Sekunden.')
          setLoadingKey(null)
          return
        }

        const nextPath = `/pricing?autocheckout=${encodeURIComponent(productKey)}`
        window.location.assign(`/register?next=${encodeURIComponent(nextPath)}`)
        return
      }

      if (!response.ok || !payload.url) {
        setMessage(payload.error ?? 'Checkout konnte nicht gestartet werden.')
        setLoadingKey(null)
        return
      }

      window.location.href = payload.url
    } catch {
      setMessage('Stripe ist noch nicht vollstaendig konfiguriert. Die UI ist aber vorbereitet.')
      setLoadingKey(null)
    }
  }

  useEffect(() => {
    const autoCheckout = searchParams.get('autocheckout')
    const cancelled = searchParams.get('checkout') === 'cancelled'

    if (cancelled) {
      setMessage('Checkout abgebrochen. Du kannst es jederzeit erneut versuchen.')
    }

    if (
      autoCheckoutStarted.current ||
      !authChecked ||
      !autoCheckout ||
      !(autoCheckout in STRIPE_PRODUCTS)
    ) {
      return
    }

    autoCheckoutStarted.current = true
    void startCheckout(autoCheckout as keyof typeof STRIPE_PRODUCTS)
  }, [searchParams])

  return (
    <div className="landing-shell min-h-screen selection:bg-[#ff00ff] selection:text-white text-white">
      <main className="pt-20 md:pt-24">
        <section className="mb-16 px-6 text-center">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurueck zur Landingpage
            </Link>
          </div>

          <div className="landing-floating inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1">
            <span className="text-xs font-bold uppercase tracking-widest text-[#ccff00]">
              Maximiere dein Potential
            </span>
          </div>

          <h1 className="font-public-display mt-6 text-4xl font-black uppercase tracking-tight md:text-6xl lg:text-7xl">
            Waehle dein <span className="landing-neon-text">Level</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-slate-400 md:text-lg lg:text-xl">
            Egal ob du gerade startest oder bereit fuer den naechsten grossen Sprung bist. Hier findest du den passenden Plan.
          </p>
        </section>

        <section id="tiers" className="mb-16 px-6 md:mb-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch md:gap-8">
            {productCards.map((tier) =>
              tier.featured ? (
                <article key={tier.key} className="rounded-[2rem] bg-[linear-gradient(135deg,#ff00ff,#00f2ff)] p-1 shadow-[0_0_60px_rgba(255,0,255,0.2)] lg:scale-105">
                  <div className="flex h-full flex-col rounded-[calc(2rem-4px)] bg-[#0a0118] p-6 md:p-12">
                    <div className="mb-10">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <h2 className="font-public-display text-4xl font-bold uppercase text-[#ff00ff]">{tier.title}</h2>
                        <div className="rounded-full bg-[#ff00ff] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[#0a0118]">
                          {tier.badge}
                        </div>
                      </div>
                      <div className="font-public-display mb-2 text-4xl font-black md:text-6xl">
                        {tier.price}
                        <span className="text-base font-medium opacity-50 md:text-xl">{tier.cadence}</span>
                      </div>
                      <p className="font-medium text-slate-400">{tier.description}</p>
                    </div>

                    <ul className="mb-12 flex-grow space-y-4">
                      {tier.features.map((feature) => (
                        <li key={feature.label} className="flex items-center gap-3 font-bold">
                          <Check className="h-6 w-6 shrink-0 text-[#ff00ff]" />
                          <span>{feature.label}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => void startCheckout(tier.key)}
                      disabled={loadingKey === tier.key}
                      className="w-full rounded-3xl bg-[#ff00ff] py-5 text-xl font-black uppercase text-[#0a0118] shadow-[0_0_30px_rgba(255,0,255,0.4)] transition-all hover:-translate-y-1 hover:shadow-[0_0_50px_rgba(255,0,255,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingKey === tier.key ? 'Weiterleiten...' : tier.cta}
                    </button>
                  </div>
                </article>
              ) : (
                <article key={tier.key} className="landing-glass-card flex flex-col rounded-[2rem] border-2 border-white/10 p-6 transition-all hover:border-white/20 md:p-12">
                  <div className="mb-10">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <h2 className="font-public-display text-4xl font-bold uppercase">{tier.title}</h2>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                        {tier.badge}
                      </span>
                    </div>
                    <div className="font-public-display mb-2 text-4xl font-black md:text-6xl">
                      {tier.price}
                      <span className="text-base font-medium opacity-50 md:text-xl">{tier.cadence}</span>
                    </div>
                    <p className="font-medium text-slate-400">{tier.description}</p>
                  </div>

                  <ul className="mb-12 flex-grow space-y-4">
                    {tier.features.map((feature) => (
                      <li key={feature.label} className={`flex items-center gap-3 font-bold ${feature.included ? '' : 'opacity-30'}`}>
                        {feature.included ? (
                          <Check className="h-6 w-6 shrink-0 text-[#ccff00]" />
                        ) : (
                          <Minus className="h-6 w-6 shrink-0" />
                        )}
                        <span>{feature.label}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={tier.href}
                    className="w-full rounded-3xl bg-white/10 py-5 text-center text-lg font-black uppercase transition-all hover:bg-white/20"
                  >
                    {tier.cta}
                  </Link>
                </article>
              )
            )}
          </div>
        </section>

        <section className="mb-24 px-6 md:mb-32">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-public-display mb-8 text-center text-3xl font-black uppercase tracking-tight md:mb-12 md:text-5xl">
              Deep <span className="text-[#00f2ff]">Dive</span> Comparison
            </h2>

            <div className="landing-glass-card overflow-hidden rounded-[2rem] border-2 border-white/5">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 md:p-8 md:text-xs">Feature</th>
                    <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 md:p-8 md:text-xs">Casual</th>
                    <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-[#ff00ff] md:p-8 md:text-xs">Maxxing</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b border-white/5 last:border-b-0">
                      <td className="p-4 text-xs font-bold md:p-8 md:text-base">{row.label}</td>
                      <td className="p-4 text-center md:p-8">
                        {row.casual ? <Check className="mx-auto h-6 w-6 text-[#ccff00]" /> : <Minus className="mx-auto h-6 w-6 opacity-20" />}
                      </td>
                      <td className="p-4 text-center md:p-8">
                        {row.maxxing ? <Check className="mx-auto h-6 w-6 text-[#ff00ff]" /> : <Minus className="mx-auto h-6 w-6 opacity-20" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="checkout" className="mb-16 px-6 md:mb-32">
          <div className="landing-glass-card relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border-2 border-[#ff00ff]/30 p-6 md:p-12">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ff00ff]/10 blur-[80px]" />
            <div className="relative z-10">
              <h2 className="font-public-display text-center text-3xl font-black uppercase md:text-4xl">
                Sicherer <span className="text-[#ff00ff]">Checkout</span>
              </h2>

              <p className="mb-10 mt-6 text-center font-medium text-slate-400">
                Der Membership-Checkout ist vorbereitet. Wähle deine bevorzugte Zahlungsroute und schalte MAXXING frei.
              </p>

              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 md:mb-12 md:gap-6">
                {[
                  { label: 'Karte', icon: '💳', accent: 'hover:border-[#ff00ff] hover:bg-[#ff00ff]/5' },
                  { label: 'PayPal', icon: '🅿️', accent: 'hover:border-[#00f2ff] hover:bg-[#00f2ff]/5' },
                  { label: 'Apple Pay', icon: '🍏', accent: 'hover:border-[#ccff00] hover:bg-[#ccff00]/5' },
                ].map((method) => (
                  <div
                    key={method.label}
                    className={`flex flex-col items-center gap-3 rounded-[1.5rem] border-2 border-white/10 bg-white/5 p-5 text-center transition-all md:p-8 ${method.accent}`}
                  >
                    <div className="text-4xl md:text-5xl">{method.icon}</div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70">{method.label}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-base md:text-lg">
                  <span className="text-slate-400">Zusammenfassung: MAXXING Plan</span>
                  <span className="font-bold">20,00 EUR</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span className="text-slate-500">inkl. MwSt.</span>
                  <span className="text-slate-400">Abrechnung: Monatlich</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void startCheckout('membership')}
                disabled={loadingKey === 'membership'}
                className="mt-8 flex w-full items-center justify-center rounded-[1.75rem] bg-white py-6 text-xl font-black text-[#0a0118] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingKey === 'membership' ? 'Weiterleiten...' : 'Zahlung bestaetigen'}
              </button>

              <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-slate-500">
                SSL verschluesselt • DSGVO konform
              </p>
            </div>
          </div>
        </section>

        <section className="mb-24 px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="font-public-display text-3xl font-black uppercase tracking-tight md:text-5xl lg:text-6xl">
                Was <span className="text-[#ccff00]">MAXXER</span> sagen
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {testimonials.map((item) => (
                <article
                  key={item.name}
                  className={`landing-bento landing-glass-card rounded-[2rem] p-6 md:p-8 ${
                    item.accent === 'blue'
                      ? 'landing-neon-blue'
                      : item.accent === 'pink'
                        ? 'landing-neon-pink'
                        : 'landing-neon-green'
                  }`}
                >
                  <Star className="h-8 w-8 text-white/80" />
                  <p className="mt-6 text-base font-bold leading-relaxed text-slate-200">"{item.quote}"</p>
                  <p className="mt-6 text-xs font-black uppercase tracking-widest text-slate-400">{item.name}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {message ? <p className="pb-16 text-center text-sm text-slate-400">{message}</p> : null}

        <section className="px-6 pb-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[linear-gradient(90deg,#ff00ff,#00f2ff,#ccff00)] p-8 text-center">
            <div className="rounded-[1.5rem] bg-black/45 px-4 py-10 backdrop-blur-md md:px-10 md:py-16">
              <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1">
                <span className="text-xs font-bold uppercase tracking-widest text-[#ccff00]">Dein naechster Hebel</span>
              </div>
              <h2 className="font-public-display text-4xl font-black uppercase tracking-tight md:text-6xl">
                Build your
                <br />
                gameplan first
              </h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-bold leading-relaxed text-white/90 md:text-xl">
                Starte kostenlos oder geh direkt auf MAXXING, wenn du Reviews, tiefere Systeme und mehr Klarheit willst.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-white px-8 py-5 text-lg font-black uppercase tracking-tight text-[#0a0118] shadow-2xl transition-transform hover:scale-105"
                >
                  Kostenlos starten
                  <Zap className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={() => void startCheckout('membership')}
                  disabled={loadingKey === 'membership'}
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-8 py-5 text-lg font-black uppercase tracking-tight text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  MAXXING freischalten
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
