import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.log('Middleware auth error:', error.message)
  }
  
  // Try to refresh the session if there's a session but getUser failed
  // This helps with cross-browser cookie issues
  if (!user && request.cookies.get('sb-auth-token')) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      console.log('Session found, user will be available on next request')
    }
  }

  return supabaseResponse
}
