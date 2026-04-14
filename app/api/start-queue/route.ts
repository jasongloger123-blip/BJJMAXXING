import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type QueueCard = {
  id: string
  nodeId: string
  nodeTitle: string
  clipTitle: string
  clipUrl: string
  completed: boolean
}

export async function GET(request: NextRequest) {
  const admin = createAdminClient()
  if (!admin) {
    console.log('Start-queue: No admin client')
    return NextResponse.json({ queue: [] })
  }

  try {
    // Try to get user auth info
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await admin.auth.getUser(token)
      if (user) userId = user.id
    }
    
    console.log('Start-queue: User:', userId ? `Logged in (${userId.substring(0, 8)}...)` : 'Guest')

    // APPROACH 1: Try to get from clip_archive table
    console.log('Start-queue: Trying clip_archive...')
    const { data: clips, error: clipsError } = await admin
      .from('clip_archive')
      .select('id, title, youtube_url, status')
      .limit(5)
    
    console.log('Start-queue: clip_archive result:', { 
      count: clips?.length ?? 0, 
      error: clipsError?.message,
      firstClip: clips?.[0] ? { id: clips[0].id, title: clips[0].title, hasUrl: !!clips[0].youtube_url } : null
    })

    // Build queue from clips
    const queue: QueueCard[] = []
    
    if (clips && clips.length > 0) {
      for (const clip of clips) {
        if (clip.youtube_url) {
          queue.push({
            id: clip.id,
            nodeId: clip.id,
            nodeTitle: clip.title || 'Technik',
            clipTitle: clip.title || 'Clip',
            clipUrl: clip.youtube_url,
            completed: false,
          })
        }
      }
    }

    // APPROACH 2: If no clips, try nodes directly
    if (queue.length === 0) {
      console.log('Start-queue: No clips, trying nodes...')
      const { data: nodes, error: nodesError } = await admin
        .from('nodes')
        .select('id, title, videos')
        .limit(5)
      
      console.log('Start-queue: nodes result:', { 
        count: nodes?.length ?? 0, 
        error: nodesError?.message
      })

      for (const node of (nodes ?? [])) {
        const videos = node.videos as Array<{ url: string; title?: string }> | undefined
        if (videos && videos.length > 0 && videos[0].url) {
          queue.push({
            id: `${node.id}-video`,
            nodeId: node.id,
            nodeTitle: node.title || 'Technik',
            clipTitle: videos[0].title || node.title || 'Clip',
            clipUrl: videos[0].url,
            completed: false,
          })
        }
      }
    }

    // APPROACH 3: If still nothing, return hardcoded test video
    if (queue.length === 0) {
      console.log('Start-queue: No database results, returning hardcoded test video')
      queue.push({
        id: 'test-video',
        nodeId: 'test-node',
        nodeTitle: 'Test Technik',
        clipTitle: 'Test Video - Wenn du das siehst, funktioniert die API!',
        clipUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        completed: false,
      })
    }
    
    console.log('Start-queue: Returning queue with', queue.length, 'items')
    return NextResponse.json({ queue })
    
  } catch (error) {
    console.error('Start-queue error:', error)
    // Return hardcoded video on error
    return NextResponse.json({ 
      queue: [{
        id: 'error-fallback',
        nodeId: 'error-node',
        nodeTitle: 'Fehler-Technik',
        clipTitle: 'Fehler aufgetreten - Fallback Video',
        clipUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        completed: false,
      }] 
    })
  }
}