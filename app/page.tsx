'use client'

import { useEffect, useState } from 'react'
import AppLayout from './(app)/layout'
import StartHome from '@/components/StartHome'
import PublicLanding from '@/components/PublicLanding'
import { createClient } from '@/lib/supabase/client'

const AUTH_CHECK_TIMEOUT = 5000 // 5 seconds timeout

export default function HomePage() {
  const [checked, setChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    // Create client only in browser
    const supabase = createClient()
    let active = true

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!active) return
      console.log('Auth check timed out, showing public landing')
      setTimedOut(true)
      setChecked(true)
      setAuthenticated(false)
    }, AUTH_CHECK_TIMEOUT)

    async function checkSession() {
      try {
        console.log('Checking auth session...')
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!active) return

        console.log('Auth check result:', user ? 'Authenticated' : 'Not authenticated')
        clearTimeout(timeoutId)
        setAuthenticated(Boolean(user))
        setChecked(true)
      } catch (error) {
        console.error('Auth check error:', error)
        if (!active) return
        clearTimeout(timeoutId)
        setAuthenticated(false)
        setChecked(true)
      }
    }

    void checkSession()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      console.log('Auth state changed:', session ? 'Authenticated' : 'Not authenticated')
      clearTimeout(timeoutId)
      setAuthenticated(Boolean(session?.user))
      setChecked(true)
    })

    return () => {
      active = false
      clearTimeout(timeoutId)
      data.subscription.unsubscribe()
    }
  }, [])

  // Show loading spinner while checking auth
  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1419]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-bjj-gold/30 border-t-bjj-gold" />
          <p className="text-sm text-white/60">Lade...</p>
        </div>
      </div>
    )
  }

  if (authenticated) {
    return (
      <AppLayout>
        <StartHome />
      </AppLayout>
    )
  }

  return <PublicLanding />
}
