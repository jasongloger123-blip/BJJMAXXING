'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Search, Check } from 'lucide-react'

type GymSuggestion = {
  placeId: string
  name: string
  secondaryText: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [gymName, setGymName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [suggestions, setSuggestions] = useState<GymSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedGym, setSelectedGym] = useState<GymSuggestion | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Prüfe ob User bereits ein Gym hat
  const checkExistingGym = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('gym_name, gym_place_id')
      .eq('id', user.id)
      .maybeSingle()

    // Wenn bereits Gym vorhanden, direkt zur Startseite
    if (profile?.gym_name || profile?.gym_place_id) {
      router.push('/')
      return
    }

    setChecking(false)
  }, [router, supabase])

  useEffect(() => {
    void checkExistingGym()
  }, [checkExistingGym])

  // Suche nach Gyms
  useEffect(() => {
    if (!gymName.trim() || gymName.length < 2 || selectedGym?.name === gymName) {
      setSuggestions([])
      return
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await fetch(`/api/gyms/search?query=${encodeURIComponent(gymName)}`)
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.places || [])
          setShowSuggestions(true)
        }
      } catch {
        setSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [gymName, selectedGym])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!gymName.trim()) return

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Speichere Gym im Profil
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      gym_name: selectedGym?.name || gymName.trim(),
      gym_place_id: selectedGym?.placeId || null,
      gym_source: selectedGym ? 'google' : 'manual',
    })

    if (error) {
      setLoading(false)
      return
    }

    window.dispatchEvent(new Event('profile-ready-changed'))
    router.push('/')
  }

  function selectGym(suggestion: GymSuggestion) {
    setSelectedGym(suggestion)
    setGymName(suggestion.name)
    setShowSuggestions(false)
    setSuggestions([])
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bjj-bg">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-bjj-border border-t-bjj-gold" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bjj-bg text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-10">
        <section className="w-full rounded-[2.8rem] border border-bjj-border bg-bjj-card px-6 py-10 shadow-card md:px-10">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-bjj-orange to-bjj-gold">
              <MapPin className="h-8 w-8 text-white" />
            </div>
          </div>

          <p className="text-center text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">
            Dein Training
          </p>
          <h1 className="mt-4 text-center text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Trage dein Gym ein
          </h1>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-7 text-bjj-muted">
            Wo trainierst du? Dies hilft uns, deinen Gameplan zu personalisieren.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="relative">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-bjj-muted">
                Gym Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={gymName}
                  onChange={(e) => {
                    setGymName(e.target.value)
                    if (selectedGym && selectedGym.name !== e.target.value) {
                      setSelectedGym(null)
                    }
                  }}
                  required
                  placeholder="z.B. Checkmat Berlin"
                  className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-4 py-4 pr-12 text-lg text-white outline-none transition-all placeholder:text-white/40 focus:border-bjj-gold"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {searchLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-bjj-border border-t-bjj-gold" />
                  ) : selectedGym ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Search className="h-5 w-5 text-bjj-muted" />
                  )}
                </div>
              </div>

              {/* Vorschläge */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-2 w-full rounded-2xl border border-bjj-border bg-bjj-surface py-2 shadow-lg">
                  {suggestions.slice(0, 5).map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      type="button"
                      onClick={() => selectGym(suggestion)}
                      className="w-full px-4 py-3 text-left transition hover:bg-bjj-gold/10"
                    >
                      <p className="font-semibold text-white">{suggestion.name}</p>
                      <p className="text-xs text-bjj-muted">{suggestion.secondaryText}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedGym && (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-400">Gefunden: {selectedGym.name}</span>
                </div>
                <p className="mt-1 text-xs text-bjj-muted">{selectedGym.secondaryText}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !gymName.trim()}
              className="w-full rounded-2xl bg-bjj-gold py-4 text-lg font-black uppercase tracking-[0.12em] text-bjj-coal transition hover:bg-bjj-orange-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Speichert...' : 'Weiter zur App'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
