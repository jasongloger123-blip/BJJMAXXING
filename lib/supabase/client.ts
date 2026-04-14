import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    // Server-side - return null or throw error
    throw new Error('createClient() should only be called in browser environment')
  }

  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Persist session across page reloads
        persistSession: true,
        // Detect session from URL (for OAuth redirects)
        detectSessionInUrl: true,
        // Auto refresh token
        autoRefreshToken: true,
        // Debug mode for development
        debug: process.env.NODE_ENV === 'development',
      },
    }
  )

  return browserClient
}
