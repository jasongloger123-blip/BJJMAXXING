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
    console.log('Start-queue: Cookie header present:', !!cookieHeader)
    
    let user = null
    
    // Try to get user from Authorization header first
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      console.log('Start-queue: Trying Authorization header')
      const { data: { user: tokenUser }, error } = await admin.auth.getUser(token)
      if (tokenUser) {
        user = tokenUser
        console.log('Start-queue: User found from Authorization header:', user.id)
      } else if (error) {
        console.log('Start-queue: Auth header error:', error.message)
      }
    }
    
    // If no user from header, try cookie
    if (!user && cookieHeader) {
      console.log('Start-queue: Trying cookie auth, cookies:', cookieHeader.substring(0, 300))
      
      const token = extractTokenFromCookie(cookieHeader)
      if (token) {
        console.log('Start-queue: Extracted token from cookie, length:', token.length)
        const { data: { user: cookieUser }, error } = await admin.auth.getUser(token)
        if (cookieUser) {
          user = cookieUser
          console.log('Start-queue: User found from cookie:', user.id)
        } else if (error) {
          console.log('Start-queue: Cookie auth error:', error.message)
        }
      } else {
        console.log('Start-queue: No token found in cookies')
      }
    }
    
    if (!user) {
      console.log('Start-queue: No authenticated user found')
      return NextResponse.json({ queue: [] })
    }
    
    console.log('Start-queue: Authenticated user:', user.id)

    // Get minimal data needed for first video
    const { data: progress } = await admin
      .from('progress')
      .select('node_id, completed')
      .eq('user_id', user.id)
      .limit(100)
      
    console.log('Start-queue: Progress entries:', progress?.length ?? 0)

    const completedIds = (progress ?? [])
      .filter((entry) => entry.completed)
      .map((entry) => entry.node_id)

    // Get user's profile for archetype
    const { data: profile } = await admin
      .from('user_profiles')
      .select('primary_archetype, active_gameplan_id')
      .eq('id', user.id)
      .maybeSingle()
      
    console.log('Start-queue: Profile:', { hasProfile: !!profile, archetype: profile?.primary_archetype })

    // Get simple fallback gameplan or user's active plan
    const planId = profile?.active_gameplan_id
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
    
    console.log('Start-queue: Plan:', { hasPlan: !!plan, title: plan?.title })

    if (!plan) {
      console.log('Start-queue: No plan found')
      return NextResponse.json({ queue: [] })
    }

    // Get first few nodes from plan
    const nodeIds = (plan.main_path_node_ids ?? []).slice(0, 10)
    
    console.log('Start-queue: Node IDs:', nodeIds.length)
    
    if (nodeIds.length === 0) {
      console.log('Start-queue: No nodes in plan')
      return NextResponse.json({ queue: [] })
    }

    // Get nodes with their videos
    const { data: nodes, error: nodesError } = await admin
      .from('nodes')
      .select('id, title, videos')
      .in('id', nodeIds)
      
    console.log('Start-queue: Nodes loaded:', { count: nodes?.length ?? 0, error: nodesError?.message })

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
          completed: completedIds.includes(node.id),
        })
      }
    }
    
    console.log('Start-queue: Built queue with', queue.length, 'items')

    return NextResponse.json({ queue })
  } catch (error) {
    console.error('Start-queue error:', error)
    return NextResponse.json({ queue: [] })
  }
}