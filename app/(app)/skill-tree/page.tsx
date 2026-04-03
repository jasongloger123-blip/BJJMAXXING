'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SkillTreePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/gameplan')
  }, [router])

  return (
    <div className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Weiterleitung</p>
      <h1 className="mt-2 font-display text-3xl font-black">Der Skill Tree lebt jetzt im Gameplan.</h1>
      <p className="mt-4 text-sm text-bjj-muted">
        Du wirst automatisch weitergeleitet. Review-Freischaltung und Fortschritt laufen jetzt direkt ueber deinen Gameplan.
      </p>
      <Link
        href="/gameplan"
        className="mt-5 inline-flex rounded-2xl bg-bjj-gold px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-bjj-coal transition-colors hover:bg-bjj-orange-light"
      >
        Jetzt zum Gameplan
      </Link>
    </div>
  )
}
