import { NextResponse } from 'next/server'
import { getFallbackGameplan, toResolvedGameplan, type GameplanProgressRow, type GameplanSourceNodeMeta } from '@/lib/gameplans'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const PLAN_SELECT = `
  id,
  slug,
  title,
  headline,
  hero_image_url,
  status,
  creator_name,
  creator_role,
  creator_initials,
  creator_profile_href,
  canvas_width,
  canvas_height,
  main_path_node_ids,
  is_fallback_default,
  gameplan_nodes(*),
  gameplan_edges(*)
`

const PLAN_SELECT_LEGACY = `
  id,
  slug,
  title,
  headline,
  status,
  creator_name,
  creator_role,
  creator_initials,
  creator_profile_href,
  canvas_width,
  canvas_height,
  main_path_node_ids,
  is_fallback_default,
  gameplan_nodes(*),
  gameplan_edges(*)
`

async function resolveUser(request: Request, admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const supabase = createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()

  if (cookieUser) {
    return cookieUser
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    return null
  }

  const {
    data: { user: tokenUser },
  } = await admin.auth.getUser(token)

  return tokenUser ?? null
}

async function getPublishedPlanByAssignment(admin: NonNullable<ReturnType<typeof createAdminClient>>, field: 'profile_id' | 'archetype_id', value: string) {
  const initialResponse = await admin
    .from('gameplan_assignments')
    .select(`priority, gameplans!inner(${PLAN_SELECT})`)
    .eq(field, value)
    .eq('is_active', true)
    .eq('gameplans.status', 'published')
    .order('priority', { ascending: true })
    .limit(1)
    .maybeSingle()
  let data: any = initialResponse.data
  let error: any = initialResponse.error

  if (error?.message?.includes("'hero_image_url'")) {
    const legacyResponse = await admin
      .from('gameplan_assignments')
      .select(`priority, gameplans!inner(${PLAN_SELECT_LEGACY})`)
      .eq(field, value)
      .eq('is_active', true)
      .eq('gameplans.status', 'published')
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle()
    data = legacyResponse.data
    error = legacyResponse.error
  }

  if (error) throw new Error(error.message)
  if (!data?.gameplans) return null
  return Array.isArray(data.gameplans) ? data.gameplans[0] ?? null : data.gameplans
}

async function getSourceNodeMeta(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  planRecord: any | null
) {
  const sourceNodeIds = Array.from(
    new Set(
      [...(planRecord?.gameplan_nodes ?? [])]
        .map((node: any) => node.source_node_id)
        .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  if (sourceNodeIds.length === 0) {
    return {}
  }

  const { data } = await admin.from('nodes').select('id, title, completion_rules').in('id', sourceNodeIds)
  return Object.fromEntries(
    (data ?? []).map((node: any) => [
      node.id,
      {
        id: node.id,
        title: node.title ?? null,
        completionRuleIds: Array.isArray(node.completion_rules)
          ? node.completion_rules
              .map((rule: any) => (typeof rule?.id === 'string' ? rule.id : null))
              .filter((ruleId: string | null): ruleId is string => Boolean(ruleId))
          : [],
      } satisfies GameplanSourceNodeMeta,
    ])
  )
}

export async function GET(request: Request) {
  const admin = createAdminClient()
  const user = admin ? await resolveUser(request, admin) : null

  if (!admin) {
    return NextResponse.json({ plan: getFallbackGameplan(null) })
  }

  try {
    let primaryArchetype: string | null = null
    let progressRows: GameplanProgressRow[] = []

    if (user) {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('primary_archetype')
        .eq('id', user.id)
        .maybeSingle()

      primaryArchetype = profile?.primary_archetype ?? null
      const { data: progress } = await admin
        .from('progress')
        .select('node_id, watched, written, drilled, attempted, hit_in_sparring, completed, validated')
        .eq('user_id', user.id)
      progressRows = (progress ?? []) as GameplanProgressRow[]

      const directPlan = await getPublishedPlanByAssignment(admin, 'profile_id', user.id)
      if (directPlan) {
        const sourceNodeMetaById = await getSourceNodeMeta(admin, directPlan)
        return NextResponse.json({ plan: toResolvedGameplan(directPlan, progressRows, 'assignment', sourceNodeMetaById) })
      }

      if (primaryArchetype) {
        const archetypePlan = await getPublishedPlanByAssignment(admin, 'archetype_id', primaryArchetype)
        if (archetypePlan) {
          const sourceNodeMetaById = await getSourceNodeMeta(admin, archetypePlan)
          return NextResponse.json({ plan: toResolvedGameplan(archetypePlan, progressRows, 'assignment', sourceNodeMetaById) })
        }
      }
    }

    const initialFallback = await admin
      .from('gameplans')
      .select(PLAN_SELECT)
      .eq('status', 'published')
      .eq('is_fallback_default', true)
      .maybeSingle()
    let fallbackPlan: any = initialFallback.data
    let error: any = initialFallback.error

    if (error?.message?.includes("'hero_image_url'")) {
      const legacyFallback = await admin
        .from('gameplans')
        .select(PLAN_SELECT_LEGACY)
        .eq('status', 'published')
        .eq('is_fallback_default', true)
        .maybeSingle()
      fallbackPlan = legacyFallback.data
      error = legacyFallback.error
    }

    if (error) throw new Error(error.message)

    if (fallbackPlan) {
      const sourceNodeMetaById = await getSourceNodeMeta(admin, fallbackPlan)
      return NextResponse.json({ plan: toResolvedGameplan(fallbackPlan, progressRows, 'assignment', sourceNodeMetaById) })
    }

    return NextResponse.json({ plan: getFallbackGameplan(primaryArchetype) })
  } catch (error) {
    return NextResponse.json(
      {
        plan: getFallbackGameplan(null),
        error: error instanceof Error ? error.message : 'Unbekannter Fehler.',
      },
      { status: 200 }
    )
  }
}
