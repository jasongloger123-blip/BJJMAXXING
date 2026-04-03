import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminEmails, isAdminEmail } from '@/lib/admin-access'

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

export async function GET(request: Request) {
  const { user, admin } = await resolveAuthenticatedUser(request)

  const debug = {
    userEmail: user?.email ?? null,
    adminEmails: getAdminEmails(),
    isAdmin: isAdminEmail(user?.email),
    hasAdminClient: Boolean(admin),
  }

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.', debug }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.', debug }, { status: 500 })
  }

  const { data: submissions, error } = await admin
    .from('review_submissions')
    .select('id, user_id, video_url, notes, review_type, status, reviewer_feedback, created_at, reviewed_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = Array.from(new Set((submissions ?? []).map((entry) => entry.user_id).filter(Boolean)))

  let profiles: Record<string, { username?: string | null; full_name?: string | null; avatar_url?: string | null }> = {}

  if (userIds.length > 0) {
    const { data: profileRows } = await admin
      .from('user_profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds)

    profiles = Object.fromEntries(
      (profileRows ?? []).map((row) => [
        row.id,
        {
          username: row.username,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
        },
      ])
    )
  }

  return NextResponse.json({
    debug,
    submissions: (submissions ?? []).map((entry) => ({
      ...entry,
      profile: profiles[entry.user_id] ?? null,
    })),
  })
}

export async function PATCH(request: Request) {
  const { user, admin } = await resolveAuthenticatedUser(request)

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (!admin) {
    return NextResponse.json({ error: 'Admin-Client nicht konfiguriert.' }, { status: 500 })
  }

  const body = (await request.json()) as {
    id?: string
    status?: string
    reviewerFeedback?: string
  }

  if (!body.id || !body.status) {
    return NextResponse.json({ error: 'Review-ID oder Status fehlt.' }, { status: 400 })
  }

  const { data: existingReview } = await admin
    .from('review_submissions')
    .select('user_id, status')
    .eq('id', body.id)
    .maybeSingle()

  const { error } = await admin
    .from('review_submissions')
    .update({
      status: body.status,
      reviewer_feedback: body.reviewerFeedback ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (existingReview?.user_id) {
    const statusLabel =
      body.status === 'approved'
        ? 'Review freigegeben'
        : body.status === 'needs_work'
          ? 'Review braucht Nacharbeit'
          : body.status === 'in_review'
            ? 'Review wird bearbeitet'
            : 'Review aktualisiert'

    const bodyText =
      body.status === 'approved'
        ? 'Dein A-Plan wurde freigegeben.'
        : body.status === 'needs_work'
          ? `Dein A-Plan braucht noch Nacharbeit.${body.reviewerFeedback ? ` Feedback: ${body.reviewerFeedback}` : ''}`
          : body.status === 'in_review'
            ? 'Dein A-Plan wird gerade bearbeitet.'
            : 'Der Status deiner Einreichung wurde aktualisiert.'

    await admin.from('notifications').insert({
      user_id: existingReview.user_id,
      type: 'review_status_updated',
      title: statusLabel,
      body: bodyText,
      metadata: {
        review_id: body.id,
        status: body.status,
        reviewer_feedback: body.reviewerFeedback ?? null,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
