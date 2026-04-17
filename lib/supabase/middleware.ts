import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

// Get the project reference from the Supabase URL
const getProjectRef = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  const match = url.match(/https:\/\/([^.]+)/)
  return match?.[1] ?? null
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  
  const projectRef = getProjectRef()
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      cookieOptions: {
        name: cookieName,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production', // true in production, false in dev
        maxAge: 60 * 60 * 24 * 7,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Refresh session if expired - required for Server Components
  // This is the key fix for Safari/Chrome Incognito where cookies behave differently
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError) {
    console.log('Middleware auth error:', userError.message)
  }
  
  // Try to refresh the session if there's a session but getUser failed
  // This helps with cross-browser cookie issues
  if (!user && request.cookies.get(cookieName)) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.log('Middleware session refresh error:', sessionError.message)
    }
    if (session) {
      console.log('Session refreshed successfully')
    }
  }

  return supabaseResponse
}
