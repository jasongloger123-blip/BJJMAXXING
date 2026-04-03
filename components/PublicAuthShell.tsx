'use client'

import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'

type PublicAuthShellProps = {
  title: React.ReactNode
  subtitle: string
  accent: 'pink' | 'blue'
  footer: React.ReactNode
  children: React.ReactNode
}

export default function PublicAuthShell({
  title,
  subtitle,
  accent,
  footer,
  children,
}: PublicAuthShellProps) {
  return (
    <div className="landing-shell min-h-screen text-white">
      <main className="relative flex min-h-screen items-center justify-center px-6 pb-16 pt-16">
        <div className="absolute left-1/4 top-24 -z-10 h-64 w-64 rounded-full bg-[#ff00ff]/10 blur-[90px] sm:h-96 sm:w-96 sm:blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 -z-10 h-64 w-64 rounded-full bg-[#00f2ff]/10 blur-[90px] sm:h-96 sm:w-96 sm:blur-[120px]" />

        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurueck zur Landingpage
            </Link>

            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ff00ff,#00f2ff)] shadow-[0_0_20px_rgba(255,0,255,0.3)] transition-transform duration-500 group-hover:scale-105">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-public-display text-xl font-black uppercase italic tracking-tight">
                BJJ<span className="text-[#ff00ff]">MAXXING</span>
              </span>
            </Link>
          </div>

          <div className="landing-glass-card rounded-[2rem] border-2 border-white/10 p-6 sm:p-8 md:p-10">
            <div className="mb-10 text-center">
              <h1 className="font-public-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
            </div>

            <div
              className={
                accent === 'pink'
                  ? '[&_input:focus]:border-[#ff00ff]'
                  : '[&_input:focus]:border-[#00f2ff]'
              }
            >
              {children}
            </div>

            <div className="mt-8 text-center">{footer}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
