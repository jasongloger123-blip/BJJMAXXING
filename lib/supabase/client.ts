import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (browserClient) {
    return browserClient
  }

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
        name: 'sb-auth-token',
        domain: undefined,
        path: '/',
        sameSite: 'lax',
        secure: false, // Must be false for localhost
        maxAge: 60 * 60 * 24 * 7,
      },
    }
  )

  return browserClient
}