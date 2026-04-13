import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, Link2, Tag } from 'lucide-react'
import { SavedClipButton } from '@/components/SavedClipButton'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { type ClipArchiveRecord, type ClipAssignmentRecord } from '@/lib/clip-archive'
import { getNodeById } from '@/lib/nodes'
import { extractYoutubeId } from '@/lib/video-format'

function buildYoutubeEmbedUrl(url: string) {
  const id = extractYoutubeId(url)
  if (!id) return null

  const parsed = new URL(url)
  const t = parsed.searchParams.get('t')
  const params = new URLSearchParams({
    rel: '0',
    playsinline: '1',
    autoplay: '1',
    mute: '1',
    modestbranding: '1',
    iv_load_policy: '3',
    cc_load_policy: '0',
    fs: '1',
  })

  if (t) {
    params.set('start', t)
  }

  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

function isValidYoutubeUrl(url: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return lower.includes('youtube.com') || lower.includes('youtu.be')
}

export default async function ClipDetailPage({ params }: { params: { id: string } }) {
  const clipId = params.id?.trim()
  if (!clipId) notFound()

  const client = createAdminClient() ?? createClient()

  const { data: clip } = await client
    .from('clip_archive')
    .select(
      'id, external_source_id, source_run_id, provider, source_url, source_type, title, video_url, video_platform, video_format, timestamp_label, timestamp_seconds, hashtags, summary, search_query, raw_payload, assignment_status, created_at, last_seen_at'
    )
    .eq('id', clipId)
    .maybeSingle()

  if (!clip) {
    notFound()
  }

  const { data: assignments } = await client
    .from('clip_assignments')
    .select('id, clip_id, assignment_kind, node_id, from_node_id, to_node_id, role, display_order, notes, created_at')
    .eq('clip_id', clipId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  const enrichedAssignments = ((assignments ?? []) as ClipAssignmentRecord[]).map((assignment) => {
    const node = assignment.node_id ? getNodeById(assignment.node_id) : null
    const fromNode = assignment.from_node_id ? getNodeById(assignment.from_node_id) : null
    const toNode = assignment.to_node_id ? getNodeById(assignment.to_node_id) : null

    return {
      ...assignment,
      nodeTitle: node?.title ?? assignment.node_id ?? null,
      nodeHref: node ? `/node/${node.id}` : null,
      fromNodeTitle: fromNode?.title ?? assignment.from_node_id ?? null,
      fromNodeHref: fromNode ? `/node/${fromNode.id}` : null,
      toNodeTitle: toNode?.title ?? assignment.to_node_id ?? null,
      toNodeHref: toNode ? `/node/${toNode.id}` : null,
    }
  })

  const linkedTechniques = Array.from(
    new Map(
      enrichedAssignments
        .flatMap((assignment) => {
          if (assignment.assignment_kind === 'node') {
            return assignment.nodeHref && assignment.nodeTitle
              ? [{ href: assignment.nodeHref, title: assignment.nodeTitle }]
              : []
          }

          return [
            assignment.fromNodeHref && assignment.fromNodeTitle
              ? { href: assignment.fromNodeHref, title: assignment.fromNodeTitle }
              : null,
            assignment.toNodeHref && assignment.toNodeTitle
              ? { href: assignment.toNodeHref, title: assignment.toNodeTitle }
              : null,
          ].filter((entry): entry is { href: string; title: string } => Boolean(entry))
        })
        .map((entry) => [entry.href, entry])
    ).values()
  )

  const videoUrl = (clip as ClipArchiveRecord).video_url ?? (clip as ClipArchiveRecord).source_url
  const isYoutube = isValidYoutubeUrl(videoUrl ?? '')
  const youtubeEmbedUrl = isYoutube && videoUrl ? buildYoutubeEmbedUrl(videoUrl) : null

  return (
    <div className="mx-auto max-w-[1280px] pb-24">
      <div className="mb-6 flex items-center gap-3 px-1 text-[11px] font-bold uppercase tracking-[0.28em] text-white/30">
        <Link href="/admin/outlierdb" className="transition-colors hover:text-bjj-gold">
          Clip Archiv
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white/82">Clip</span>
      </div>

      <section className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,16,24,0.98),rgba(9,12,18,0.96))] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
          <div className="relative aspect-video overflow-hidden bg-black">
            {youtubeEmbedUrl ? (
              <iframe
                src={youtubeEmbedUrl}
                title={(clip as ClipArchiveRecord).title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_50%),linear-gradient(180deg,#272f3f,#131924)] px-6 text-center"
              >
                <span className="text-sm font-semibold text-white/84">Video extern oeffnen</span>
              </a>
            )}
          </div>

          <div className="border-t border-white/8 px-6 py-5">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/42">
              <SavedClipButton clipId={(clip as ClipArchiveRecord).id} className="h-9 w-9" />
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-bjj-gold/20 bg-bjj-gold/10 text-bjj-gold transition hover:bg-bjj-gold/16"
                title="Original Video oeffnen"
                aria-label="Original Video oeffnen"
              >
                <Link2 className="h-4 w-4" />
              </a>
              {(clip as ClipArchiveRecord).timestamp_label ? <span>{(clip as ClipArchiveRecord).timestamp_label}</span> : null}
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white">{(clip as ClipArchiveRecord).title}</h1>
            <p className="mt-4 text-sm leading-8 text-white/76">
              {(clip as ClipArchiveRecord).summary ?? 'Keine Zusammenfassung fuer diesen Clip erkannt.'}
            </p>
            <div className="mt-5">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-bjj-gold">
                <Tag className="h-4 w-4" />
                Hashtags
              </p>
              {(clip as ClipArchiveRecord).hashtags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(clip as ClipArchiveRecord).hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/70"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/55">Keine Hashtags gespeichert.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(19,24,34,0.94),rgba(12,16,24,0.92))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-bjj-gold">Verwendet In</p>
          {linkedTechniques.length === 0 ? (
            <div className="mt-5 rounded-[1.2rem] border border-white/[0.05] bg-[#101319] px-4 py-4 text-sm text-white/60">
              Dieser Archivclip ist noch keiner Technik zugeordnet.
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              {linkedTechniques.map((technique) => (
                <Link
                  key={technique.href}
                  href={technique.href}
                  className="inline-flex items-center gap-2 rounded-full border border-bjj-gold/18 bg-bjj-gold/10 px-4 py-2 text-sm font-semibold text-bjj-gold transition hover:bg-bjj-gold/16 hover:text-white"
                >
                  <span>{technique.title}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
