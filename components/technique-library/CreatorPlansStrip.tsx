'use client'

import { ArrowRight } from 'lucide-react'
import type { CreatorPlan } from '@/components/technique-library/types'

type CreatorPlansStripProps = {
  plans: CreatorPlan[]
}

export function CreatorPlansStrip({ plans }: CreatorPlansStripProps) {
  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-3">
      {plans.map((plan) => (
        <article key={plan.id} className="rounded-[1.8rem] border border-white/6 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-bjj-gold">
              {plan.price}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{plan.techniques} Techniken</span>
          </div>
          <h2 className="mt-4 text-2xl font-black text-white">{plan.title}</h2>
          <p className="mt-2 text-sm text-white/65">Von {plan.creator} | Fighter: {plan.fighter}</p>
          <p className="mt-4 text-sm leading-7 text-white/58">{plan.description}</p>
          <div className="mt-4 rounded-xl border border-white/6 bg-black/10 px-4 py-3 text-sm text-white/72">{plan.focus}</div>
          <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-bjj-gold px-4 py-3 text-sm font-black text-bjj-coal transition hover:bg-bjj-orange-light">
            Gameplan kaufen
            <ArrowRight className="h-4 w-4" />
          </button>
        </article>
      ))}
    </section>
  )
}
