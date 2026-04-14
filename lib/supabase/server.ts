import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
        autoRefreshToken: false, // Don't auto-refresh on server
      },
      cookieOptions: {
        name: 'sb-auth-token',
        domain: undefined, // Let browser decide
        path: '/',
        sameSite: 'lax',
        secure: false, // Must be false for localhost HTTP
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (e) {
            // Server Component - cookies can't be set
            // This is expected in Server Components
          }
        },
      },
    }
  )
}
