'use client'

import Link from 'next/link'
import { ArrowRight, Lock, Play } from 'lucide-react'
import type { TechniqueItem } from '@/components/technique-library/types'

const ratingStars = (value: number) =>
  Array.from({ length: 5 }).map((_, index) => ({
    id: index,
    active: index < value,
  }))

type TechniqueLibraryGridProps = {
  techniques: TechniqueItem[]
}

export function TechniqueLibraryGrid({ techniques }: TechniqueLibraryGridProps) {
  if (techniques.length === 0) {
    return (
      <section className="mt-8 rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/38">No Match</p>
        <h2 className="mt-4 text-3xl font-black text-white">Keine Technik trifft diese Filterkombination.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/55">
          Nimm einen Fighter raus, setze die Verfuegbarkeit zurueck oder lockere den Suchbegriff. Die Library ist jetzt streng genug, um leere Zustande klar zu zeigen.
        </p>
      </section>
    )
  }

  return (
    <section className="grid gap-8 py-10 md:grid-cols-2 xl:grid-cols-3">
      {techniques.map((tech) => {
        const Icon = tech.icon
        const card = (
          <>
            <div className="relative aspect-video overflow-hidden">
              {tech.locked ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75">
                  <Lock className="h-6 w-6 text-white/40" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Locked Node</span>
                </div>
              ) : null}

              <img
                src={tech.image}
                alt={tech.title}
                className="h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />
              <span className={`absolute left-4 top-4 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${tech.tagColor}`}>
                {tech.tag}
              </span>
              {!tech.locked ? (
                <button className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                  <Play className="h-5 w-5 text-white" />
                </button>
              ) : null}
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">{tech.title}</h3>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    {tech.fighter} | {tech.creator}
                  </p>
                </div>
                <Icon className="h-5 w-5 text-white/40" />
              </div>

              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                <span>Level {tech.level}</span>
                <div className="flex items-center gap-0.5 text-bjj-gold">
                  {ratingStars(Math.min(tech.level, 5)).map((star) => (
                    <span key={star.id} className={star.active ? 'text-bjj-gold' : 'text-white/20'}>
                      *
                    </span>
                  ))}
                </div>
                <span className="ml-auto">{tech.duration}</span>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/30">Prerequisite</p>
                  <p className="mt-1 text-[11px] text-white/60">{tech.prereq}</p>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-bjj-gold/20 bg-bjj-gold/10 text-bjj-gold transition group-hover:bg-bjj-gold group-hover:text-bjj-coal">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </div>
          </>
        )

        const cardClasses = `group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0d1117] transition ${
          tech.locked ? 'opacity-45 grayscale' : 'hover:-translate-y-1 hover:border-bjj-gold/40'
        }`

        return tech.nodeId ? (
          <Link key={tech.id} href={`/node/${tech.nodeId}`} className={cardClasses}>
            {card}
          </Link>
        ) : (
          <article key={tech.id} className={cardClasses}>
            {card}
          </article>
        )
      })}
    </section>
  )
}
