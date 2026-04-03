import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminEmails } from '@/lib/admin-access'

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

export async function POST(request: Request) {
  const supabase = createClient()
  const { user, admin } = await resolveAuthenticatedUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const db = admin ?? supabase

  const body = (await request.json()) as {
    videoUrl?: string
    notes?: string
    reviewType?: 'manual' | 'ai'
  }

  if (!body.videoUrl) {
    return NextResponse.json({ error: 'videoUrl fehlt.' }, { status: 400 })
  }

  const { data: latestReview } = await db
    .from('review_submissions')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const shouldResubmitExisting = latestReview?.status === 'needs_work'

  const reviewMutation = shouldResubmitExisting
    ? db
        .from('review_submissions')
        .update({
          video_url: body.videoUrl,
          notes: body.notes ?? null,
          review_type: body.reviewType ?? 'manual',
          status: 'submitted',
          reviewer_feedback: null,
          reviewed_at: null,
          reviewed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', latestReview.id)
        .eq('user_id', user.id)
        .select('id')
        .single()
    : db
        .from('review_submissions')
        .insert({
          user_id: user.id,
          video_url: body.videoUrl,
          notes: body.notes ?? null,
          review_type: body.reviewType ?? 'manual',
        })
        .select('id')
        .single()

  const { data: insertedReview, error } = await reviewMutation

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (admin) {
    const adminEmails = getAdminEmails()

    if (adminEmails.length > 0) {
      const { data: adminProfiles } = await admin
        .from('user_profiles')
        .select('id, email')
        .in('email', adminEmails)

      if (adminProfiles?.length) {
        const authorLabel = user.email ?? 'Ein Nutzer'
        await admin.from('notifications').insert(
          adminProfiles.map((profile) => ({
              user_id: profile.id,
              type: 'review_submitted',
              title: 'Neue A-Plan Einreichung',
              body: `${authorLabel} hat ein neues Review zur Bewertung eingereicht.`,
              metadata: {
                review_id: insertedReview?.id ?? null,
                source_user_id: user.id,
                video_url: body.videoUrl,
              },
            }))
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
