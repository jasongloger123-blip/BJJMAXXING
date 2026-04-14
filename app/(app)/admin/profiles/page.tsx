'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, MapPin, Sparkles, Shield, Globe2, Link2, Youtube, Instagram, Music2, Facebook, Mail, ArrowRight, ExternalLink } from 'lucide-react'
import { ARCHETYPES } from '@/lib/archetypes'
import { getFlagSvgUrl, getCountryLabel } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'

// Types
type ProfileWithStats = {
  id: string
  username: string | null
  full_name: string | null
  email: string | null
  avatar_url: string | null
  belt: string | null
  primary_archetype: string | null
  nationality: string | null
  gym_name: string | null
  gym_unlisted_name: string | null
  gym_location: string | null
  social_link: string | null
  youtube_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  facebook_url: string | null
  created_at: string
  last_sign_in_at: string | null
  // Stats
  completed_nodes: number
  validated_nodes: number
  total_progress: number
  training_events: number
}

// Belt colors mapping
const BELT_COLORS: Record<string, { bg: string; text: string }> = {
  'white': { bg: 'bg-white/10', text: 'text-white' },
  'blue': { bg: 'bg-blue-500/20', text: 'text-blue-300' },
  'purple': { bg: 'bg-purple-500/20', text: 'text-purple-300' },
  'brown': { bg: 'bg-amber-700/20', text: 'text-amber-500' },
  'black': { bg: 'bg-gray-800', text: 'text-gray-300' },
  'coral': { bg: 'bg-red-500/20', text: 'text-red-300' },
}

// Belt display names
const BELT_NAMES: Record<string, string> = {
  'white': 'White Belt',
  'blue': 'Blue Belt',
  'purple': 'Purple Belt',
  'brown': 'Brown Belt',
  'black': 'Black Belt',
  'coral': 'Coral Belt',
}

export default function AdminProfilesDashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  
  const [profiles, setProfiles] = useState<ProfileWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterArchetype, setFilterArchetype] = useState<string>('all')
  const [filterBelt, setFilterBelt] = useState<string>('all')
  const [filterGym, setFilterGym] = useState<string>('all')
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)

  // Load all profiles
  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/admin/profiles', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
            }
          : {},
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Fehler beim Laden der Profile')
      }

      setProfiles((payload?.profiles ?? []) as ProfileWithStats[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Profile')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  // Get unique gyms for filter
  const uniqueGyms = useCallback(() => {
    const gyms = new Set<string>()
    profiles.forEach((p) => {
      const gym = p.gym_name || p.gym_unlisted_name
      if (gym) gyms.add(gym)
    })
    return Array.from(gyms).sort()
  }, [profiles])

  // Filter profiles
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch = 
      (p.username?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
      (p.full_name?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
      (p.email?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
      (p.gym_name?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
    
    const matchesArchetype = filterArchetype === 'all' || p.primary_archetype === filterArchetype
    const matchesBelt = filterBelt === 'all' || p.belt === filterBelt
    const matchesGym = filterGym === 'all' || (p.gym_name === filterGym || p.gym_unlisted_name === filterGym)

    return matchesSearch && matchesArchetype && matchesBelt && matchesGym
  })

  // Get archetype name
  const getArchetypeName = (id: string | null) => {
    if (!id) return 'Kein Archetyp'
    const archetype = ARCHETYPES.find((a) => a.id === id)
    return archetype?.name || id.replace(/-/g, ' ')
  }

  // Get belt display
  const getBeltDisplay = (belt: string | null) => {
    const beltKey = belt?.toLowerCase() || 'white'
    const colors = BELT_COLORS[beltKey] || BELT_COLORS.white
    const name = BELT_NAMES[beltKey] || BELT_NAMES.white
    return { colors, name }
  }

  // Get gym display
  const getGymDisplay = (p: ProfileWithStats) => {
    return p.gym_name || p.gym_unlisted_name || 'Kein Gym'
  }

  // Check if has social links
  const hasSocialLinks = (p: ProfileWithStats) => {
    return !!(p.social_link || p.youtube_url || p.instagram_url || p.tiktok_url || p.facebook_url)
  }

  // Get social links count
  const getSocialLinksCount = (p: ProfileWithStats) => {
    let count = 0
    if (p.social_link) count++
    if (p.youtube_url) count++
    if (p.instagram_url) count++
    if (p.tiktok_url) count++
    if (p.facebook_url) count++
    return count
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Nutzer Dashboard</h1>
          <p className="text-sm text-bjj-muted">
            {profiles.length} registrierte Nutzer • {filteredProfiles.length} angezeigt
          </p>
        </div>
        <button
          onClick={loadProfiles}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-bjj-gold px-4 py-2 text-sm font-bold text-bjj-coal transition hover:bg-bjj-gold/80 disabled:opacity-50"
        >
          Aktualisieren
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
          <div className="flex items-center gap-2 text-bjj-gold">
            <Users className="h-5 w-5" />
            <span className="text-xs font-bold uppercase">Gesamt</span>
          </div>
          <p className="mt-2 text-2xl font-black text-white">{profiles.length}</p>
        </div>
        <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
          <div className="flex items-center gap-2 text-bjj-gold">
            <MapPin className="h-5 w-5" />
            <span className="text-xs font-bold uppercase">Verschiedene Gyms</span>
          </div>
          <p className="mt-2 text-2xl font-black text-white">{uniqueGyms().length}</p>
        </div>
        <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
          <div className="flex items-center gap-2 text-bjj-gold">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase">Mit Archetyp</span>
          </div>
          <p className="mt-2 text-2xl font-black text-white">
            {profiles.filter((p) => p.primary_archetype).length}
          </p>
        </div>
        <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
          <div className="flex items-center gap-2 text-bjj-gold">
            <Link2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase">Social Links</span>
          </div>
          <p className="mt-2 text-2xl font-black text-white">
            {profiles.filter((p) => hasSocialLinks(p)).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-bjj-border bg-bjj-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-xs font-bold uppercase text-bjj-muted">Suche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bjj-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, Email oder Gym..."
                className="w-full rounded-xl border border-bjj-border bg-bjj-bg pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-bjj-gold"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="mb-2 block text-xs font-bold uppercase text-bjj-muted">Archetyp</label>
            <select
              value={filterArchetype}
              onChange={(e) => setFilterArchetype(e.target.value)}
              className="w-full rounded-xl border border-bjj-border bg-bjj-bg px-3 py-2 text-sm text-white outline-none focus:border-bjj-gold"
            >
              <option value="all">Alle</option>
              {ARCHETYPES.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="mb-2 block text-xs font-bold uppercase text-bjj-muted">Gürtel</label>
            <select
              value={filterBelt}
              onChange={(e) => setFilterBelt(e.target.value)}
              className="w-full rounded-xl border border-bjj-border bg-bjj-bg px-3 py-2 text-sm text-white outline-none focus:border-bjj-gold"
            >
              <option value="all">Alle</option>
              <option value="white">White</option>
              <option value="blue">Blue</option>
              <option value="purple">Purple</option>
              <option value="brown">Brown</option>
              <option value="black">Black</option>
            </select>
          </div>
          <div className="w-48">
            <label className="mb-2 block text-xs font-bold uppercase text-bjj-muted">Gym</label>
            <select
              value={filterGym}
              onChange={(e) => setFilterGym(e.target.value)}
              className="w-full rounded-xl border border-bjj-border bg-bjj-bg px-3 py-2 text-sm text-white outline-none focus:border-bjj-gold"
            >
              <option value="all">Alle</option>
              {uniqueGyms().map((gym) => (
                <option key={gym} value={gym}>{gym}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Profiles Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-2xl border border-bjj-border bg-bjj-card shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProfiles.map((profile) => {
            const beltDisplay = getBeltDisplay(profile.belt)
            const flagUrl = getFlagSvgUrl(profile.nationality)
            const isExpanded = expandedProfile === profile.id
            
            return (
              <div
                key={profile.id}
                className={`rounded-2xl border border-bjj-border bg-bjj-card p-4 transition hover:border-bjj-gold/30 ${isExpanded ? 'col-span-full sm:col-span-2 lg:col-span-3' : ''}`}
              >
                {/* Card Header */}
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username || 'Avatar'}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bjj-surface text-xl font-bold text-white">
                        {(profile.username?.[0] || profile.full_name?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                    {flagUrl && (
                      <img
                        src={flagUrl}
                        alt={profile.nationality || 'Flag'}
                        className="absolute -bottom-1 -right-1 h-5 w-7 rounded-[4px] object-cover border-2 border-bjj-card"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-bold text-white">
                        {profile.username || profile.full_name || 'Unbekannt'}
                      </h3>
                      {hasSocialLinks(profile) && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bjj-gold/20 text-[10px] text-bjj-gold">
                          {getSocialLinksCount(profile)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-bjj-muted truncate">{profile.email}</p>
                    
                    {/* Badges */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${beltDisplay.colors.bg} ${beltDisplay.colors.text}`}>
                        <Shield className="h-3 w-3" />
                        {beltDisplay.name}
                      </span>
                      {profile.primary_archetype && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-bjj-gold/10 px-2 py-1 text-[10px] font-bold uppercase text-bjj-gold">
                          <Sparkles className="h-3 w-3" />
                          {getArchetypeName(profile.primary_archetype)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand Button */}
                  <button
                    onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                    className="shrink-0 rounded-xl bg-bjj-surface p-2 text-bjj-muted transition hover:text-white"
                  >
                    <ArrowRight className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-bjj-border pt-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{profile.completed_nodes}</p>
                    <p className="text-[10px] uppercase text-bjj-muted">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-bjj-gold">{profile.validated_nodes}</p>
                    <p className="text-[10px] uppercase text-bjj-muted">Validated</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{profile.training_events}</p>
                    <p className="text-[10px] uppercase text-bjj-muted">Trainings</p>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 border-t border-bjj-border pt-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Gym Info */}
                      <div className="rounded-xl bg-bjj-surface/50 p-3">
                        <div className="flex items-center gap-2 text-bjj-muted">
                          <MapPin className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase">Gym</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {getGymDisplay(profile)}
                        </p>
                        {profile.gym_location && (
                          <p className="text-xs text-bjj-muted">{profile.gym_location}</p>
                        )}
                      </div>

                      {/* Nationality */}
                      {profile.nationality && (
                        <div className="rounded-xl bg-bjj-surface/50 p-3">
                          <div className="flex items-center gap-2 text-bjj-muted">
                            <Globe2 className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase">Nationalität</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            {flagUrl && (
                              <img src={flagUrl} alt={profile.nationality} className="h-4 w-6 rounded-[2px] object-cover" />
                            )}
                            <p className="text-sm font-semibold text-white">
                              {getCountryLabel(profile.nationality)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Account Info */}
                      <div className="rounded-xl bg-bjj-surface/50 p-3">
                        <div className="flex items-center gap-2 text-bjj-muted">
                          <Mail className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase">Account</span>
                        </div>
                        <p className="mt-1 text-xs text-bjj-muted">
                          Registriert: {new Date(profile.created_at).toLocaleDateString('de-DE')}
                        </p>
                        {profile.last_sign_in_at && (
                          <p className="text-xs text-bjj-muted">
                            Letzter Login: {new Date(profile.last_sign_in_at).toLocaleDateString('de-DE')}
                          </p>
                        )}
                      </div>

                      {/* Social Links */}
                      {hasSocialLinks(profile) && (
                        <div className="rounded-xl bg-bjj-surface/50 p-3 sm:col-span-2 lg:col-span-3">
                          <div className="flex items-center gap-2 text-bjj-muted">
                            <Link2 className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase">Social Links</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {profile.social_link && (
                              <a
                                href={profile.social_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-bjj-surface px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-bjj-gold hover:text-bjj-coal"
                              >
                                <Globe2 className="h-3 w-3" />
                                Website
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {profile.youtube_url && (
                              <a
                                href={profile.youtube_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500 hover:text-white"
                              >
                                <Youtube className="h-3 w-3" />
                                YouTube
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {profile.instagram_url && (
                              <a
                                href={profile.instagram_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-400 transition hover:bg-pink-500 hover:text-white"
                              >
                                <Instagram className="h-3 w-3" />
                                Instagram
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {profile.tiktok_url && (
                              <a
                                href={profile.tiktok_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500 hover:text-white"
                              >
                                <Music2 className="h-3 w-3" />
                                TikTok
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {profile.facebook_url && (
                              <a
                                href={profile.facebook_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500 hover:text-white"
                              >
                                <Facebook className="h-3 w-3" />
                                Facebook
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => router.push(`/admin/user-queue?user=${profile.id}`)}
                        className="flex items-center gap-2 rounded-xl bg-bjj-surface px-4 py-2 text-sm font-semibold text-white transition hover:bg-bjj-gold hover:text-bjj-coal"
                      >
                        Queue Ansehen
                      </button>
                      <button
                        onClick={() => router.push(`/gameplan?user=${profile.id}`)}
                        className="flex items-center gap-2 rounded-xl bg-bjj-surface px-4 py-2 text-sm font-semibold text-white transition hover:bg-bjj-gold hover:text-bjj-coal"
                      >
                        Gameplan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {filteredProfiles.length === 0 && !loading && (
        <div className="rounded-2xl border border-bjj-border bg-bjj-card p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-bjj-muted" />
          <p className="mt-4 text-lg font-semibold text-white">Keine Nutzer gefunden</p>
          <p className="text-sm text-bjj-muted">Passe deine Filter an oder warte auf neue Registrierungen.</p>
        </div>
      )}
    </div>
  )
}
