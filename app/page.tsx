'use client'

import { useEffect, useState } from 'react'
import AppLayout from './(app)/layout'
import StartHome from '@/components/StartHome'
import PublicLanding from '@/components/PublicLanding'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const supabase = createClient()
  const [checked, setChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let active = true

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      setAuthenticated(Boolean(user))
      setChecked(true)
    }

    void checkSession()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setAuthenticated(Boolean(session?.user))
      setChecked(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  if (!checked) {
    return <div className="min-h-screen bg-[#0f1419]" />
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
