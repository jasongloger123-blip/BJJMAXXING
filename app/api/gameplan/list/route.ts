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

async function getPublishedPlansByAssignment(
  admin: NonNullable<ReturnType<typeof createAdminClient>>, 
  field: 'profile_id' | 'archetype_id', 
  value: string
) {
  const initialResponse = await admin
    .from('gameplan_assignments')
    .select(`priority, gameplans!inner(${PLAN_SELECT})`)
    .eq(field, value)
    .eq('is_active', true)
    .eq('gameplans.status', 'published')
    .order('priority', { ascending: true })

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
    data = legacyResponse.data
    error = legacyResponse.error
  }

  if (error) throw new Error(error.message)
  
  const plans = Array.isArray(data) ? data : []
  return plans
    .flatMap((item: any) => {
      if (!item?.gameplans) return []
      return Array.isArray(item.gameplans) ? item.gameplans.filter(Boolean) : [item.gameplans]
    })
    .filter(Boolean)
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

  const { data, error } = await admin
    .from('nodes')
    .select('id, title, completion_rules')
    .in('id', sourceNodeIds)

  if (error) throw new Error(error.message)

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
  try {
    const admin = createAdminClient()

    if (!admin) {
      return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
    }

    const user = await resolveUser(request, admin)
    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
    }

    let progressRows: GameplanProgressRow[] = []

    // Get user profile
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id, primary_archetype')
      .eq('id', user.id)
      .maybeSingle()

    const profileId = profile?.id
    const archetypeId = profile?.primary_archetype

    const { data: progress } = await admin
      .from('progress')
      .select('node_id, watched, written, drilled, attempted, hit_in_sparring, completed, validated')
      .eq('user_id', user.id)
    progressRows = (progress ?? []) as GameplanProgressRow[]

    // Get assigned plans from profile
    const plansFromProfile = profileId 
      ? await getPublishedPlansByAssignment(admin, 'profile_id', profileId)
      : []

    // Get assigned plans from archetype
    const plansFromArchetype = archetypeId
      ? await getPublishedPlansByAssignment(admin, 'archetype_id', archetypeId)
      : []

    // Combine and deduplicate
    const allPlans = [...plansFromProfile, ...plansFromArchetype]
    const uniquePlans = allPlans.filter((plan, index, self) => 
      index === self.findIndex((p) => p.id === plan.id)
    )

    // Get fallback plan if no assignments
    let plans = uniquePlans
    if (plans.length === 0) {
      const initialFallback = await admin
        .from('gameplans')
        .select(PLAN_SELECT)
        .eq('is_fallback_default', true)
        .eq('status', 'published')
        .maybeSingle()

      let fallbackPlan: any = initialFallback.data
      let fallbackError: any = initialFallback.error

      if (fallbackError?.message?.includes("'hero_image_url'")) {
        const legacyFallback = await admin
          .from('gameplans')
          .select(PLAN_SELECT_LEGACY)
          .eq('is_fallback_default', true)
          .eq('status', 'published')
          .maybeSingle()
        fallbackPlan = legacyFallback.data
        fallbackError = legacyFallback.error
      }

      if (fallbackError) throw new Error(fallbackError.message)

      if (fallbackPlan) {
        plans = [fallbackPlan]
      }
    }

    // Resolve all plans
    const resolvedPlans = await Promise.all(
      plans.map(async (planRecord) => {
        const sourceMeta = await getSourceNodeMeta(admin, planRecord)
        return toResolvedGameplan(planRecord, progressRows, 'assignment', sourceMeta)
      })
    )

    if (resolvedPlans.length === 0) {
      return NextResponse.json({
        plans: [getFallbackGameplan(archetypeId)],
        count: 1,
      })
    }

    return NextResponse.json({ 
      plans: resolvedPlans.filter(Boolean),
      count: resolvedPlans.length 
    })
  } catch (error) {
    console.error('Error fetching user gameplans:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler.' },
      { status: 500 }
    )
  }
}
