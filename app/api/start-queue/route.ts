import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type QueueCard = {
  id: string
  nodeId: string
  type: 'main' | 'fix' | 'review'
  videoKey: string
  videoKeys: string[]
  coreVideoKeys?: string[]
  clipId?: string | null
  videoIndex: number
  totalVideos: number
  badge: string
  title: string
  principle: string
  drill: string
  sparringGoal: string
  clipTitle: string
  clipDescription?: string | null
  clipHashtags?: string[]
  clipUrl: string
  clipSource: 'youtube' | 'instagram' | 'external'
  clipWindow: string
  categoryTag: string
  levelTag: string
  description: string
  keyPoints: { label: string; items: string[] }[]
  comments: any[]
  helperText: string
  learningStatus?: string
  confidenceScore?: number
  progressCreditEarned?: boolean
  isDue?: boolean
  isCore?: boolean
  priorityScore?: number
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = createAdminClient()
  if (!admin) {
    console.log('Start-queue: No admin client')
    return NextResponse.json({ queue: [] })
  }

  try {
    // PRIORITIZE Authorization header over cookies (better for cross-browser compatibility)
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null
    let authMethod = 'none'
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user }, error: tokenError } = await admin.auth.getUser(token)
      if (user) {
        userId = user.id
        authMethod = 'bearer-token'
      } else {
        console.log('Start-queue: Token auth failed:', tokenError?.message)
      }
    }
    
    // Fallback to cookie-based auth
    if (!userId) {
      const serverClient = createClient()
      const { data: { user: cookieUser }, error: cookieError } = await serverClient.auth.getUser()
      if (cookieUser) {
        userId = cookieUser.id
        authMethod = 'cookie'
      } else if (cookieError) {
        console.log('Start-queue: Cookie auth failed:', cookieError.message)
      }
    }
    
    console.log('Start-queue: Auth:', { userId: userId ?? 'Guest', method: authMethod })

    if (!userId) {
      console.log('Start-queue: No user ID - returning empty queue')
      return NextResponse.json({ queue: [] })
    }

    // ALWAYS load clips for authenticated users, even without gameplan
    // This ensures clips show up regardless of gameplan state
    
    const queue: QueueCard[] = []
    
    // 1. Get user's active gameplan to determine current nodes
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('active_gameplan_id, primary_archetype')
      .eq('id', userId)
      .maybeSingle()

    let currentNodeId: string | null = null
    let currentNodeTitle = 'Technik'
    
    if (userProfile?.active_gameplan_id) {
      // Get the gameplan's unlock summary to find current node
      const { data: gameplan } = await admin
        .from('gameplans')
        .select('unlock_summary, main_path_node_ids')
        .eq('id', userProfile.active_gameplan_id)
        .maybeSingle()
      
      // Try unlock_summary.currentNodeId first
      if (gameplan?.unlock_summary?.currentNodeId) {
        currentNodeId = gameplan.unlock_summary.currentNodeId
      } 
      // Fallback: use first node from main_path_node_ids
      else if (gameplan && Array.isArray(gameplan.main_path_node_ids) && gameplan.main_path_node_ids.length > 0) {
        currentNodeId = gameplan.main_path_node_ids[0]
        console.log('Start-queue: Using first node from main_path as fallback:', currentNodeId)
      }
      
      if (currentNodeId) {
        // Get node title
        const { data: node } = await admin
          .from('gameplan_nodes')
          .select('title, description, outcome')
          .eq('id', currentNodeId)
          .maybeSingle()
        
        if (node) {
          currentNodeTitle = node.title
          console.log('Start-queue: Current node:', currentNodeTitle, currentNodeId)
        }
      } else {
        console.log('Start-queue: No current node found for gameplan:', userProfile?.active_gameplan_id)
      }
    }

    // 2. Load clips - PRIORITY: current node clips, then user's archetype clips, then recent clips
    const clips: { id: string; title: string; url: string; description?: string | null; hashtags?: string[]; nodeId?: string }[] = []
    
    // Priority 1: Clips for current node
    if (currentNodeId) {
      const { data: assignments } = await admin
        .from('clip_assignments')
        .select('clip_id')
        .eq('assignment_kind', 'node')
        .eq('node_id', currentNodeId)
        .order('display_order', { ascending: true })

      if (assignments?.length) {
        const clipIds = assignments.map(a => a.clip_id)
        const { data: clipsData } = await admin
          .from('clip_archive')
          .select('id, title, video_url, summary, hashtags')
          .in('id', clipIds)

        if (clipsData?.length) {
          clipsData.forEach(c => clips.push({
            id: c.id,
            title: c.title,
            url: c.video_url,
            description: c.summary,
            hashtags: c.hashtags || [],
            nodeId: currentNodeId
          }))
          console.log(`Start-queue: Found ${clips.length} clips for node ${currentNodeId}`)
        }
      }
    }

    // Priority 2: If no clips yet, try clips assigned to user's archetype
    if (clips.length === 0 && userProfile?.primary_archetype) {
      const { data: archetypeAssignments } = await admin
        .from('clip_assignments')
        .select('clip_id')
        .eq('assignment_kind', 'archetype')
        .eq('target_id', userProfile.primary_archetype)
        .order('display_order', { ascending: true })

      if (archetypeAssignments?.length) {
        const clipIds = archetypeAssignments.map(a => a.clip_id)
        const { data: clipsData } = await admin
          .from('clip_archive')
          .select('id, title, video_url, summary, hashtags')
          .in('id', clipIds)

        if (clipsData?.length) {
          clipsData.forEach(c => clips.push({
            id: c.id,
            title: c.title,
            url: c.video_url,
            description: c.summary,
            hashtags: c.hashtags || [],
            nodeId: 'archetype'
          }))
          console.log(`Start-queue: Found ${clips.length} clips for archetype ${userProfile.primary_archetype}`)
        }
      }
    }

    // Priority 3: Fallback to ALL available clips (not just 10)
    if (clips.length === 0) {
      console.log('Start-queue: No clips found for node/archetype, using ALL available clips')
      
      // WICHTIG: Lade ALLE verfügbaren Clips, nicht nur 10
      const { data: allClips } = await admin
        .from('clip_archive')
        .select('id, title, video_url, summary, hashtags')
        .not('video_url', 'is', null)
        .neq('assignment_status', 'hidden')
        .neq('assignment_status', 'archived')
        .order('created_at', { ascending: false })
      
      if (allClips?.length) {
        allClips.forEach(c => clips.push({
          id: c.id,
          title: c.title,
          url: c.video_url,
          description: c.summary,
          hashtags: c.hashtags || [],
          nodeId: currentNodeId || 'fallback'
        }))
        console.log(`Start-queue: Using ALL ${clips.length} available clips`)
      }
    }

    // 3. Build queue cards
    if (clips.length > 0) {
      const videoKeys = clips.map((_, i) => `video-${i}`)
      
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        const videoKey = videoKeys[i]
        const nodeId = clip.nodeId || 'current'
        
        queue.push({
          id: videoKey,
          nodeId: nodeId,
          type: 'main',
          videoKey: videoKey,
          videoKeys: videoKeys,
          coreVideoKeys: videoKeys,
          clipId: clip.id,
          videoIndex: i,
          totalVideos: clips.length,
          badge: i === 0 ? 'Heute - Pflicht' : `Video ${i + 1}`,
          title: currentNodeTitle,
          principle: clip.description || '',
          drill: '',
          sparringGoal: '',
          clipTitle: clip.title,
          clipDescription: clip.description || null,
          clipHashtags: clip.hashtags || [],
          clipUrl: clip.url || '',
          clipSource: clip.url?.includes('youtube') || clip.url?.includes('youtu.be') ? 'youtube' : 'external',
          clipWindow: '',
          categoryTag: 'Gameplan',
          levelTag: i === 0 ? 'Neu' : 'Gameplan',
          description: clip.description || '',
          keyPoints: [{ label: 'Gameplan', items: [currentNodeTitle] }],
          comments: [],
          helperText: `Video ${i + 1} von ${clips.length}`,
          learningStatus: 'NEW',
          confidenceScore: 0,
          progressCreditEarned: false,
          isDue: false,
          isCore: true,
          priorityScore: clips.length - i,
        })
      }
    }

    console.log(`Start-queue: Built queue with ${queue.length} cards for user ${userId}`)
    return NextResponse.json({ queue })
    
  } catch (error) {
    console.error('Start-queue error:', error)
    return NextResponse.json({ queue: [] }, { status: 500 })
  }
}
