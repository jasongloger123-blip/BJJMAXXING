import Link from 'next/link'
import { YoutubeEmbed } from '@/components/YoutubeEmbed'

type ClipComment = {
  author: string
  text: string
  meta: string
  avatarUrl?: string | null
}

type CuratedClipCardProps = {
  title: string
  titleAside?: React.ReactNode
  principle?: string
  category?: string
  levelLabel?: string
  description?: string
  source: 'youtube' | 'instagram' | 'external'
  sourceUrl: string
  sourceLabel?: string
  secondaryUrl?: string
  secondaryLabel?: string
  comments?: ClipComment[]
  compact?: boolean
  showComments?: boolean
  showDescription?: boolean
  metaActions?: React.ReactNode
  responseActions?: React.ReactNode
  commentComposer?: React.ReactNode
  commentSidebar?: React.ReactNode
}

function extractYoutubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match?.[1] ?? null
}

function getPreviewImage(url: string, source: CuratedClipCardProps['source']) {
  if (source === 'youtube') {
    const id = extractYoutubeId(url)
    if (id) {
      return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
    }
  }

  return null
}

function getSourceButtonLabel(source: CuratedClipCardProps['source']) {
  if (source === 'instagram') return 'Open in Instagram'
  if (source === 'youtube') return 'Open in YouTube'
  return 'Clip öffnen'
}

function shouldShowPrinciple(principle?: string) {
  if (!principle) return false

  const normalized = principle.toLowerCase()
  if (normalized.includes('ohne identitaet trainierst du zufaellige techniken')) {
    return false
  }

  return true
}

export function CuratedClipCard({
  title,
  titleAside,
  principle,
  category,
  levelLabel,
  description,
  source,
  sourceUrl,
  sourceLabel,
  secondaryUrl,
  secondaryLabel,
  comments = [],
  compact = false,
  showComments = false,
  showDescription = false,
  metaActions,
  responseActions,
  commentComposer,
  commentSidebar,
}: CuratedClipCardProps) {
  const previewImage = getPreviewImage(sourceUrl, source)
  const visiblePrinciple = shouldShowPrinciple(principle) ? principle : null
  const hasMeta = Boolean(visiblePrinciple || category || levelLabel)
  const supportsEmbeddedPlayer = source === 'youtube' || source === 'instagram'

  return (
    <div className={`grid gap-5 ${showComments ? (compact ? 'xl:grid-cols-[1fr_300px]' : 'lg:grid-cols-[minmax(0,1fr)_340px]') : ''}`}>
      <div className="clip-card-shell rounded-[1.6rem] border border-bjj-border bg-bjj-card p-4 shadow-card md:p-5">
        <div className="clip-card-stage space-y-4 overflow-hidden rounded-[1.3rem] border border-white/10 bg-[#0f1520] px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`${compact ? 'text-xl' : 'text-2xl md:text-3xl'} font-black text-white`}>{title}</p>
            {titleAside ? <div className="flex flex-wrap items-center gap-2">{titleAside}</div> : null}
          </div>

          {supportsEmbeddedPlayer ? (
            <YoutubeEmbed title={sourceLabel ?? title} url={sourceUrl} />
          ) : previewImage ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="clip-preview-frame group relative block overflow-hidden rounded-[1.2rem] bg-[#111722]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt={title}
                className={`${compact ? 'h-[220px]' : 'h-[300px] md:h-[360px]'} w-full object-contain bg-[#0f1520] transition-transform duration-200 group-hover:scale-[1.01]`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`flex ${compact ? 'h-16 w-16 text-2xl' : 'h-20 w-20 text-3xl'} items-center justify-center rounded-full border-2 border-white/90 bg-black/30 text-white`}
                >
                  ▶
                </div>
              </div>
            </a>
          ) : (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={`clip-preview-frame flex ${compact ? 'h-[220px]' : 'h-[300px] md:h-[360px]'} items-center justify-center rounded-[1.2rem] bg-[linear-gradient(180deg,#20283a,#11161f)] p-8 text-center`}
            >
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-bjj-gold">{sourceLabel ?? source}</p>
                <p className="mt-4 text-3xl font-black text-white">{title}</p>
              </div>
            </a>
          )}

          {responseActions ? <div className="queue-response-actions flex w-full flex-col items-stretch justify-center gap-4 py-1 sm:flex-row">{responseActions}</div> : null}

          {metaActions ? <div className="flex flex-wrap items-center gap-2">{metaActions}</div> : null}

          {hasMeta ? (
            <div className="flex flex-wrap gap-2">
              {visiblePrinciple ? (
                <span className="rounded-lg bg-[#c56b46] px-3 py-1.5 text-xs font-semibold text-white md:text-sm">
                  Prinzip: {visiblePrinciple}
                </span>
              ) : null}
              {category ? (
                <span className="rounded-lg bg-[#313d54] px-3 py-1.5 text-xs font-semibold text-[#d9e2f1] md:text-sm">
                  {category}
                </span>
              ) : null}
              {levelLabel ? (
                <span className="rounded-lg bg-[#313d54] px-3 py-1.5 text-xs font-semibold text-[#d9e2f1] md:text-sm">
                  {levelLabel}
                </span>
              ) : null}
            </div>
          ) : null}

          {showDescription && description ? (
            <p className="text-sm leading-relaxed text-bjj-muted md:text-base">{description}</p>
          ) : null}
        </div>

        {!metaActions ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl bg-[linear-gradient(90deg,#8f4ad0,#3c87f0)] px-5 py-3 text-sm font-black text-white md:text-base"
            >
              {getSourceButtonLabel(source)}
            </a>
            {secondaryUrl && secondaryLabel ? (
              <Link
                href={secondaryUrl}
                className="inline-flex rounded-xl border border-[#606983] bg-[#2c3447] px-5 py-3 text-sm font-black text-white md:text-base"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {showComments ? (
        commentSidebar ?? (
          <aside className="overflow-hidden rounded-[1.6rem] border border-bjj-border bg-bjj-card shadow-card">
            <div className="border-b border-white/10 px-5 py-4">
              <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-black text-white`}>
                Kommentare <span className="text-[#94a2bc]">({comments.length})</span>
              </p>
            </div>

            {comments.length > 0 ? (
              <div>
                {comments.map((comment, index) => (
                  <div key={`${comment.author}-${index}`} className="border-b border-white/10 px-5 py-5">
                    <div className="flex items-start gap-3">
                      {comment.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={comment.avatarUrl} alt={comment.author} className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#394258] text-sm font-black text-white">
                          {comment.author.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-white`}>{comment.author}</p>
                        <p className={`mt-2 ${compact ? 'text-base' : 'text-lg'} leading-relaxed text-[#dbe3f1]`}>{comment.text}</p>
                        <p className={`mt-3 ${compact ? 'text-base' : 'text-lg'} text-[#8e9ab2]`}>{comment.meta}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-6 text-sm text-bjj-muted">Noch keine Kommentare.</div>
            )}

            {commentComposer ? <div className="border-t border-white/10 px-5 py-4">{commentComposer}</div> : null}
          </aside>
        )
      ) : null}
    </div>
  )
}
