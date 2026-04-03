import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const body = (await request.json()) as {
    nodeId?: string
    progress?: Record<string, boolean>
    completed?: boolean
  }

  if (!body.nodeId) {
    return NextResponse.json({ error: 'nodeId fehlt.' }, { status: 400 })
  }

  const payload = {
    user_id: user.id,
    node_id: body.nodeId,
    ...(body.progress ?? {}),
    completed: Boolean(body.completed),
    completed_at: body.completed ? new Date().toISOString() : null,
  }

  const { error } = await supabase.from('progress').upsert(payload)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
