import type { SupabaseClient, User } from '@supabase/supabase-js'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function waitForAuthenticatedUser(
  supabase: SupabaseClient,
  attempts = 5,
  waitMs = 250
): Promise<User | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      return session.user
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      return user
    }

    if (attempt < attempts - 1) {
      await delay(waitMs)
    }
  }

  return null
}
