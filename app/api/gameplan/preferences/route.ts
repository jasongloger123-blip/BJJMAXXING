import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()

    if (!admin) {
      return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
    }

    const user = await resolveUser(request, admin)
    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
    }

    const payload = (await request.json()) as { disabledPlanIds?: unknown; activePlanId?: unknown }
    const disabledPlanIds = Array.isArray(payload.disabledPlanIds)
      ? Array.from(new Set(payload.disabledPlanIds.filter((value): value is string => typeof value === 'string' && value.length > 0)))
      : []
    const activePlanId = typeof payload.activePlanId === 'string' && payload.activePlanId.length > 0 ? payload.activePlanId : null

    const { error } = await admin
      .from('user_profiles')
      .update({ disabled_gameplan_ids: disabledPlanIds, active_gameplan_id: activePlanId })
      .eq('id', user.id)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ disabledPlanIds, activePlanId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler.' },
      { status: 500 }
    )
  }
}
