'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Dna,
  Flame,
  Instagram,
  Map,
  Menu,
  Music2,
  Sparkles,
  Users,
  Video,
  X,
  Youtube,
  Zap,
} from 'lucide-react'

const navItems = [
  { href: '#features', label: 'Features' },
  { href: '#testimonials', label: 'Vibe Check' },
  { href: '#pricing', label: 'Levels' },
]

const featureCards = [
  {
    title: 'Körpertyp-Analyse',
    description:
      'Unser System bewertet Hebel, Beweglichkeit und Stilpräferenzen, damit dein Einstieg nicht zufällig ist.',
    badge: 'Kostenlos',
    tone: 'blue',
    icon: Dna,
    wide: true,
  },
  {
    title: 'Gameplan',
    description: 'Vom ersten Grip bis zum Finish. Ein klarer Flow statt zehn lose Techniken ohne Zusammenhang.',
    badge: 'Kostenlos',
    tone: 'pink',
    icon: Map,
    center: true,
  },
  {
    title: '1:1 Reviews',
    description: 'Reiche Sparring-Videos ein und hole dir gezieltes Feedback für den nächsten echten Hebel.',
    badge: 'Premium',
    tone: 'neutral',
    icon: Video,
    center: true,
  },
]

const testimonials = [
  {
    quote:
      'BJJMAXXING ist die Antwort auf die Informationsflut im Netz. Du bekommst endlich den roten Faden für deine Entwicklung.',
    name: 'Ahmed Laaribi',
    role: 'Black Belt • Head Coach',
    accent: 'blue',
    initials: 'AL',
  },
  {
    quote:
      'Ohne Struktur kein Fortschritt. Mit einem klaren Plan lernen Athleten in Monaten, wofür sie sonst Jahre brauchen.',
    name: 'Jason Gloger',
    role: 'Purple Belt • Community Lead',
    accent: 'pink',
    initials: 'JG',
  },
]

const pricingTiers = [
  {
    title: 'Casual',
    price: '0EUR',
    cadence: '/mo',
    features: ['Archetyp-Test', 'Basis-Gameplan', 'Kostenloser Einstieg'],
    href: '/archetype-test',
    cta: 'Start Free',
    featured: false,
  },
  {
    title: 'MAXXING',
    price: '20EUR',
    cadence: '/mo',
    features: ['Alle Archetypen', 'Erweiterte Systeme', 'Reviews und Premium-Features', 'Mehr Tiefe statt mehr Chaos'],
    href: '/pricing?autocheckout=membership',
    cta: 'Get Maxxed',
    featured: true,
  },
]

function LogoMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ff006e,#00d9ff)] shadow-[0_0_20px_rgba(255,0,110,0.3)] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-105">
      <Zap className="h-5 w-5 text-white" />
    </div>
  )
}

export default function PublicLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="landing-shell min-h-screen overflow-x-hidden bg-[#0f1419] text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#0f1419]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="group flex items-center gap-3">
            <LogoMark />
            <span className="font-public-display text-2xl font-black uppercase italic tracking-tight">
              BJJ<span className="text-[#ff006e]">MAXXING</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:text-[#00d9ff]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/archetype-test"
              className="hidden rounded-xl bg-white px-6 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] sm:flex"
            >
              Jetzt starten
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              className="flex items-center justify-center p-2 text-white md:hidden"
              aria-label={mobileMenuOpen ? 'Menü schliessen' : 'Menü öffnen'}
            >
              {mobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-white/5 bg-[#0f1419] p-6 shadow-2xl md:hidden">
            <div className="flex flex-col gap-6">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-black uppercase tracking-[0.2em] text-white"
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/archetype-test"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full rounded-xl bg-white py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-black"
              >
                Jetzt starten
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section id="hero" className="relative overflow-hidden px-6 pb-12 pt-28 md:pb-20 md:pt-36 lg:pb-32 lg:pt-44">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#ff006e]/20 blur-[100px] md:h-96 md:w-96 md:blur-[140px]" />
          <div className="pointer-events-none absolute right-[-4rem] top-1/2 h-72 w-72 rounded-full bg-[#00d9ff]/20 blur-[100px] md:h-96 md:w-96 md:blur-[140px]" />

          <div className="mx-auto max-w-7xl text-center">
            <div className="landing-floating inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#ccff00] md:text-xs">
                100% Kostenlos für Einsteiger
              </span>
            </div>

            <h1 className="mt-8 font-public-display font-black uppercase tracking-tight">
              <span className="block text-3xl text-white/90 md:text-5xl lg:text-6xl">Erstelle deinen</span>
              <span className="landing-neon-text mt-2 block text-6xl leading-[0.85] drop-shadow-[0_0_30px_rgba(255,0,110,0.35)] md:text-8xl lg:text-[10rem]">
                GAMEPLAN
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-lg font-medium leading-relaxed text-slate-400 md:text-xl lg:text-2xl">
              Keine Lust auf langweilige Technik-Videos? Wir bauen dir einen personalisierten Gameplan passend zu deinem Kampfstil.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row md:gap-6">
              <Link
                href="/archetype-test"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ff006e] px-8 py-4 text-lg font-black text-white shadow-[0_0_24px_rgba(255,0,110,0.45)] transition-all hover:-translate-y-1 hover:shadow-[0_0_50px_rgba(255,0,110,0.6)] sm:w-auto md:rounded-3xl md:px-10 md:py-5 md:text-xl"
              >
                Quiz starten
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#features"
                className="w-full rounded-2xl border-2 border-white/10 bg-white/5 px-8 py-4 text-center text-lg font-bold text-white transition-all hover:bg-white/10 sm:w-auto md:rounded-3xl md:px-10 md:py-5 md:text-xl"
              >
                Wie es funktioniert
              </a>
            </div>

            <div className="mt-16 flex flex-wrap justify-center gap-6 opacity-50 md:mt-20 md:gap-12">
              <div className="flex items-center gap-2 font-public-display text-sm font-bold uppercase italic md:text-base">
                <Users className="h-5 w-5 md:h-6 md:w-6" />
                1.2k+ Athleten
              </div>
              <div className="flex items-center gap-2 font-public-display text-sm font-bold uppercase italic md:text-base">
                <Crown className="h-5 w-5 md:h-6 md:w-6" />
                #1 Plattform
              </div>
              <div className="flex items-center gap-2 font-public-display text-sm font-bold uppercase italic md:text-base">
                <Flame className="h-5 w-5 md:h-6 md:w-6" />
                Active Community
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="px-6 py-12 md:py-16 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col gap-4 md:mb-16 md:flex-row md:items-end md:justify-between md:gap-6">
              <div className="max-w-xl">
                <h2 className="font-public-display text-3xl font-black uppercase md:text-5xl lg:text-6xl">
                  Dein Weg zum <span className="text-[#00d9ff]">Black Belt</span>
                </h2>
                <p className="mt-4 text-base text-slate-400 md:text-lg">
                  Ein klares System für Stil, Fortschritt und Dominanz auf der Matte statt endloser Zufalls-Techniken.
                </p>
              </div>
              <div className="hidden select-none font-public-display text-6xl font-black uppercase text-white/5 md:block lg:text-8xl">
                Features
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
              {featureCards.map((card) => {
                const Icon = card.icon
                const toneClass =
                  card.tone === 'blue'
                    ? 'landing-neon-blue'
                    : card.tone === 'pink'
                      ? 'landing-neon-pink'
                      : 'border border-white/10'
                const spanClass = card.wide ? 'md:col-span-12 lg:col-span-8' : 'md:col-span-6 lg:col-span-4'

                return (
                  <article
                    key={card.title}
                    className={`${spanClass} landing-glass-card landing-bento rounded-3xl p-6 md:rounded-[2rem] md:p-8 lg:p-10 ${
                      card.center ? 'flex flex-col items-center justify-center text-center' : 'flex flex-col justify-between'
                    } ${toneClass} min-h-[260px] md:min-h-[320px]`}
                  >
                    <div className={`mb-6 flex ${card.center ? 'justify-center' : 'justify-between'} items-start gap-4`}>
                      <Icon className={`${card.center ? 'h-14 w-14' : 'h-12 w-12 md:h-16 md:w-16'} ${card.tone === 'blue' ? 'text-[#00d9ff]' : card.tone === 'pink' ? 'text-[#ff006e]' : 'text-white'}`} />
                      {!card.center ? (
                        <span className="rounded-full bg-[#ccff00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#ccff00]">
                          {card.badge}
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="font-public-display text-2xl font-bold uppercase md:text-3xl">{card.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-400 md:text-base lg:text-lg">{card.description}</p>
                    </div>

                    {card.center ? (
                      <span
                        className={`mt-6 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                          card.badge === 'Premium'
                            ? 'border border-[#ff006e]/20 bg-[#ff006e]/10 text-[#ff006e]'
                            : 'bg-[#ccff00]/10 text-[#ccff00]'
                        }`}
                      >
                        {card.badge}
                      </span>
                    ) : null}
                  </article>
                )
              })}

              <article className="md:col-span-12 lg:col-span-8">
                <div className="rounded-3xl bg-[linear-gradient(135deg,#ccff00,#00d9ff)] p-[2px] md:rounded-[2rem]">
                  <div className="landing-bento flex min-h-[260px] flex-col justify-between rounded-[calc(2rem-2px)] bg-[#0f1419] p-6 md:min-h-[320px] md:p-8 lg:p-10">
                    <div className="mb-8 flex items-center justify-between">
                      <Sparkles className="h-12 w-12 text-[#ccff00] md:h-16 md:w-16" />
                      <div className="flex -space-x-3">
                        <div className="h-10 w-10 rounded-full border-4 border-[#0f1419] bg-[#ff006e] md:h-14 md:w-14" />
                        <div className="h-10 w-10 rounded-full border-4 border-[#0f1419] bg-[#00d9ff] md:h-14 md:w-14" />
                        <div className="h-10 w-10 rounded-full border-4 border-[#0f1419] bg-[#ccff00] md:h-14 md:w-14" />
                      </div>
                    </div>

                    <div>
                      <h3 className="font-public-display text-2xl font-bold uppercase tracking-tight md:text-3xl">
                        System schlaegt Technik
                      </h3>
                      <p className="mt-3 text-sm text-slate-400 md:text-base lg:text-lg">
                        Egal ob gross, klein, schnell oder stark. Wir finden das System, das zu deinem Stil passt, bevor du dich in Technik-Chaos verlierst.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="testimonials" className="bg-white/5 px-6 py-12 md:py-16 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center md:mb-20">
              <h2 className="font-public-display text-4xl font-black uppercase md:text-6xl lg:text-7xl">
                Vibe <span className="text-[#ff006e]">Check</span>
              </h2>
              <p className="mt-3 text-lg text-slate-400 md:text-xl">Was sagen die anderen Matten-Krieger?</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
              {testimonials.map((item) => (
                <article key={item.name} className="landing-bento landing-glass-card relative overflow-hidden rounded-[1.75rem] p-6 md:rounded-[2rem] md:p-8 lg:p-10">
                  <div className="font-public-display absolute right-0 top-0 text-7xl font-black opacity-10 md:text-8xl">
                    {item.accent === 'blue' ? '💬' : '🔥'}
                  </div>
                  <p className="relative text-lg font-bold italic leading-relaxed text-slate-200 md:text-2xl">
                    "{item.quote}"
                  </p>
                  <div className="mt-8 flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full font-black md:h-14 md:w-14 ${
                        item.accent === 'blue' ? 'bg-[#00d9ff] text-[#0f1419]' : 'bg-[#ff006e] text-white'
                      }`}
                    >
                      {item.initials}
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight md:text-base">{item.name}</p>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-widest ${
                          item.accent === 'blue' ? 'text-[#00d9ff]' : 'text-[#ff006e]'
                        }`}
                      >
                        {item.role}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-16 md:py-24 lg:py-32">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center md:mb-20">
              <h2 className="font-public-display text-4xl font-black uppercase md:text-6xl lg:text-7xl">
                Choose Your <span className="text-[#ccff00]">Level</span>
              </h2>
              <p className="mt-3 text-lg text-slate-400 md:text-xl">Steig kostenlos ein und upgrade erst, wenn du mehr Tiefe willst.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch md:gap-8">
              {pricingTiers.map((tier) =>
                tier.featured ? (
                  <article key={tier.title} className="rounded-3xl bg-[linear-gradient(135deg,#ff006e,#00d9ff)] p-[2px] shadow-[0_0_50px_rgba(255,0,110,0.18)] md:scale-105 md:rounded-[2rem]">
                    <div className="flex h-full flex-col rounded-[calc(2rem-2px)] bg-[#0f1419] p-6 md:p-8 lg:p-10">
                      <div className="mb-8 flex items-start justify-between">
                        <div>
                          <h3 className="text-2xl font-black uppercase">{tier.title}</h3>
                          <div className="mt-2 font-public-display text-5xl font-black md:text-6xl">
                            {tier.price}
                            <span className="text-base font-medium opacity-30 md:text-lg">{tier.cadence}</span>
                          </div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0f1419]">
                          Hot
                        </div>
                      </div>

                      <ul className="mb-10 flex-grow space-y-4 md:space-y-5">
                        {tier.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-3 text-sm font-bold md:gap-4 md:text-base">
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#ff006e] md:h-6 md:w-6" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href={tier.href}
                        className="w-full rounded-2xl bg-[#ff006e] py-4 text-center text-sm font-black uppercase tracking-widest text-white transition-all hover:shadow-[0_0_30px_rgba(255,0,110,0.5)] md:rounded-3xl md:py-5 md:text-base"
                      >
                        {tier.cta}
                      </Link>
                    </div>
                  </article>
                ) : (
                  <article key={tier.title} className="landing-glass-card flex h-full flex-col rounded-3xl border-2 border-white/5 p-6 md:rounded-[2rem] md:p-8 lg:p-10">
                    <div className="mb-8">
                      <h3 className="text-2xl font-black uppercase">{tier.title}</h3>
                      <div className="mt-2 font-public-display text-5xl font-black md:text-6xl">
                        {tier.price}
                        <span className="text-base font-medium opacity-30 md:text-lg">{tier.cadence}</span>
                      </div>
                    </div>

                    <ul className="mb-10 flex-grow space-y-4 md:space-y-5">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-sm font-bold md:gap-4 md:text-base">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#ccff00] md:h-6 md:w-6" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={tier.href}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-center text-sm font-black uppercase tracking-widest transition-all hover:bg-white/10 md:rounded-3xl md:py-5 md:text-base"
                    >
                      {tier.cta}
                    </Link>
                  </article>
                )
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 px-6 py-12 md:mb-12 md:py-24">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[linear-gradient(90deg,#ff006e,#00d9ff,#ccff00)] p-8 text-center md:rounded-[2rem] md:p-20 lg:p-28">
            <div className="rounded-[1.5rem] bg-black/50 px-4 py-10 backdrop-blur-md md:px-10 md:py-16">
              <h2 className="font-public-display text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl lg:text-8xl">
                Don&apos;t be a
                <br />
                White Belt forever
              </h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-bold leading-relaxed text-white/90 md:text-xl lg:text-3xl">
                Hol dir einen Plan, der zu deinem Stil passt, und verschwende keine weiteren Monate an zufaellige Technik-Sammlungen.
              </p>
              <Link
                href="/archetype-test"
                className="mt-10 inline-flex items-center justify-center gap-3 rounded-full bg-white px-8 py-5 text-lg font-black uppercase tracking-tight text-[#0f1419] shadow-2xl transition-transform hover:scale-105 md:px-12 md:py-7 md:text-2xl"
              >
                Jetzt Quiz starten
                <ArrowRight className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 md:flex-row">
          <div className="flex flex-col items-center md:items-start">
            <Link href="/" className="mb-4 flex items-center gap-3 text-3xl font-bold tracking-tight">
              <span className="rounded-lg bg-[#ff006e] px-2 py-1 text-sm font-black text-[#0f1419]">BJJ</span>
              <span className="font-public-display text-white">MAXXING</span>
            </Link>
            <p className="max-w-sm text-center font-medium text-slate-500 md:text-left">
              Die Plattform für BJJ-Enthusiasten, die lieber ein System bauen als Reels sammeln.
            </p>
          </div>

          <div className="flex gap-6">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl transition-all hover:border-[#ff006e] hover:text-[#ff006e]"
              aria-label="Instagram"
            >
              <Instagram className="h-6 w-6" />
            </a>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noreferrer"
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl transition-all hover:border-[#00d9ff] hover:text-[#00d9ff]"
              aria-label="TikTok"
            >
              <Music2 className="h-6 w-6" />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl transition-all hover:border-[#ccff00] hover:text-[#ccff00]"
              aria-label="YouTube"
            >
              <Youtube className="h-6 w-6" />
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm font-bold uppercase tracking-widest text-slate-400">
            <Link href="/login" className="transition-colors hover:text-white">
              Login
            </Link>
            <Link href="/register" className="transition-colors hover:text-white">
              Register
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white">
              Pricing
            </Link>
          </div>
        </div>

        <div className="mt-20 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
          BJJMAXXING • Build your gameplan
        </div>
      </footer>
    </div>
  )
}
