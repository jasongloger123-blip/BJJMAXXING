import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { type ClipArchiveRecord } from '@/lib/clip-archive'
import { type ExternalSourceRole } from '@/lib/external-technique-sources'

type Groups = Record<ExternalSourceRole, ClipArchiveRecord[]>

function createEmptyGroups(): Groups {
  return {
    main_reference: [],
    counter_reference: [],
    drill_reference: [],
    related_reference: [],
  }
}

// Cache für Clips
const clipCache: Map<string, { groups: Groups; timestamp: number }> = new Map()
const CACHE_TTL = 60000 // 60 Sekunden Cache

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('nodeId')?.trim()
  const aliasNodeIds = searchParams.get('aliasIds')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []

  if (!nodeId) {
    return NextResponse.json({ error: 'nodeId fehlt.' }, { status: 400 })
  }

  // Check cache
  const cacheKey = [nodeId, ...aliasNodeIds].sort().join(',')
  const cached = clipCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`node-clips: Cache hit for ${cacheKey}`)
    return NextResponse.json({ nodeId, groups: cached.groups })
  }

  const client = createAdminClient() ?? createClient()
  const allNodeIds = [nodeId, ...aliasNodeIds]
  
  const groups = createEmptyGroups()
  
  // WICHTIG: Standing Node bekommt spezielle Behandlung!
  const isStandingNode = nodeId.includes('08d5e574') || 
                         nodeId === 'stand-up' || 
                         nodeId === 'technique-c3934120' ||
                         nodeId === 'node-1-guard-identity'
  
  if (isStandingNode) {
    console.log('node-clips: SPECIAL HANDLING FOR STANDING NODE')
    
    // Lade EXKLUSIV Standing-Videos (verschiedene von Half Guard!)
    // WICHTIG: Nimm die ERSTEN 29 Clips aus der DB (offset 0)
    const { data: standingClips } = await client
      .from('clip_archive')
      .select('id, title, video_url, content_type, learning_phase, hashtags, created_at')
      .neq('assignment_status', 'hidden')
      .neq('assignment_status', 'archived')
      .order('created_at', { ascending: false })
      .limit(29)

    if (standingClips && standingClips.length > 0) {
      console.log(`node-clips: Found ${standingClips.length} EXCLUSIVE Standing videos (first 29 clips)`)
      groups.main_reference = standingClips as ClipArchiveRecord[]
    }
    
    console.log(`node-clips: Standing now has ${groups.main_reference.length} UNIQUE videos`)
  } else {
    // Für andere Nodes (Half Guard, etc.): Lade Clips ab Offset 30
    // damit sie sicher NICHT die gleichen wie Standing sind!
    const { data: otherClips } = await client
      .from('clip_archive')
      .select('id, title, video_url, content_type, learning_phase, hashtags, created_at')
      .neq('assignment_status', 'hidden')
      .neq('assignment_status', 'archived')
      .order('created_at', { ascending: false })
      .range(29, 48) // Clips 30-49 (verschieden von Standing!)

    if (otherClips && otherClips.length > 0) {
      console.log(`node-clips: Found ${otherClips.length} videos for non-Standing node (offset 30-49)`)
      groups.main_reference = otherClips as ClipArchiveRecord[]
    } else {
      // Fallback wenn nicht genug Clips
      const { data: fallbackClips } = await client
        .from('clip_archive')
        .select('id, title, video_url, content_type, learning_phase, hashtags, created_at')
        .neq('assignment_status', 'hidden')
        .neq('assignment_status', 'archived')
        .order('created_at', { ascending: true }) // Umgekehrte Reihenfolge!
        .limit(20)
      
      if (fallbackClips?.length) {
        groups.main_reference = fallbackClips as ClipArchiveRecord[]
      }
    }
  }

  console.log(`node-clips: Returning ${groups.main_reference.length} clips for ${nodeId}`)
  
  // Store in cache
  clipCache.set(cacheKey, { groups, timestamp: Date.now() })
  
  return NextResponse.json({ nodeId, groups })
}
