'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Facebook, Globe2, ImagePlus, Instagram, LogOut, Music2, Pencil, Shield, Sparkles, X, Youtube } from 'lucide-react'
import { ProfileSavedClips } from '@/components/profile/ProfileSavedClips'
import { ARCHETYPES } from '@/lib/archetypes'
import { getCountryLabel, getFlagSvgUrl } from '@/lib/countries'
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
  social_link: string | null
  youtube_url: string | null
  tiktok_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  techniques_learned_count: number
}

type SocialPlatform = 'youtube' | 'instagram' | 'tiktok' | 'facebook'

type SocialLinkDrafts = Record<SocialPlatform, string>

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
    description: 'Verbinde Facebook für Profilbild und Social Login.',
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

const SOCIAL_LINK_FIELDS: Array<{
  key: SocialPlatform
  label: string
  placeholder: string
  Icon: typeof Youtube
  accent: string
}> = [
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@deinkanal',
    Icon: Youtube,
    accent: 'text-[#ff6b5c]',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/deinprofil',
    Icon: Instagram,
    accent: 'text-[#ff9ac2]',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@deinprofil',
    Icon: Music2,
    accent: 'text-[#9cf3ea]',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/deinprofil',
    Icon: Facebook,
    accent: 'text-[#7da4ff]',
  },
]

function normalizeSocialUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function ProfilePage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [identities, setIdentities] = useState<LinkedIdentity[]>([])
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
  const [connectMessage, setConnectMessage] = useState<string | null>(null)
  const [avatarDraft, setAvatarDraft] = useState('')
  const [socialLinkDrafts, setSocialLinkDrafts] = useState<SocialLinkDrafts>({
    youtube: '',
    instagram: '',
    tiktok: '',
    facebook: '',
  })
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [savingSocialLinkId, setSavingSocialLinkId] = useState<SocialPlatform | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const user = await waitForAuthenticatedUser(supabase)

    if (!user) {
      router.push('/login')
      setIsLoading(false)
      return
    }

    setUserId(user.id)

    const profileSelects = [
      'email, username, full_name, avatar_url, belt, primary_archetype, nationality, gym_name, gym_unlisted_name, gym_location, social_link, youtube_url, tiktok_url, instagram_url, facebook_url, techniques_learned_count',
      'email, username, full_name, avatar_url, belt, primary_archetype, nationality, gym_name, gym_unlisted_name, gym_location, social_link',
      'email, username, full_name, avatar_url, belt, primary_archetype, nationality, gym_name, gym_unlisted_name, gym_location',
      'email, username, full_name, avatar_url, belt, primary_archetype, gym_name, gym_unlisted_name, gym_location',
    ]

    let profileData:
      | (ProfileData & {
          nationality?: string | null
          social_link?: string | null
          youtube_url?: string | null
          tiktok_url?: string | null
          instagram_url?: string | null
          facebook_url?: string | null
        })
      | null = null

    for (const select of profileSelects) {
      const profileResult = await supabase.from('user_profiles').select(select).eq('id', user.id).maybeSingle()
      if (!profileResult.error) {
        profileData = profileResult.data
          ? {
              nationality: null,
              social_link: null,
              youtube_url: null,
              tiktok_url: null,
              instagram_url: null,
              facebook_url: null,
              techniques_learned_count: 0,
              ...profileResult.data,
            }
          : null
        break
      }
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
      social_link: profileData?.social_link ?? null,
      youtube_url: profileData?.youtube_url ?? null,
      tiktok_url: profileData?.tiktok_url ?? null,
      instagram_url: profileData?.instagram_url ?? null,
      facebook_url: profileData?.facebook_url ?? null,
      techniques_learned_count: profileData?.techniques_learned_count ?? 0,
    })
    setAvatarDraft(profileData?.avatar_url ?? '')
    setSocialLinkDrafts({
      youtube: profileData?.youtube_url ?? '',
      instagram: profileData?.instagram_url ?? '',
      tiktok: profileData?.tiktok_url ?? '',
      facebook: profileData?.facebook_url ?? '',
    })
    setIdentities((user.identities as LinkedIdentity[] | undefined) ?? [])
    setIsLoading(false)
  }, [router, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const archetype = ARCHETYPES.find((entry) => entry.id === profile?.primary_archetype) ?? ARCHETYPES[0]
  const displayName = profile?.username ?? profile?.full_name ?? 'BJJ Athlete'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const gymDisplayName = profile?.gym_name ?? profile?.gym_unlisted_name ?? null
  const connectedProviders = useMemo(() => new Set(identities.map((identity) => identity.provider)), [identities])
  const nationalityFlagUrl = getFlagSvgUrl(profile?.nationality)
  const nationalityLabel = getCountryLabel(profile?.nationality)

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

  async function saveSocialLink(platform: SocialPlatform) {
    if (!userId) return
    setSavingSocialLinkId(platform)
    setConnectMessage(null)

    const normalizedValue = normalizeSocialUrl(socialLinkDrafts[platform])
    const { error } = await supabase
      .from('user_profiles')
      .update({ [`${platform}_url`]: normalizedValue })
      .eq('id', userId)

    setSavingSocialLinkId(null)

    if (error) {
      setConnectMessage(`Social Link konnte nicht gespeichert werden: ${error.message}`)
      return
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            [`${platform}_url`]: normalizedValue,
          }
        : current
    )
    setSocialLinkDrafts((current) => ({
      ...current,
      [platform]: normalizedValue ?? '',
    }))
    setConnectMessage(`${SOCIAL_LINK_FIELDS.find((entry) => entry.key === platform)?.label ?? 'Social Link'} gespeichert.`)
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

  if (isLoading) {
    return (
      <div className="mx-auto w-full">
        <section className="space-y-6">
          <div className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-[2.25rem] border border-black/20 bg-[linear-gradient(180deg,rgba(24,31,45,0.96)_0%,rgba(17,22,31,0.99)_100%)] p-6 shadow-card sm:p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="h-28 w-28 animate-pulse rounded-[2rem] bg-bjj-surface sm:h-36 sm:w-36" />
              <div className="h-8 w-48 animate-pulse rounded-xl bg-bjj-surface" />
              <div className="flex gap-2">
                <div className="h-8 w-24 animate-pulse rounded-full bg-bjj-surface" />
                <div className="h-8 w-32 animate-pulse rounded-full bg-bjj-surface" />
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto w-full pb-28 lg:pb-0">
        <section className="space-y-6">
          <div className="relative p-4 sm:p-6 lg:rounded-[1.65rem] lg:border lg:border-black/20 lg:bg-[linear-gradient(180deg,rgba(24,31,45,0.96)_0%,rgba(17,22,31,0.99)_100%)] lg:shadow-card">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-bjj-gold/12 blur-3xl lg:hidden" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#6e86b8]/10 blur-3xl lg:hidden" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
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
                      className="h-28 w-28 rounded-[2rem] object-cover ring-1 ring-black/20 transition duration-300 group-hover:scale-[1.02] group-hover:ring-bjj-gold/45 sm:h-36 sm:w-36"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-[linear-gradient(180deg,#2b3446,#171e2a)] text-3xl font-black text-white ring-1 ring-black/20 transition duration-300 group-hover:scale-[1.02] group-hover:ring-bjj-gold/45 sm:h-36 sm:w-36">
                      {initials}
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-black/0 text-white opacity-0 transition duration-300 group-hover:bg-black/35 group-hover:opacity-100">
                    <Camera className="h-8 w-8" />
                  </span>
                  <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-black/20 bg-[#1d2533] text-bjj-gold shadow-lg shadow-black/30">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                </button>

                <div className="relative flex-1 text-center lg:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">BJJ Profil</p>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-3 lg:justify-start">
                    {nationalityFlagUrl ? (
                      <img 
                        src={nationalityFlagUrl} 
                        alt={nationalityLabel ?? 'Nationalität'} 
                        className="h-8 w-12 rounded-[4px] object-cover"
                      />
                    ) : null}
                    <h1 className="text-4xl font-black uppercase italic tracking-[-0.04em] text-white sm:text-5xl xl:text-6xl">
                      {displayName}
                    </h1>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <span className="inline-flex items-center gap-2 rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-bjj-gold">
                      <Shield className="h-4 w-4" />
                      {profile?.belt ?? 'White Belt'}
                    </span>
                    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-black/20 bg-black/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                      <Globe2 className="h-4 w-4 shrink-0 text-bjj-gold" />
                      <span className="max-w-[20rem] truncate">{gymDisplayName ?? 'Kein Gym hinterlegt'}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-black/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                      <Sparkles className="h-4 w-4 text-bjj-gold" />
                      {archetype.name}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <span className="inline-flex items-center gap-2 rounded-full border border-bjj-gold/20 bg-bjj-gold/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-bjj-gold">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bjj-gold/20 text-[10px]">
                        {profile?.techniques_learned_count ?? 0}
                      </span>
                      Gelernte Clips
                    </span>
                  </div>
                </div>
            </div>

            <div className="hidden relative mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="rounded-[1.55rem] border border-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.18)_100%)] p-4">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">
                  <Globe2 className="h-4 w-4" />
                  Nationalität
                </div>
                <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-white">Im Onboarding festgelegt</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-bjj-muted">
                  Deine Nationalität wird im Onboarding einmal gesetzt und hier nur noch angezeigt.
                </p>
                <div className="mt-3 rounded-2xl border border-black/20 bg-[#111827] px-4 py-3">
                  <div className="flex items-center gap-3">
                    {nationalityFlagUrl ? (
                      <img src={nationalityFlagUrl} alt={nationalityLabel ?? 'Flagge'} className="h-5 w-7 rounded-[4px] object-cover" />
                    ) : (
                      <span className="inline-flex h-5 w-7 rounded-[4px] bg-black/20" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-white">{nationalityLabel ?? 'Noch keine Nationalität gesetzt'}</p>
                      <p className="text-xs text-bjj-muted">Änderbar nur über den Onboarding-Flow</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.55rem] border border-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.18)_100%)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">Social Media</p>
                <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-white">Verbindungen verwalten</h2>
                <p className="mt-1 text-sm leading-relaxed text-bjj-muted">
                  Verbinde deine Accounts für Avatar, Login und spätere Social Features. Wir fragen erst beim Klick nach einer Freigabe.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
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
                        className={`group flex min-h-[108px] flex-col items-center justify-center rounded-[1.25rem] border p-3 text-center transition ${
                          isConnected
                            ? 'border-bjj-gold/30 bg-bjj-gold/10'
                            : 'border-black/20 bg-[#111827]/80 hover:-translate-y-0.5 hover:border-bjj-gold/30 hover:bg-[#151d2a]'
                        } ${connectingProvider === entry.id ? 'cursor-not-allowed opacity-70' : ''}`}
                        aria-label={entry.label}
                        title={entry.label}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Icon className={`h-5 w-5 transition duration-200 group-hover:scale-110 ${entry.accent}`} />
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

            <div className="relative mt-6">
              <div className="rounded-[1.55rem] border border-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.18)_100%)] p-4">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">
                  <Globe2 className="h-4 w-4" />
                  Social Links
                </div>
                <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-white">Deine oeffentlichen Profile</h2>
                <p className="mt-1 text-sm leading-relaxed text-bjj-muted">
                  Hinterlege deine Links einzeln, damit andere direkt zu deinen Kanälen springen können.
                </p>
                <div className="mt-3 rounded-2xl border border-black/20 bg-[#111827] p-4">
                  <div className="flex flex-col gap-3">
                    {SOCIAL_LINK_FIELDS.map(({ key, label, placeholder, Icon, accent }) => {
                      const savedValue = profile?.[`${key}_url` as keyof ProfileData]
                      const currentDraft = socialLinkDrafts[key]
                      const normalizedDraft = normalizeSocialUrl(currentDraft)
                      const normalizedSaved = typeof savedValue === 'string' ? savedValue : null
                      const hasChanges = normalizedDraft !== normalizedSaved
                      const isSaving = savingSocialLinkId === key

                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(14,18,26,0.9),rgba(10,13,20,0.88))] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                        >
                          <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] ${accent}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">{label}</p>
                            <input
                              value={socialLinkDrafts[key]}
                              onChange={(event) =>
                                setSocialLinkDrafts((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              placeholder={placeholder}
                              className="mt-1 w-full border-0 bg-transparent px-0 py-0 text-sm text-white outline-none placeholder:text-white/24"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void saveSocialLink(key)}
                            disabled={isSaving || !hasChanges}
                            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                              hasChanges
                                ? 'bg-bjj-gold/12 text-bjj-gold hover:bg-bjj-gold/18'
                                : 'bg-white/[0.04] text-white/38'
                            } ${isSaving || !hasChanges ? 'cursor-default' : ''}`}
                            aria-label={hasChanges ? `${label} speichern` : `${label} bearbeiten`}
                          >
                            {hasChanges ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {connectMessage && (
            <div className="rounded-2xl border border-bjj-border bg-black/10 px-4 py-3 text-sm text-bjj-muted">
              {connectMessage}
            </div>
          )}

          <ProfileSavedClips />

          {/* Mobile Logout Button - nur auf kleinen Screens sichtbar */}
          <div className="mt-6 lg:hidden">
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut({ scope: 'global' })
                window.location.replace('/?logged_out=1')
              }}
              className="w-full rounded-2xl border border-bjj-border bg-bjj-surface px-5 py-4 text-sm font-black text-bjj-muted transition hover:border-red-500/30 hover:text-red-400"
            >
              Ausloggen
            </button>
          </div>
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
