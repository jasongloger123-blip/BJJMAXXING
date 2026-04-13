import { NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/admin-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function resolveRequester(request: Request, admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const supabase = createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()

  if (cookieUser) {
    return cookieUser
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return null

  const {
    data: { user },
  } = await admin.auth.getUser(token)

  return user ?? null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const requester = await resolveRequester(request, admin)
  const { data: requesterProfile } = requester
    ? await admin.from('user_profiles').select('email').eq('id', requester.id).maybeSingle()
    : { data: null as { email?: string | null } | null }

  if (!requester || !hasAdminAccess({ email: requester.email, profileEmail: requesterProfile?.email })) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { query?: string } | null
  const query = body?.query?.trim()
  if (!query) {
    return NextResponse.json({ error: 'User-ID, E-Mail oder Username fehlt.' }, { status: 400 })
  }

  const queryColumn = isUuid(query) ? 'id' : query.includes('@') ? 'email' : 'username'
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, username, full_name, email')
    .eq(queryColumn, query)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile?.id) {
    return NextResponse.json({ error: 'User wurde nicht gefunden.' }, { status: 404 })
  }

  const [eventsDelete, progressDelete, statusDelete] = await Promise.all([
    admin.from('training_clip_events').delete().eq('user_id', profile.id),
    admin.from('progress').delete().eq('user_id', profile.id),
    admin.from('training_clip_status').delete().eq('user_id', profile.id),
  ])

  if (eventsDelete.error) {
    return NextResponse.json({ error: eventsDelete.error.message }, { status: 500 })
  }

  if (progressDelete.error) {
    return NextResponse.json({ error: progressDelete.error.message }, { status: 500 })
  }

  if (statusDelete.error) {
    return NextResponse.json({ error: statusDelete.error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    profile,
    message: 'Fortschritt wurde zurueckgesetzt.',
  })
}
