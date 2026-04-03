import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CommentPayload =
  | { type: 'comment'; clipKey?: string; nodeId?: string; content?: string }
  | { type: 'reaction'; commentId?: string; value?: 1 | -1 }
  | { type: 'reply'; commentId?: string; content?: string }

export async function POST(request: Request) {
  const supabase = createClient()
  const admin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const body = (await request.json()) as CommentPayload
  const { data: profile } = await supabase.from('user_profiles').select('username, full_name, avatar_url').eq('id', user.id).maybeSingle()
  const authorName = profile?.username ?? profile?.full_name ?? user.email?.split('@')[0] ?? 'BJJ Athlete'
  const avatarUrl = profile?.avatar_url ?? null

  if (body.type === 'comment') {
    if (!body.clipKey || !body.nodeId || !body.content?.trim()) {
      return NextResponse.json({ error: 'Kommentar unvollstaendig.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('clip_comments')
      .insert({
        user_id: user.id,
        node_id: body.nodeId,
        clip_key: body.clipKey,
        author_name: authorName,
        author_avatar_url: avatarUrl,
        content: body.content.trim(),
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id })
  }

  if (body.type === 'reaction') {
    if (!body.commentId || !body.value) {
      return NextResponse.json({ error: 'Reaktion unvollstaendig.' }, { status: 400 })
    }

    const { data: comment } = await supabase.from('clip_comments').select('user_id, content').eq('id', body.commentId).maybeSingle()
    const { error } = await supabase.from('clip_comment_reactions').upsert({
      comment_id: body.commentId,
      user_id: user.id,
      value: body.value,
    })

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    if (admin && comment?.user_id && comment.user_id !== user.id) {
      await admin.from('notifications').insert({
        user_id: comment.user_id,
        type: body.value === 1 ? 'comment_like' : 'comment_dislike',
        title: body.value === 1 ? 'Neuer Like auf deinen Kommentar' : 'Neuer Dislike auf deinen Kommentar',
        body: `${authorName} hat auf deinen Kommentar reagiert.`,
        metadata: { comment_id: body.commentId },
      })
    }

    return NextResponse.json({ ok: true })
  }

  if (body.type === 'reply') {
    if (!body.commentId || !body.content?.trim()) {
      return NextResponse.json({ error: 'Antwort unvollstaendig.' }, { status: 400 })
    }

    const { data: comment } = await supabase.from('clip_comments').select('user_id').eq('id', body.commentId).maybeSingle()
    const { data, error } = await supabase
      .from('clip_comment_replies')
      .insert({
        comment_id: body.commentId,
        user_id: user.id,
        author_name: authorName,
        author_avatar_url: avatarUrl,
        content: body.content.trim(),
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    if (admin && comment?.user_id && comment.user_id !== user.id) {
      await admin.from('notifications').insert({
        user_id: comment.user_id,
        type: 'comment_reply',
        title: 'Neue Antwort auf deinen Kommentar',
        body: `${authorName} hat auf deinen Kommentar geantwortet.`,
        metadata: { comment_id: body.commentId, reply_id: data.id },
      })
    }

    return NextResponse.json({ ok: true, id: data.id })
  }

  return NextResponse.json({ error: 'Unbekannter Interaktionstyp.' }, { status: 400 })
}
