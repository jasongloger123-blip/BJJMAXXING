import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasAdminAccess } from '@/lib/admin-access'

type AuthUserSummary = {
  id: string
  last_sign_in_at: string | null
}

async function resolveAuthenticatedUser(request?: Request) {
  const supabase = createClient()
  const admin = createAdminClient()

  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()

  if (cookieUser) {
    return { user: cookieUser, admin }
  }

  const authHeader = request?.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token || !admin) {
    return { user: null, admin }
  }

  const {
    data: { user: tokenUser },
  } = await admin.auth.getUser(token)

  return { user: tokenUser ?? null, admin }
}

async function listAllAuthUsers(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const users: AuthUserSummary[] = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(error.message)
    }

    const pageUsers = data.users.map((user) => ({
      id: user.id,
      last_sign_in_at: user.last_sign_in_at ?? null,
    }))

    users.push(...pageUsers)

    if (pageUsers.length < perPage) {
      break
    }

    page += 1
  }

  return users
}

export async function GET(request: Request) {
  const { user, admin } = await resolveAuthenticatedUser(request)

  const { data: profile } =
    user && admin
      ? await admin.from('user_profiles').select('email').eq('id', user.id).maybeSingle()
      : { data: null as { email?: string | null } | null }

  if (!user || !hasAdminAccess({ email: user.email, profileEmail: profile?.email })) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  try {
    let profileData: any[] | null = null
    let profileError: Error | null = null

    try {
      const result = await admin
        .from('user_profiles')
        .select(`
          id,
          username,
          full_name,
          email,
          avatar_url,
          belt,
          primary_archetype,
          nationality,
          gym_name,
          gym_unlisted_name,
          gym_location,
          social_link,
          youtube_url,
          instagram_url,
          tiktok_url,
          facebook_url,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (result.error) {
        const fallbackResult = await admin
          .from('user_profiles')
          .select(`
            id,
            username,
            full_name,
            email,
            avatar_url,
            belt,
            primary_archetype,
            nationality,
            gym_name,
            gym_unlisted_name,
            gym_location,
            social_link,
            created_at
          `)
          .order('created_at', { ascending: false })

        profileData = fallbackResult.data
        profileError = fallbackResult.error ? new Error(fallbackResult.error.message) : null

        if (profileData) {
          profileData = profileData.map((profile) => ({
            ...profile,
            youtube_url: null,
            instagram_url: null,
            tiktok_url: null,
            facebook_url: null,
          }))
        }
      } else {
        profileData = result.data
      }
    } catch (error) {
      profileError = error instanceof Error ? error : new Error('Profile konnten nicht geladen werden.')
    }

    if (profileError) {
      throw profileError
    }

    const [usersData, progressResult, eventsResult] = await Promise.all([
      listAllAuthUsers(admin),
      admin.from('progress').select('user_id, completed, validated'),
      admin.from('training_clip_events').select('user_id'),
    ])

    if (progressResult.error) {
      throw new Error(progressResult.error.message)
    }

    if (eventsResult.error) {
      throw new Error(eventsResult.error.message)
    }

    const statsMap = new Map<string, { completed: number; validated: number; events: number }>()

    for (const progress of progressResult.data ?? []) {
      const current = statsMap.get(progress.user_id) ?? { completed: 0, validated: 0, events: 0 }
      if (progress.completed) current.completed += 1
      if (progress.validated) current.validated += 1
      statsMap.set(progress.user_id, current)
    }

    for (const event of eventsResult.data ?? []) {
      const current = statsMap.get(event.user_id) ?? { completed: 0, validated: 0, events: 0 }
      current.events += 1
      statsMap.set(event.user_id, current)
    }

    const lastSignInMap = new Map(usersData.map((entry) => [entry.id, entry.last_sign_in_at]))

    const profiles = (profileData ?? []).map((profile) => {
      const stats = statsMap.get(profile.id) ?? { completed: 0, validated: 0, events: 0 }

      return {
        ...profile,
        last_sign_in_at: lastSignInMap.get(profile.id) ?? null,
        completed_nodes: stats.completed,
        validated_nodes: stats.validated,
        total_progress: Math.max(0, stats.completed + stats.validated),
        training_events: stats.events,
      }
    })

    return NextResponse.json({ profiles })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Fehler beim Laden der Admin-Profile.',
      },
      { status: 500 }
    )
  }
}
