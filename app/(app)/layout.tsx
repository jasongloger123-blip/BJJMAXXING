'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getFlagSvgUrl } from '@/lib/countries'
import { getPlanLevel } from '@/lib/nodes'
import { isAdminEmail } from '@/lib/admin-access'

const fullNavItems = [
  { href: '/', label: 'Start' },
  { href: '/gameplan', label: 'Gameplan' },
  { href: '/technique-library', label: 'Technique Library' },
  { href: '/profile', label: 'Profil' },
  { href: '/admin/reviews', label: 'Review Admin', adminOnly: true },
  { href: '/pricing', label: 'Upgrade' },
]

const gameplanOptions = [
  {
    href: '/gameplan?plan=a-plan',
    id: 'a-plan',
    title: 'A-Plan',
    subtitle: 'Pull Guard -> Backtake',
    color: 'bg-[#f2a25a]',
  },
  {
    href: '/gameplan?plan=b-plan',
    id: 'b-plan',
    title: 'B-Plan',
    subtitle: 'Half Guard -> Sweep',
    color: 'bg-[#7d8cff]',
  },
  {
    href: '/gameplan?plan=c-plan',
    id: 'c-plan',
    title: 'C-Plan',
    subtitle: 'Open Guard -> Leglock',
    color: 'bg-[#5fb6d7]',
  },
] as const

type LayoutProfile = {
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  primary_archetype?: string | null
  nationality?: string | null
  gym_name?: string | null
  gym_place_id?: string | null
  gym_unlisted_name?: string | null
} | null

async function loadLayoutProfileSafe(supabase: ReturnType<typeof createClient>, userId: string) {
  const attempts = [
    'username, full_name, avatar_url, primary_archetype, nationality, gym_name, gym_place_id, gym_unlisted_name',
    'username, full_name, avatar_url, primary_archetype, nationality',
    'username, full_name, avatar_url, primary_archetype',
    'full_name, avatar_url, primary_archetype',
  ]

  for (const select of attempts) {
    const result = await supabase.from('user_profiles').select(select).eq('id', userId).maybeSingle()
    if (!result.error) {
      return {
        data: {
          username: null,
          avatar_url: null,
          nationality: null,
          gym_name: null,
          gym_place_id: null,
          gym_unlisted_name: null,
          ...(result.data ?? {}),
        } as LayoutProfile,
      }
    }
  }

  return { data: null as LayoutProfile }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const [profileStateLoaded, setProfileStateLoaded] = useState(false)
  const [displayName, setDisplayName] = useState('BJJ Athlete')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [archetypeName, setArchetypeName] = useState('Noch offen')
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [watchedCount, setWatchedCount] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [profileReady, setProfileReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [nationality, setNationality] = useState<string | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem('bjj-sidebar-collapsed')
    setIsSidebarCollapsed(saved === 'true')
  }, [])

  useEffect(() => {
    async function loadLayoutState() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setProfileReady(false)
        setIsAdmin(false)
        return
      }

      const [profileResult, progressResult, watchedResult, unreadResult] = await Promise.all([
        loadLayoutProfileSafe(supabase, user.id),
        supabase.from('progress').select('node_id').eq('user_id', user.id).eq('completed', true),
        supabase.from('training_clip_events').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      ])

      const profile: LayoutProfile = profileResult.data

      const hasUsername = Boolean(profile?.username ?? profile?.full_name)
      const hasArchetype = Boolean(profile?.primary_archetype)
      const hasGym = Boolean(profile?.gym_place_id ?? profile?.gym_name ?? profile?.gym_unlisted_name)
      const hasCoreProfile = hasUsername && hasArchetype

      setDisplayName(profile?.username ?? profile?.full_name ?? 'BJJ Athlete')
      setAvatarUrl(profile?.avatar_url ?? null)
      setNationality(profile?.nationality ?? null)
      setArchetypeName(profile?.primary_archetype ? profile.primary_archetype.replaceAll('-', ' ') : 'Noch offen')
      setProfileReady(hasCoreProfile)
      setIsAdmin(isAdminEmail(user.email))
      setCompletedIds(progressResult.data?.map((entry) => entry.node_id) ?? [])
      setWatchedCount(watchedResult.count ?? 0)
      setUnreadNotifications(unreadResult.error ? 0 : unreadResult.count ?? 0)
      setProfileStateLoaded(true)

      const onboardingAllowedPaths = ['/', '/archetype-test', '/archetype-result', '/profile']
      if (!hasCoreProfile && !onboardingAllowedPaths.some((allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`))) {
        router.push('/')
      }
    }

    void loadLayoutState()

    const onProfileRefresh = () => {
      void loadLayoutState()
    }

    window.addEventListener('profile-ready-changed', onProfileRefresh)
    return () => window.removeEventListener('profile-ready-changed', onProfileRefresh)
  }, [pathname, router, supabase])

  const navItems = useMemo(() => {
    return fullNavItems.filter((item) => !item.adminOnly || isAdmin)
  }, [isAdmin])

  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const level = getPlanLevel(completedIds)
  const showGameplanSidebar = pathname.startsWith('/gameplan')
  const activeGameplan = searchParams.get('plan') ?? 'a-plan'
  const sidebarWidthClass = isSidebarCollapsed ? 'w-24' : 'w-64'
  const contentOffsetClass = isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'
  const flagSvgUrl = getFlagSvgUrl(nationality)

  async function handleLogout() {
    await supabase.auth.signOut({ scope: 'global' })
    window.location.replace('/?logged_out=1')
  }

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('bjj-sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <div className="min-h-screen bg-bjj-bg">
      <aside
        className={`fixed left-0 top-0 hidden h-screen border-r border-white/5 bg-[linear-gradient(180deg,rgba(22,29,41,0.98),rgba(16,21,31,0.98))] p-4 backdrop-blur transition-[width] duration-300 lg:flex lg:flex-col ${sidebarWidthClass}`}
      >
        <div className={`mb-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-end'}`}>
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-white/70 transition hover:border-white/14 hover:text-white"
            aria-label={isSidebarCollapsed ? 'Sidebar aufklappen' : 'Sidebar zuklappen'}
            title={isSidebarCollapsed ? 'Sidebar aufklappen' : 'Sidebar zuklappen'}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        <Link
          href="/profile"
          className={`rounded-[1.8rem] border border-white/5 bg-[linear-gradient(180deg,rgba(31,39,56,0.98),rgba(22,28,40,0.98))] transition-colors hover:border-bjj-gold/25 ${
            isSidebarCollapsed ? 'p-3' : 'p-5'
          }`}
        >
          <div className={`flex ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className={`${isSidebarCollapsed ? 'h-12 w-12' : 'h-20 w-20'} rounded-full object-cover`} />
            ) : (
              <div
                className={`flex items-center justify-center rounded-full bg-[linear-gradient(180deg,#2b3446,#171e2a)] font-black text-white ${
                  isSidebarCollapsed ? 'h-12 w-12 text-sm' : 'h-20 w-20 text-2xl'
                }`}
              >
                {initials || 'BJ'}
              </div>
            )}
          </div>

          {!isSidebarCollapsed ? (
            <>
              <p className="mt-4 text-lg font-semibold text-bjj-text">{displayName}</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs uppercase tracking-[0.22em] text-bjj-gold">{archetypeName}</p>
                {flagSvgUrl ? <img src={flagSvgUrl} alt="Landesflagge" className="h-4 w-6 rounded-[4px] object-cover" /> : null}
              </div>

              {!showGameplanSidebar ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-[1.15rem] border border-white/5 bg-black/10 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">Videos angeschaut</p>
                    <p className="mt-2 text-2xl font-black text-white">{watchedCount}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-white/5 bg-black/10 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">Level</p>
                    <p className="mt-2 text-2xl font-black text-white">{level}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-white/5 bg-black/10 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bjj-muted">Archetyp</p>
                    <p className="mt-2 text-sm font-semibold text-white">{archetypeName}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-bjj-gold">L{level}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{watchedCount} Videos</span>
            </div>
          )}
        </Link>

        {showGameplanSidebar && !isSidebarCollapsed ? (
          <div className="mt-5 rounded-[1.8rem] border border-white/5 bg-[linear-gradient(180deg,rgba(20,26,38,0.98),rgba(15,20,30,0.98))] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">Gameplans</p>
              <div className="mt-4 space-y-2.5">
              {gameplanOptions.map((plan) => {
                const active = activeGameplan === plan.id

                return (
                  <Link
                    key={plan.title}
                    href={plan.href}
                    className={`flex items-start gap-3 rounded-[1.2rem] border px-4 py-3 transition-colors ${
                      active
                        ? 'border-bjj-gold/35 bg-bjj-gold/10 shadow-orange-glow-sm'
                        : 'border-white/5 bg-white/[0.03] hover:border-white/10'
                    }`}
                  >
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${plan.color}`} />
                    <div>
                      <p className={`text-sm font-black ${active ? 'text-white' : 'text-white/82'}`}>{plan.title}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : null}

        <button
          onClick={handleLogout}
          className={`mt-auto rounded-2xl border border-white/5 bg-[linear-gradient(180deg,rgba(31,39,56,0.98),rgba(22,28,40,0.98))] text-sm font-semibold text-bjj-muted transition-colors hover:text-bjj-text ${
            isSidebarCollapsed ? 'px-3 py-3 text-center' : 'px-4 py-3 text-left'
          }`}
        >
          {isSidebarCollapsed ? 'Exit' : 'Ausloggen'}
        </button>
      </aside>

      <div className={contentOffsetClass}>
        <header className="sticky top-0 z-20 border-b border-bjj-border bg-bjj-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-lg font-black text-white">
                BJJ<span className="text-bjj-gold">MAXXING</span>
              </Link>

              <nav className="hidden items-center gap-2 md:flex">
                {navItems.map((item) => {
                  const active =
                    item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        active ? 'bg-bjj-gold text-bjj-coal' : 'text-bjj-muted hover:text-bjj-text'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/notifications"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-bjj-border bg-bjj-card text-bjj-muted transition-colors hover:text-bjj-text"
                aria-label="Benachrichtigungen"
              >
                <span className="text-lg">🔔</span>
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-bjj-gold px-1 text-[10px] font-black text-bjj-coal">
                    {unreadNotifications}
                  </span>
                ) : null}
              </Link>

              <button
                onClick={handleLogout}
                className="rounded-2xl border border-bjj-border bg-bjj-card px-4 py-3 text-sm font-semibold text-bjj-muted transition-colors hover:text-bjj-text lg:hidden"
              >
                Ausloggen
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{profileStateLoaded ? children : <div className="h-40 rounded-3xl border border-bjj-border bg-bjj-card shimmer" />}</main>
      </div>
    </div>
  )
}
