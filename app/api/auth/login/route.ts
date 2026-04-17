import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

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

  const { data, error } = await supabase.auth.signInWithPassword({
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

  // Manually set the auth cookie that @supabase/ssr expects
  // The cookie name format is: sb-{project-ref}-auth-token
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1]
  if (data.session && projectRef) {
    const cookieStore = cookies()
    const cookieName = `sb-${projectRef}-auth-token`
    const cookieValue = JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
    
    cookieStore.set(cookieName, cookieValue, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      secure: false, // Must be false for localhost/cross-browser compatibility
      httpOnly: false, // Allow JavaScript to read the cookie for client-side auth
    })
    
    console.log('Login: Set auth cookie', { cookieName, userId: data.user?.id })
  }

  return NextResponse.json({ ok: true, user: data.user ? { id: data.user.id, email: data.user.email } : null })
}
