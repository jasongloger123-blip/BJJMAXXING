import { getNodeById, type SkillNode } from '@/lib/nodes'

export type CuratedComment = {
  author: string
  text: string
  meta: string
  avatarUrl?: string | null
}

export type CuratedClip = {
  id: string
  nodeId: string
  title: string
  clipWindow: string
  principle: string
  category: string
  levelLabel: string
  description: string
  source: 'youtube' | 'instagram' | 'external'
  sourceUrl: string
  comments: CuratedComment[]
}

function getClipSource(url: string): CuratedClip['source'] {
  if (url.includes('instagram.com')) {
    return 'instagram'
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube'
  }

  return 'external'
}

function getCategory(node: SkillNode) {
  const title = node.title.toLowerCase()

  if (title.includes('dlr')) return 'DLR'
  if (title.includes('back')) return 'Back'
  if (title.includes('guard')) return 'Guard'
  if (title.includes('rnc') || title.includes('choke')) return 'Finish'
  return 'A-Plan'
}

export function getCuratedClipsForNode(nodeId: string) {
  const node = getNodeById(nodeId)

  if (!node) {
    return []
  }

  return node.videos.map((video, index) => ({
    id: `${node.id}-clip-${index + 1}`,
    nodeId: node.id,
    title: video.title,
    clipWindow: index === 0 ? '0:12-0:48' : '0:18-0:52',
    principle: index === 0 ? node.why : node.commonErrors[0] ?? node.why,
    category: getCategory(node),
    levelLabel: index === 0 ? 'Anfaenger' : 'Fix',
    description: video.note ?? node.description,
    source: getClipSource(video.url),
    sourceUrl: video.url,
    comments: [],
  }))
}
