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

// Extract access token from Supabase auth cookie
function extractTokenFromCookie(cookieHeader: string): string | null {
  // Look for sb-<project-ref>-auth-token cookie
  const match = cookieHeader.match(/sb-[\w-]+-auth-token=([^;]+)/)
  if (!match) return null
  
  try {
    // The cookie value is a JSON string with base64 encoded access_token
    const cookieValue = decodeURIComponent(match[1])
    const parsed = JSON.parse(cookieValue)
    
    // The token might be directly in the cookie or in a nested structure
    if (typeof parsed === 'string') {
      return parsed
    }
    if (parsed && typeof parsed === 'object') {
      // Try different possible structures
      return parsed.access_token || parsed.token || null
    }
    return null
  } catch (e) {
    console.log('Start-queue: Failed to parse auth cookie:', e)
    return null
  }
}

export async function GET(request: NextRequest) {
  const admin = createAdminClient()
  if (!admin) {
    console.log('Start-queue: No admin client')
    return NextResponse.json({ queue: [] })
  }

  try {
    // Get cookie header
    const cookieHeader = request.headers.get('cookie')
    
    let user = null
    let userId: string | null = null
    
    // Try to get user from Authorization header first
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user: tokenUser } } = await admin.auth.getUser(token)
      if (tokenUser) {
        user = tokenUser
        userId = tokenUser.id
      }
    }
    
    // If no user from header, try cookie
    if (!user && cookieHeader) {
      const token = extractTokenFromCookie(cookieHeader)
      if (token) {
        const { data: { user: cookieUser } } = await admin.auth.getUser(token)
        if (cookieUser) {
          user = cookieUser
          userId = cookieUser.id
        }
      }
    }
    
    // If still no user, get the fallback gameplan anyway
    // This allows non-logged-in users to see videos too
    console.log('Start-queue: User authenticated:', !!user, userId ? `(${userId.substring(0, 8)}...)` : '(guest)')

    // Get minimal data needed for first video
    let completedIds: string[] = []
    let planId: string | null = null
    
    if (userId) {
      // Get progress for logged-in user
      const { data: progress } = await admin
        .from('progress')
        .select('node_id, completed')
        .eq('user_id', userId)
        .limit(100)
        
      completedIds = (progress ?? [])
        .filter((entry) => entry.completed)
        .map((entry) => entry.node_id)

      // Get user's profile
      const { data: profile } = await admin
        .from('user_profiles')
        .select('primary_archetype, active_gameplan_id')
        .eq('id', userId)
        .maybeSingle()
        
      planId = profile?.active_gameplan_id ?? null
    }

    // Get fallback gameplan or user's active plan
    let planQuery = admin
      .from('gameplans')
      .select('id, slug, title, main_path_node_ids')
      .eq('status', 'published')

    if (planId) {
      planQuery = planQuery.eq('id', planId)
    } else {
      planQuery = planQuery.eq('is_fallback_default', true)
    }

    const { data: plan } = await planQuery.maybeSingle()
    
    if (!plan) {
      console.log('Start-queue: No plan found')
      return NextResponse.json({ queue: [] })
    }

    // Get first few nodes from plan
    const nodeIds = (plan.main_path_node_ids ?? []).slice(0, 10)
    
    if (nodeIds.length === 0) {
      console.log('Start-queue: No nodes in plan')
      return NextResponse.json({ queue: [] })
    }

    // Get nodes with their videos
    const { data: nodes } = await admin
      .from('nodes')
      .select('id, title, videos')
      .in('id', nodeIds)

    // Build simple queue
    const queue: QueueCard[] = []
    
    for (const node of (nodes ?? [])) {
      // Check if node has videos
      const videos = node.videos as Array<{ url: string; title?: string }> | undefined
      if (videos && videos.length > 0) {
        const video = videos[0]
        queue.push({
          id: `${node.id}-video-0`,
          nodeId: node.id,
          nodeTitle: node.title || 'Technik',
          clipTitle: video.title || node.title || 'Clip',
          clipUrl: video.url,
          completed: userId ? completedIds.includes(node.id) : false,
        })
      }
    }
    
    console.log('Start-queue: Built queue with', queue.length, 'items for', userId ? 'logged-in user' : 'guest')

    return NextResponse.json({ queue })
  } catch (error) {
    console.error('Start-queue error:', error)
    return NextResponse.json({ queue: [] })
  }
}
