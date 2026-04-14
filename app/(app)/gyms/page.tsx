'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { MapPin, Plus, Search, Navigation, Users, ExternalLink, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'

// Dynamic import für Google Maps (kein SSR)
const GymMap = dynamic(() => import('@/components/gyms/GymMap').then(mod => mod.GymMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-[2.25rem] bg-bjj-surface">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-bjj-gold border-t-transparent" />
        <p className="mt-4 text-sm text-bjj-muted">Karte wird geladen...</p>
      </div>
    </div>
  )
})

type Gym = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  website: string | null
  phone: string | null
  email: string | null
  description: string | null
  member_count: number
  created_at: string
}

export default function GymsPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  
  const [gyms, setGyms] = useState<Gym[]>([])
  const [filteredGyms, setFilteredGyms] = useState<Gym[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null)
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'nearby'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    country: '',
    address: '',
    website: '',
    description: '',
    phone: '',
    email: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Load gyms data
  const loadGyms = useCallback(async () => {
    const user = await waitForAuthenticatedUser(supabase)
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error loading gyms:', error)
      setGyms([])
      setFilteredGyms([])
    } else {
      setGyms(data || [])
      setFilteredGyms(data || [])
    }
    setIsLoading(false)
  }, [router, supabase])

  useEffect(() => {
    void loadGyms()
  }, [loadGyms])

  // Filter gyms based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredGyms(gyms)
      return
    }
    
    const query = searchQuery.toLowerCase()
    const filtered = gyms.filter(gym => 
      gym.name.toLowerCase().includes(query) ||
      gym.city?.toLowerCase().includes(query) ||
      gym.country?.toLowerCase().includes(query) ||
      gym.address?.toLowerCase().includes(query)
    )
    setFilteredGyms(filtered)
  }, [searchQuery, gyms])

  // Get user location
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
          setActiveTab('nearby')
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [])

  // Calculate distance between two points
  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Sort gyms by distance if nearby tab is active
  const displayGyms = activeTab === 'nearby' && userLocation
    ? [...filteredGyms].sort((a, b) => {
        if (!a.latitude || !a.longitude) return 1
        if (!b.latitude || !b.longitude) return -1
        const distA = getDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
        const distB = getDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
        return distA - distB
      })
    : filteredGyms

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError('')

    if (!formData.name.trim()) {
      setFormError('Bitte gib einen Namen ein')
      setIsSubmitting(false)
      return
    }

    try {
      let latitude = null
      let longitude = null
      
      const locationQuery = [formData.address, formData.city, formData.country]
        .filter(Boolean)
        .join(', ')
        .trim()

      if (locationQuery) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (apiKey) {
          try {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationQuery)}&key=${apiKey}`
            )
            const data = await response.json()
            if (data.results && data.results.length > 0) {
              const location = data.results[0].geometry.location
              latitude = location.lat
              longitude = location.lng
            }
          } catch (geoError) {
            console.error('Geocoding error:', geoError)
          }
        }
      }

      const { data, error } = await supabase
        .from('gyms')
        .insert([{
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          country: formData.country.trim() || null,
          address: formData.address.trim() || null,
          website: formData.website.trim() || null,
          description: formData.description.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          latitude,
          longitude
        }])
        .select()
        .single()

      if (error) throw error

      setFormData({
        name: '',
        city: '',
        country: '',
        address: '',
        website: '',
        description: '',
        phone: '',
        email: ''
      })
      setShowAddModal(false)
      
      const { data: newData } = await supabase
        .from('gyms')
        .select('*')
        .order('name', { ascending: true })
      
      if (newData) {
        setGyms(newData)
        setFilteredGyms(newData)
      }
    } catch (error) {
      console.error('Error adding gym:', error)
      setFormError('Fehler beim Speichern. Bitte versuche es erneut.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="flex h-[calc(100vh-180px)] flex-col gap-4 lg:flex-row">
          <div className="flex-1 animate-pulse rounded-[2.25rem] bg-bjj-surface" />
          <div className="h-[400px] w-full animate-pulse rounded-[2.25rem] bg-bjj-surface lg:h-auto lg:w-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Gyms</h1>
          <p className="mt-1 text-sm text-bjj-muted">Finde und verwalte deine Trainingsstätten</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-bjj-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bjj-orange-light"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Gym hinzufügen</span>
          <span className="sm:hidden">Hinzufügen</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-180px)] flex-col gap-4 lg:flex-row">
        {/* Map Section */}
        <div className="relative min-h-[400px] flex-1 overflow-hidden rounded-[2.25rem] border border-black/20 shadow-card lg:min-h-0">
          <GymMap 
            gyms={filteredGyms} 
            selectedGym={selectedGym}
            onGymSelect={(gym) => setSelectedGym(gym)}
          />
          
          {/* Map overlay controls */}
          <div className="absolute left-4 right-4 top-4 flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-black/20 bg-[linear-gradient(180deg,rgba(22,29,41,0.98),rgba(16,21,31,0.98))] px-4 py-3 backdrop-blur">
              <Search className="h-4 w-4 text-bjj-muted" />
              <input
                type="text"
                placeholder="Suche nach Gym, Stadt oder Land..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-bjj-muted/50"
              />
            </div>
            <button
              onClick={getUserLocation}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'nearby'
                  ? 'border-bjj-gold/30 bg-bjj-gold/10 text-bjj-gold'
                  : 'border-black/20 bg-[linear-gradient(180deg,rgba(22,29,41,0.98),rgba(16,21,31,0.98))] text-white hover:border-bjj-gold/20'
              }`}
            >
              <Navigation className="h-4 w-4" />
              <span className="hidden sm:inline">In der Nähe</span>
            </button>
          </div>

          {/* Stats overlay */}
          <div className="absolute bottom-4 left-4 rounded-2xl border border-black/20 bg-[linear-gradient(180deg,rgba(22,29,41,0.98),rgba(16,21,31,0.98))] px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-black text-bjj-gold">{gyms.length}</p>
                <p className="text-xs text-bjj-muted">Gyms insgesamt</p>
              </div>
              <div className="h-8 w-px bg-bjj-border" />
              <div className="text-center">
                <p className="text-lg font-black text-white">{filteredGyms.length}</p>
                <p className="text-xs text-bjj-muted">Gefunden</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gyms List Section */}
        <div className="flex h-[400px] flex-col overflow-hidden rounded-[2.25rem] border border-black/20 bg-[linear-gradient(180deg,rgba(24,31,45,0.96)_0%,rgba(17,22,31,0.99)_100%)] shadow-card lg:h-auto lg:w-96">
          {/* Tabs */}
          <div className="flex border-b border-black/20">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 px-4 py-4 text-sm font-semibold transition ${
                activeTab === 'all'
                  ? 'border-b-2 border-bjj-gold text-bjj-gold'
                  : 'text-bjj-muted hover:text-white'
              }`}
            >
              Alle Gyms
            </button>
            <button
              onClick={() => setActiveTab('nearby')}
              className={`flex-1 px-4 py-4 text-sm font-semibold transition ${
                activeTab === 'nearby'
                  ? 'border-b-2 border-bjj-gold text-bjj-gold'
                  : 'text-bjj-muted hover:text-white'
              }`}
            >
              In der Nähe
            </button>
          </div>

          {/* Gyms List */}
          <div className="flex-1 overflow-y-auto p-4">
            {displayGyms.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-bjj-gold/20 bg-bjj-gold/10">
                  <MapPin className="h-8 w-8 text-bjj-gold/60" />
                </div>
                <p className="mt-4 text-white">Keine Gyms gefunden</p>
                <p className="mt-2 text-sm text-bjj-muted">
                  {searchQuery ? 'Versuche eine andere Suche' : 'Füge das erste Gym hinzu, um zu beginnen'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl border border-bjj-gold/30 bg-bjj-gold/10 px-5 py-3 text-sm font-semibold text-bjj-gold transition hover:bg-bjj-gold/20"
                  >
                    <Plus className="h-4 w-4" />
                    Gym hinzufügen
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayGyms.map((gym) => (
                  <button
                    key={gym.id}
                    onClick={() => setSelectedGym(gym)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      selectedGym?.id === gym.id
                        ? 'border-bjj-gold/40 bg-bjj-gold/10'
                        : 'border-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.18)_100%)] hover:border-bjj-gold/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-bjj-gold/20 bg-bjj-gold/10">
                        <MapPin className="h-5 w-5 text-bjj-gold" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-white">{gym.name}</h3>
                        <p className="mt-1 truncate text-xs text-bjj-muted">
                          {[gym.city, gym.country].filter(Boolean).join(', ') || 'Standort nicht angegeben'}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 text-xs text-bjj-muted">
                            <Users className="h-3 w-3" />
                            {gym.member_count || 0} Mitglieder
                          </span>
                          {gym.website && (
                            <a
                              href={gym.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-bjj-gold hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Website
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Gym Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06070c]/78 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Neues Gym</p>
                <h2 className="mt-2 text-2xl font-black text-white">Gym hinzufügen</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {formError}
                </div>
              )}
              
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Name des Gyms *</label>
                <input
                  type="text"
                  placeholder="z.B. Gracie Barra Berlin"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-bjj-border bg-[#151d2a] px-4 py-3 text-sm text-white outline-none placeholder:text-bjj-muted"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Stadt</label>
                  <input
                    type="text"
                    placeholder="Berlin"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-xl border border-bjj-border bg-[#151d2a] px-4 py-3 text-sm text-white outline-none placeholder:text-bjj-muted"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Land</label>
                  <input
                    type="text"
                    placeholder="Deutschland"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full rounded-xl border border-bjj-border bg-[#151d2a] px-4 py-3 text-sm text-white outline-none placeholder:text-bjj-muted"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Adresse</label>
                <textarea
                  placeholder="Vollständige Adresse..."
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-xl border border-bjj-border bg-[#151d2a] px-4 py-3 text-sm text-white outline-none placeholder:text-bjj-muted resize-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Website</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full rounded-xl border border-bjj-border bg-[#151d2a] px-4 py-3 text-sm text-white outline-none placeholder:text-bjj-muted"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-black/20 bg-black/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-bjj-gold/20 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-bjj-gold px-4 py-3 text-sm font-black text-bjj-coal transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Speichern...' : 'Gym speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
