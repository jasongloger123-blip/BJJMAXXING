'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ExpandPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/technique-library')
  }, [router])

  return (
    <div className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Weiterleitung</p>
      <h1 className="mt-2 font-display text-3xl font-black">Creator-Gameplans findest du jetzt in den Techniken.</h1>
      <p className="mt-4 text-sm text-bjj-muted">
        Die Funktionen bleiben erhalten, aber der separate Bereich wurde entfernt, damit die App fokussierter bleibt.
      </p>
      <Link
        href="/technique-library"
        className="mt-5 inline-flex rounded-2xl bg-bjj-gold px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-bjj-coal transition-colors hover:bg-bjj-orange-light"
      >
        Zu den Techniken
      </Link>
    </div>
  )
}
