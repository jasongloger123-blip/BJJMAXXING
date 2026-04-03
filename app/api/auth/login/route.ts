import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const body = (await request.json()) as {
    email?: string
    password?: string
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  if (!email || !password) {
    return NextResponse.json({ error: 'E-Mail und Passwort sind erforderlich.' }, { status: 400 })
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Server-side login failed', {
      email,
      message: error.message,
      status: error.status,
      code: error.code,
    })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
