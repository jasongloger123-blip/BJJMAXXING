import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

// Get the project reference from the Supabase URL
const getProjectRef = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  const match = url.match(/https:\/\/([^.]+)/)
  return match?.[1] ?? null
}

// Dummy client für SSR (server-side rendering)
const createDummyClient = (): SupabaseClient<any, 'public'> => {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ data: null, error: null }),
    }),
  } as any
}

export function createClient() {
  // Server-side: return dummy client
  if (typeof window === 'undefined') {
    return createDummyClient()
  }

  if (browserClient) {
    return browserClient
  }

  const projectRef = getProjectRef()
  // Match the cookie name format used by @supabase/ssr
  // Format: sb-{projectRef}-auth-token
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      cookieOptions: {
        name: cookieName,
        domain: undefined,
        path: '/',
        sameSite: 'lax',
        secure: typeof window !== 'undefined' && window.location.protocol === 'https:', // true for HTTPS, false for HTTP
        maxAge: 60 * 60 * 24 * 7,
      },
    }
  )

  return browserClient
}