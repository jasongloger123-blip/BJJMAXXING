import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

export function createClient() {
  const cookieStore = cookies()

  const projectRef = getProjectRef()
  // Match the cookie name format used by @supabase/ssr
  // Format: sb-{projectRef}-auth-token
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'

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
        name: cookieName,
        domain: undefined, // Let browser decide
        path: '/',
        sameSite: 'lax',
        secure: false, // Must be false for localhost/cross-browser compatibility
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
