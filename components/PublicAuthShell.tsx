'use client'

import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'

type PublicAuthShellProps = {
  title: React.ReactNode
  subtitle: string
  accent: 'pink' | 'blue' | 'orange'
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
  const accentColor = accent === 'orange' ? '#d4875f' : accent === 'pink' ? '#ff00ff' : '#00f2ff'
  const accentGlow = accent === 'orange' ? 'rgba(212,135,95,0.15)' : accent === 'pink' ? 'rgba(255,0,255,0.15)' : 'rgba(0,242,255,0.15)'

  return (
    <div className="min-h-screen bg-[#0d0b09] text-white">
      <main className="relative flex min-h-screen items-center justify-center px-6 pb-16 pt-16">
        {/* Background glow effects matching BJJ theme */}
        <div className="absolute left-1/4 top-24 -z-10 h-64 w-64 rounded-full bg-bjj-orange/10 blur-[90px] sm:h-96 sm:w-96 sm:blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 -z-10 h-64 w-64 rounded-full bg-bjj-gold/10 blur-[90px] sm:h-96 sm:w-96 sm:blur-[120px]" />

        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-bjj-orange to-bjj-gold shadow-orange-glow-sm transition-transform duration-500 group-hover:scale-105">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-black uppercase italic tracking-tight">
                BJJ<span className="text-bjj-orange">MAXXING</span>
              </span>
            </Link>
          </div>

          <div className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card sm:p-8 md:p-10">
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-bjj-muted">{subtitle}</p>
            </div>

            <div
              className="[&_input]:border-bjj-border [&_input]:bg-bjj-surface [&_input]:text-white [&_input::placeholder]:text-white/40"
              style={{
                ['--focus-color' as string]: accentColor,
              }}
            >
              <style jsx>{`
                div[data-accent] input:focus {
                  border-color: var(--focus-color);
                }
              `}</style>
              <div data-accent={accent}>
                {children}
              </div>
            </div>

            <div className="mt-8 text-center">{footer}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
