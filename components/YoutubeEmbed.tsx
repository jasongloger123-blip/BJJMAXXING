type YoutubeEmbedProps = {
  title: string
  url: string
}

function extractYoutubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match?.[1] ?? null
}

function extractInstagramEmbedUrl(url: string) {
  const match = url.match(/instagram\.com\/(reel|p)\/([^/?#]+)/)
  if (!match) {
    return null
  }

  return `https://www.instagram.com/${match[1]}/${match[2]}/embed`
}

export function YoutubeEmbed({ title, url }: YoutubeEmbedProps) {
  const id = extractYoutubeId(url)
  const instagramEmbedUrl = extractInstagramEmbedUrl(url)

  if (instagramEmbedUrl) {
    return (
      <div className="clip-preview-frame overflow-hidden rounded-[1.5rem] border border-bjj-border bg-bjj-surface">
        <iframe
          title={title}
          src={instagramEmbedUrl}
          allowTransparency
          className="h-[640px] w-full"
        />
      </div>
    )
  }

  if (!id) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl border border-bjj-border bg-bjj-surface p-4 text-sm text-bjj-orange"
      >
        Video oeffnen: {title}
      </a>
    )
  }

  return (
    <div className="clip-preview-frame relative overflow-hidden rounded-[1.5rem] border border-bjj-border" style={{ paddingBottom: '56.25%' }}>
      <iframe
        title={title}
        src={`https://www.youtube.com/embed/${id}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}
