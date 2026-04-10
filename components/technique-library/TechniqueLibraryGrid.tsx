'use client'

import Link from 'next/link'
import { Flame, Lock } from 'lucide-react'
import type { TechniqueItem } from '@/components/technique-library/types'

type TechniqueLibraryGridProps = {
  techniques: TechniqueItem[]
}

const STAGE_CARD_STYLES: Record<
  TechniqueItem['stage'],
  {
    shell: string
    imageOverlay: string
    body: string
    meta: string
    glow: string
  }
> = {
  position: {
    shell:
      'bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0)),linear-gradient(180deg,#121d31,#151b2a_52%,#131721)] shadow-[0_0_0_1px_rgba(93,136,255,0.18),0_22px_52px_rgba(20,39,86,0.16)]',
    imageOverlay: 'from-[#131721] via-[#131721]/26 to-transparent',
    body: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0)),linear-gradient(180deg,#182235,#121722)]',
    meta: 'bg-[#ffffff08] text-white/52',
    glow: 'hover:shadow-[0_0_0_1px_rgba(93,136,255,0.24),0_30px_60px_rgba(20,39,86,0.24)]',
  },
  pass: {
    shell:
      'bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0)),linear-gradient(180deg,#241813,#1c1714_52%,#171418)] shadow-[0_0_0_1px_rgba(201,122,66,0.18),0_22px_52px_rgba(108,53,20,0.18)]',
    imageOverlay: 'from-[#171418] via-[#171418]/28 to-transparent',
    body: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0)),linear-gradient(180deg,#211713,#181416)]',
    meta: 'bg-[#ffffff08] text-white/52',
    glow: 'hover:shadow-[0_0_0_1px_rgba(201,122,66,0.24),0_30px_60px_rgba(108,53,20,0.26)]',
  },
  submission: {
    shell:
      'bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0)),linear-gradient(180deg,#142216,#141d17_52%,#131816)] shadow-[0_0_0_1px_rgba(111,185,111,0.18),0_22px_52px_rgba(26,61,31,0.16)]',
    imageOverlay: 'from-[#131816] via-[#131816]/28 to-transparent',
    body: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0)),linear-gradient(180deg,#18251a,#131816)]',
    meta: 'bg-[#ffffff08] text-white/52',
    glow: 'hover:shadow-[0_0_0_1px_rgba(111,185,111,0.24),0_30px_60px_rgba(26,61,31,0.24)]',
  },
}

export function TechniqueLibraryGrid({ techniques }: TechniqueLibraryGridProps) {
  if (techniques.length === 0) {
    return (
      <section className="mt-8 rounded-[2rem] border border-white/[0.05] bg-[#13141b] px-6 py-14 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/38">No Match</p>
        <h2 className="mt-4 text-3xl font-black text-white">Keine Technik trifft diese Filterkombination.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/55">
          Entferne einen Coach oder lockere die Kategorie, dann fuellt sich das Grid direkt wieder.
        </p>
      </section>
    )
  }

  return (
    <section className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {techniques.map((tech) => {
        const stageStyle = STAGE_CARD_STYLES[tech.stage]
        const card = (
          <>
            <div className="relative aspect-[16/8.2] overflow-hidden">
              <img
                src={tech.image}
                alt={tech.title}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${stageStyle.imageOverlay} to-transparent`} />

              <span className={`absolute left-4 top-4 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] backdrop-blur-md ${tech.tagColor}`}>
                {tech.tag}
              </span>

              <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
                <div className="h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-white/10 shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
                  <img src={tech.coachAvatar} alt={tech.fighter} className="h-full w-full object-cover" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white">{tech.fighter}</span>
              </div>

              {tech.locked ? (
                <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/74 backdrop-blur-md">
                  <Lock className="h-3.5 w-3.5" />
                  Locked
                </div>
              ) : null}
            </div>

            <div className={`${stageStyle.body} p-5`}>
              <h3 className="text-[1.45rem] font-black leading-[1.1] text-white">{tech.title}</h3>
              <p className="mt-3 text-[14px] leading-6 text-white/58">{tech.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] ${stageStyle.meta}`}>
                  <Flame className="h-3.5 w-3.5 text-[#f59e0b]" />
                  {tech.difficulty}
                </div>
                <div className={`inline-flex items-center rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] ${stageStyle.meta}`}>
                  {tech.style}
                </div>
              </div>
            </div>
          </>
        )

        const cardClasses = `group block overflow-hidden rounded-2xl transition-all duration-300 ease-out ${stageStyle.shell} ${
          tech.locked ? 'opacity-70' : `hover:-translate-y-1 ${stageStyle.glow}`
        }`

        const techniqueHref = tech.techniqueId ? `/technique/${tech.techniqueId}` : null

        return techniqueHref && !tech.locked ? (
          <Link key={tech.id} href={techniqueHref} className={cardClasses}>
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
