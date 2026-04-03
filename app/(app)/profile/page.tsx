'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Facebook, Globe2, ImagePlus, Instagram, Music2, PlayCircle, Shield, Sparkles, X, Youtube } from 'lucide-react'
import { ARCHETYPES } from '@/lib/archetypes'
import { getPlanLevel } from '@/lib/nodes'
import { COUNTRY_OPTIONS, getCountryLabel, getFlagSvgUrl } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'

type ProfileData = {
  email: string | null
  username: string | null
  full_name: string | null
  avatar_url: string | null
  belt: string | null
  primary_archetype: string | null
  nationality: string | null
  gym_name: string | null
  gym_unlisted_name: string | null
  gym_location: string | null
}

type LinkedIdentity = {
  provider: string
  identity_id?: string
}

type ConnectProvider = {
  id: 'youtube' | 'facebook' | 'instagram' | 'tiktok'
  label: string
  provider?: 'google' | 'facebook'
  supported: boolean
  description: string
  accent: string
  Icon: typeof Youtube
  shortLabel: string
}

const CONNECT_PROVIDERS: ConnectProvider[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    provider: 'google',
    supported: true,
    description: 'Verbinde Google, um spaeter dein YouTube-Profilbild zu nutzen.',
    accent: 'text-[#ff6b5c]',
    Icon: Youtube,
    shortLabel: 'YT',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    provider: 'facebook',
    supported: true,
    description: 'Verbinde Facebook fuer Profilbild und Social Login.',
    accent: 'text-[#7da4ff]',
    Icon: Facebook,
    shortLabel: 'FB',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    supported: false,
    description: 'Instagram als direktes Auth-Login ist in diesem Setup noch nicht aktiv.',
    accent: 'text-[#ff9ac2]',
    Icon: Instagram,
    shortLabel: 'IG',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    supported: false,
    description: 'TikTok als direktes Auth-Login ist in diesem Setup noch nicht aktiv.',
    accent: 'text-[#9cf3ea]',
    Icon: Music2,
    shortLabel: 'TT',
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [watchedCount, setWatchedCount] = useState(0)
  const [identities, setIdentities] = useState<LinkedIdentity[]>([])
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
  const [connectMessage, setConnectMessage] = useState<string | null>(null)
  const [avatarDraft, setAvatarDraft] = useState('')
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [nationalityDraft, setNationalityDraft] = useState('')
  const [savingNationality, setSavingNationality] = useState(false)

  const loadData = useCallback(async () => {
    const user = await waitForAuthenticatedUser(supabase)

    if (!user) {
      router.push('/login')
      return
    }

    setUserId(user.id)

    const [profileResult, watchedResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('email, username, full_name, avatar_url, belt, primary_archetype, nationality, gym_name, gym_unlisted_name, gym_location')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('training_clip_events').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    let profileData = profileResult.data as (ProfileData & { nationality?: string | null }) | null

    if (profileResult.error) {
      const fallbackProfile = await supabase
        .from('user_profiles')
        .select('email, username, full_name, avatar_url, belt, primary_archetype, gym_name, gym_unlisted_name, gym_location')
        .eq('id', user.id)
        .maybeSingle()

      profileData = fallbackProfile.data ? { ...fallbackProfile.data, nationality: null } : null
    }

    const nationality = profileData?.nationality ?? null

    setProfile({
      email: profileData?.email ?? user.email ?? null,
      username: profileData?.username ?? null,
      full_name: profileData?.full_name ?? null,
      avatar_url: profileData?.avatar_url ?? null,
      belt: profileData?.belt ?? 'White Belt',
      primary_archetype: profileData?.primary_archetype ?? 'long-flexible-guard',
      nationality,
      gym_name: profileData?.gym_name ?? null,
      gym_unlisted_name: profileData?.gym_unlisted_name ?? null,
      gym_location: profileData?.gym_location ?? null,
    })
    setNationalityDraft(nationality ?? '')
    setAvatarDraft(profileData?.avatar_url ?? '')
    setWatchedCount(watchedResult.count ?? 0)
    setIdentities((user.identities as LinkedIdentity[] | undefined) ?? [])
  }, [router, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const archetype = ARCHETYPES.find((entry) => entry.id === profile?.primary_archetype) ?? ARCHETYPES[0]
  const level = getPlanLevel([])
  const displayName = profile?.username ?? profile?.full_name ?? 'BJJ Athlete'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const connectedProviders = useMemo(() => new Set(identities.map((identity) => identity.provider)), [identities])
  const nationalityFlagUrl = getFlagSvgUrl(profile?.nationality)
  const nationalityLabel = getCountryLabel(profile?.nationality)
  const gymDisplayName = profile?.gym_name ?? profile?.gym_unlisted_name ?? null
  const connectedProvidersCount = CONNECT_PROVIDERS.filter((entry) =>
    entry.id === 'youtube' ? connectedProviders.has('google') : connectedProviders.has(entry.id)
  ).length

  async function handleConnectAccount(entry: ConnectProvider) {
    const confirmed = window.confirm(`${entry.label} verbinden?`)
    if (!confirmed) return

    if (!entry.supported || !entry.provider) {
      setConnectMessage(`${entry.label} ist hier aktuell noch nicht direkt aktiv.`)
      return
    }

    setConnectingProvider(entry.id)
    setConnectMessage(null)

    const redirectTo = `${window.location.origin}/auth/callback?next=/profile`
    const { data, error } = await supabase.auth.linkIdentity({
      provider: entry.provider,
      options: { redirectTo },
    })

    if (error) {
      setConnectingProvider(null)
      setConnectMessage(`${entry.label} konnte nicht verbunden werden.`)
      return
    }

    if (data?.url) {
      window.location.assign(data.url)
      return
    }

    setConnectingProvider(null)
    setConnectMessage(`${entry.label} Verbindung wurde gestartet.`)
  }

  async function saveAvatarUrl() {
    if (!profile || !userId) return
    setSavingAvatar(true)
    setConnectMessage(null)

    const normalizedValue = avatarDraft.trim() || null
    const { error } = await supabase.from('user_profiles').update({ avatar_url: normalizedValue }).eq('id', userId)

    setSavingAvatar(false)
    if (error) {
      setConnectMessage(`Profilbild konnte nicht gespeichert werden: ${error.message}`)
      return
    }

    setProfile((current) => (current ? { ...current, avatar_url: normalizedValue } : current))
    setAvatarModalOpen(false)
    window.dispatchEvent(new Event('profile-ready-changed'))
    setConnectMessage('Profilbild gespeichert.')
  }

  async function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setConnectMessage(null)

    const { data: auth } = await supabase.auth.getUser()
    const activeUserId = auth.user?.id

    if (!activeUserId) {
      setUploadingAvatar(false)
      setConnectMessage('Nicht eingeloggt.')
      return
    }

    const fileExt = file.name.split('.').pop() ?? 'jpg'
    const filePath = `${activeUserId}/${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })

    if (uploadError) {
      setUploadingAvatar(false)
      setConnectMessage(`Upload fehlgeschlagen: ${uploadError.message}`)
      return
    }

    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const url = publicUrl.publicUrl

    const { error: updateError } = await supabase.from('user_profiles').update({ avatar_url: url }).eq('id', activeUserId)

    setUploadingAvatar(false)
    if (updateError) {
      setConnectMessage(`Profilbild konnte nicht gespeichert werden: ${updateError.message}`)
      return
    }

    setAvatarDraft(url)
    setProfile((current) => (current ? { ...current, avatar_url: url } : current))
    setAvatarModalOpen(false)
    window.dispatchEvent(new Event('profile-ready-changed'))
    setConnectMessage('Profilbild hochgeladen.')
  }

  async function saveNationality() {
    if (!userId) return

    setSavingNationality(true)
    setConnectMessage(null)

    const normalizedNationality = nationalityDraft || null
    const { error } = await supabase.from('user_profiles').update({ nationality: normalizedNationality }).eq('id', userId)

    setSavingNationality(false)

    if (error) {
      setConnectMessage(`Nationalitaet konnte nicht gespeichert werden: ${error.message}`)
      return
    }

    setProfile((current) => (current ? { ...current, nationality: normalizedNationality } : current))
    window.dispatchEvent(new Event('profile-ready-changed'))
    setConnectMessage('Nationalitaet gespeichert.')
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl">
        <section className="space-y-6">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,31,45,0.92)_0%,rgba(17,22,31,0.98)_100%)] p-6 shadow-card sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-bjj-gold/12 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#6e86b8]/10 blur-3xl" />

            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_26rem] xl:items-start">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="group relative mx-auto shrink-0 rounded-[2rem] lg:mx-0"
                  aria-label="Profilbild bearbeiten"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-28 w-28 rounded-[2rem] object-cover ring-1 ring-white/10 transition duration-300 group-hover:scale-[1.02] group-hover:ring-bjj-gold/45 sm:h-36 sm:w-36"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-[linear-gradient(180deg,#2b3446,#171e2a)] text-3xl font-black text-white ring-1 ring-white/10 transition duration-300 group-hover:scale-[1.02] group-hover:ring-bjj-gold/45 sm:h-36 sm:w-36">
                      {initials}
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-black/0 text-white opacity-0 transition duration-300 group-hover:bg-black/35 group-hover:opacity-100">
                    <Camera className="h-8 w-8" />
                  </span>
                  <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#1d2533] text-bjj-gold shadow-lg shadow-black/30">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                </button>

                <div className="relative flex-1 text-center lg:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">BJJ Profil</p>
                  {nationalityFlagUrl ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold text-white/80">
                      <img src={nationalityFlagUrl} alt={nationalityLabel ?? 'Flagge'} className="h-4 w-6 rounded-[4px] object-cover" />
                      <span>{nationalityLabel}</span>
                    </span>
                  ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-3 lg:justify-start">
                    {nationalityFlagUrl ? (
                      <span
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/20 sm:h-14 sm:w-14"
                        aria-label={nationalityLabel ?? 'Nationalitaet'}
                        title={nationalityLabel ?? 'Nationalitaet'}
                      >
                        <img src={nationalityFlagUrl} alt={nationalityLabel ?? 'Flagge'} className="h-7 w-7 rounded-full object-cover sm:h-8 sm:w-8" />
                      </span>
                    ) : null}
                    <h1 className="text-4xl font-black uppercase italic tracking-[-0.04em] text-white sm:text-5xl xl:text-6xl">
                      {displayName}
                    </h1>
                  </div>
                  <p className="mt-2 text-sm font-medium tracking-[0.04em] text-bjj-muted">
                    {profile?.email ?? 'Keine E-Mail gefunden'}
                  </p>
                  <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left">
                    <Globe2 className="h-4 w-4 shrink-0 text-bjj-gold" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Aktuelles Gym</p>
                      <p className="truncate text-sm font-semibold text-white/85">
                        {gymDisplayName ?? 'Noch kein Gym hinterlegt'}
                      </p>
                      {profile?.gym_location ? (
                        <p className="truncate text-xs text-bjj-muted">{profile.gym_location}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <span className="inline-flex items-center gap-2 rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-bjj-gold">
                      <Shield className="h-4 w-4" />
                      {profile?.belt ?? 'White Belt'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                      <Sparkles className="h-4 w-4 text-bjj-gold" />
                      {archetype.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-[1.5rem] border border-white/8 bg-black/15 px-5 py-5 backdrop-blur-sm transition hover:border-bjj-gold/20 hover:bg-black/25">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Videos angeschaut</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-4xl font-black text-white">{watchedCount}</span>
                    <PlayCircle className="mb-1 h-5 w-5 text-bjj-gold/50" />
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/8 bg-black/15 px-5 py-5 backdrop-blur-sm transition hover:border-bjj-gold/20 hover:bg-black/25">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Aktuelles Level</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-4xl font-black text-white">{level}</span>
                    <span className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-bjj-gold">Lvl Up</span>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/8 bg-black/15 px-5 py-5 backdrop-blur-sm transition hover:border-bjj-gold/20 hover:bg-black/25">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Verbunden</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-4xl font-black text-white">{connectedProvidersCount}</span>
                    <span className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Accounts</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-8 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(0,0,0,0.14)_100%)] p-6">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">
                  <Globe2 className="h-4 w-4" />
                  Nationalitaet
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-white">Flagge und Herkunft sichtbar machen</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-bjj-muted">
                  Waehle dein Heimatland aus. Deine Nationalflagge erscheint danach direkt im Profil und gibt dem Bereich mehr Charakter.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={nationalityDraft}
                    onChange={(event) => setNationalityDraft(event.target.value)}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#111827] px-4 py-4 text-sm font-semibold text-white outline-none transition focus:border-bjj-gold/40"
                  >
                    <option value="">Land auswaehlen</option>
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void saveNationality()}
                    disabled={savingNationality}
                    className="rounded-2xl bg-[linear-gradient(135deg,#b86d45,#7c452d)] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingNationality ? 'Speichert...' : 'Aenderungen speichern'}
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(0,0,0,0.14)_100%)] p-6">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">Social Media</p>
                <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-white">Verbindungen verwalten</h2>
                <p className="mt-3 text-sm leading-relaxed text-bjj-muted">
                  Verbinde deine Accounts fuer Avatar, Login und spaetere Social Features. Wir fragen erst beim Klick nach einer Freigabe.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {CONNECT_PROVIDERS.map((entry) => {
                    const isConnected =
                      (entry.id === 'youtube' && connectedProviders.has('google')) ||
                      (entry.id !== 'youtube' && connectedProviders.has(entry.id))
                    const Icon = entry.Icon

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => void handleConnectAccount(entry)}
                        disabled={connectingProvider === entry.id}
                        className={`group flex aspect-square flex-col items-center justify-center rounded-[1.5rem] border p-4 text-center transition ${
                          isConnected
                            ? 'border-bjj-gold/30 bg-bjj-gold/10'
                            : 'border-white/8 bg-[#111827]/80 hover:-translate-y-0.5 hover:border-bjj-gold/30 hover:bg-[#151d2a]'
                        } ${connectingProvider === entry.id ? 'cursor-not-allowed opacity-70' : ''}`}
                        aria-label={entry.label}
                        title={entry.label}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Icon className={`h-6 w-6 transition duration-200 group-hover:scale-110 ${entry.accent}`} />
                          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">{entry.label}</span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                            {isConnected ? 'Verbunden' : entry.shortLabel}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {connectMessage && (
            <div className="rounded-2xl border border-bjj-border bg-black/10 px-4 py-3 text-sm text-bjj-muted">
              {connectMessage}
            </div>
          )}
        </section>
      </div>

      {avatarModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06070c]/78 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Profilbild</p>
                <h2 className="mt-2 text-3xl font-black text-white">Profilbild aktualisieren</h2>
                <p className="mt-3 text-sm text-bjj-muted">
                  Lade ein Bild hoch oder fuege einen direkten Bild-Link hinzu. Es erscheint danach in Profil, Sidebar und Kommentaren.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-white/70 transition hover:text-white"
                aria-label="Schliessen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-4">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2b3446,#171e2a)] text-2xl font-black text-white">
                  {initials}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-white">{displayName}</p>
                <p className="text-sm text-bjj-muted">Empfohlen: quadratisch, mindestens 400x400</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/85">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleAvatarFileChange(event)}
                  className="hidden"
                />
                {uploadingAvatar ? 'Laedt...' : 'Bild hochladen'}
              </label>
              <span className="text-xs text-bjj-muted">Direktklick aufs Profilbild oeffnet diesen Dialog.</span>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={avatarDraft}
                onChange={(event) => setAvatarDraft(event.target.value)}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-xl border border-bjj-border bg-[#151d2a] px-4 py-3 text-sm text-white outline-none placeholder:text-bjj-muted"
              />
              <button
                type="button"
                onClick={() => void saveAvatarUrl()}
                disabled={savingAvatar}
                className="rounded-xl bg-bjj-gold px-5 py-3 text-sm font-black text-bjj-coal disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAvatar ? 'Speichert...' : 'Profilbild speichern'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
