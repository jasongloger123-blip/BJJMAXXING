'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, BookOpen, ChevronLeft, ChevronRight, DatabaseZap, Grid3X3, Home, MapPin, Sparkles, User2, Waypoints } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getFlagSvgUrl } from '@/lib/countries'
import { hasAdminAccess } from '@/lib/admin-access'

const SIDEBAR_LOGO_SRC = '/bjj-maxxing-logo.png'
const SIDEBAR_LOGO_COMPACT_SRC = '/bjj-maxxing-logo-compact.png'

const fullNavItems = [
  { href: '/', label: 'Start', icon: Home },
  { href: '/gameplan', label: 'Gameplan', icon: Waypoints },
  { href: '/technique-library', label: 'Techniken', icon: BookOpen },
  { href: '/gyms', label: 'Gyms', icon: MapPin },
  { href: '/profile', label: 'Profil', icon: User2 },
  { href: '/admin', label: 'Admin', icon: DatabaseZap, adminOnly: true },
  { href: '/pricing', label: 'Upgrade', icon: Sparkles },
]

// Mobile Navigation: nur 4 Haupt-Tabs
const mobileNavItems = [
  { href: '/', label: 'Start', icon: Home },
  { href: '/gameplan', label: 'Gameplan', icon: Waypoints },
  { href: '/technique-library', label: 'Techniken', icon: BookOpen },
  { href: '/profile', label: 'Profil', icon: User2 },
]

type LayoutProfile = {
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  primary_archetype?: string | null
  nationality?: string | null
  email?: string | null
  gym_name?: string | null
  gym_place_id?: string | null
} | null

async function loadLayoutProfileSafe(supabase: ReturnType<typeof createClient>, userId: string) {
  const attempts = [
    'username, full_name, avatar_url, primary_archetype, nationality, email, gym_name, gym_place_id',
    'username, full_name, avatar_url, primary_archetype, email, gym_name, gym_place_id',
    'full_name, avatar_url, primary_archetype, email',
  ]

  for (const select of attempts) {
    const result = await supabase.from('user_profiles').select(select).eq('id', userId).maybeSingle()
    if (!result.error) {
      return {
        data: {
          username: null,
          avatar_url: null,
          nationality: null,
          email: null,
          gym_name: null,
          gym_place_id: null,
          ...(result.data ?? {}),
        } as LayoutProfile,
      }
    }
  }

  return { data: null as LayoutProfile }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [profileStateLoaded, setProfileStateLoaded] = useState(false)
  const [displayName, setDisplayName] = useState('BJJ Athlete')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [archetypeName, setArchetypeName] = useState('Noch offen')
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [nationality, setNationality] = useState<string | null>(null)
  const [hasCoreProfile, setHasCoreProfile] = useState(false)
  const [isGameplanImmersive, setIsGameplanImmersive] = useState(false)
  
  // WICHTIG: Verhindert Redirect-Loops
  const hasRedirectedRef = useRef(false)

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
        setIsAdmin(false)
        setHasCoreProfile(false)
        setProfileStateLoaded(true)
        return
      }

      const [profileResult, unreadResult] = await Promise.all([
        loadLayoutProfileSafe(supabase, user.id),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      ])

      const profile = profileResult.data
      const hasUsername = Boolean(profile?.username ?? profile?.full_name)
      const hasArchetype = Boolean(profile?.primary_archetype)
      const hasGym = Boolean(profile?.gym_name || profile?.gym_place_id)
      const hasCoreProfile = hasUsername && hasArchetype && hasGym

      setDisplayName(profile?.username ?? profile?.full_name ?? 'BJJ Athlete')
      setAvatarUrl(profile?.avatar_url ?? null)
      setNationality(profile?.nationality ?? null)
      setArchetypeName(profile?.primary_archetype ? profile.primary_archetype.replaceAll('-', ' ') : 'Noch offen')
      setIsAdmin(hasAdminAccess({ email: user.email, profileEmail: profile?.email }))
      setUnreadNotifications(unreadResult.error ? 0 : unreadResult.count ?? 0)
      setHasCoreProfile(hasCoreProfile)
      setProfileStateLoaded(true)

      // WICHTIG: Onboarding-Logik nur ausführen wenn Profil geladen
      // und NICHT auf einer erlaubten Seite
      const onboardingPaths = ['/name-input', '/onboarding', '/archetype-test', '/archetype-result', '/login', '/register']
      const isOnOnboardingPage = onboardingPaths.some(p => pathname === p || pathname.startsWith(`${p}/`))
      
      // Wenn kein vollständiges Profil UND nicht auf Onboarding-Seite → redirect
      // ABER NUR EINMAL (verhindert Loop)
      if (!hasCoreProfile && !isOnOnboardingPage && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true
        
        // Redirect je nach Status
        if (!hasUsername || !hasArchetype) {
          // Noch kein Name/Archetyp
          router.push('/name-input')
        } else if (!hasGym) {
          // Name/Archetyp da, aber kein Gym
          router.push('/onboarding')
        }
      }
    }

    void loadLayoutState()

    const onProfileRefresh = () => {
      void loadLayoutState()
    }

    window.addEventListener('profile-ready-changed', onProfileRefresh)
    return () => window.removeEventListener('profile-ready-changed', onProfileRefresh)
  }, [pathname, router, supabase])
  
  // WICHTIG: Reset redirect flag when pathname changes to a different page
  // Das erlaubt erneute redirects wenn User manuell navigiert
  useEffect(() => {
    // Reset wenn wir auf einer "sicheren" Seite sind (nicht während redirect)
    const onboardingPaths = ['/name-input', '/onboarding', '/archetype-test', '/archetype-result', '/login', '/register']
    const isOnOnboardingPage = onboardingPaths.some(p => pathname === p || pathname.startsWith(`${p}/`))
    
    // Nur reset wenn wir auf einer Onboarding-Seite gelandet sind
    if (isOnOnboardingPage) {
      hasRedirectedRef.current = false
    }
  }, [pathname])

  useEffect(() => {
    if (!pathname.startsWith('/gameplan')) {
      setIsGameplanImmersive(false)
    }

    function handleGameplanLayoutMode(event: Event) {
      const detail = (event as CustomEvent<{ detailMode?: boolean }>).detail?.detailMode
      setIsGameplanImmersive(Boolean(detail))
    }

    window.addEventListener('gameplan-layout-mode', handleGameplanLayoutMode)
    return () => window.removeEventListener('gameplan-layout-mode', handleGameplanLayoutMode)
  }, [pathname])

  const navItems = useMemo(() => fullNavItems.filter((item) => !item.adminOnly || isAdmin), [isAdmin])
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const showGameplanSidebar = pathname.startsWith('/gameplan')
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
  const sidebarWidthClass = isSidebarCollapsed ? 'w-24' : 'w-64'
  const shouldLockNavigation = profileStateLoaded && !hasCoreProfile
  const contentOffsetClass = shouldLockNavigation ? '' : showGameplanSidebar && isGameplanImmersive ? 'lg:pl-24' : isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'
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
    <div
      className="min-h-screen bg-bjj-bg"
      style={
        {
          '--app-sidebar-width': isSidebarCollapsed ? '96px' : '256px',
          '--app-sidebar-collapsed-width': '96px',
        } as React.CSSProperties
      }
    >
      {/* Waehrend des Ladens nichts anzeigen */}
      {!profileStateLoaded ? (
        <div className="flex min-h-screen items-center justify-center bg-bjj-bg">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-bjj-border border-t-bjj-gold" />
            <p className="text-sm text-bjj-muted">Lade...</p>
          </div>
        </div>
      ) : shouldLockNavigation ? (
        /* Onboarding-Modus: Keine Sidebar/Navigation, nur Inhalt */
        <div className="min-h-screen bg-bjj-bg">{children}</div>
      ) : (
        /* Normaler Modus: Volles Layout mit Sidebar */
        <>
          <aside
            className={`fixed left-0 top-0 z-50 hidden h-screen border-r border-black/20 bg-[linear-gradient(180deg,rgba(22,29,41,0.98),rgba(16,21,31,0.98))] p-4 backdrop-blur transition-[width] duration-300 lg:flex lg:flex-col ${sidebarWidthClass}`}
          >
        <div className="mb-5">
          <div
            className={`flex items-center ${
              isSidebarCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <Link
              href="/"
              className="group flex w-full items-center transition hover:opacity-90"
              aria-label="BJJMAXXING Start"
            >
              {isSidebarCollapsed ? (
                <div className="flex w-full items-center justify-center overflow-hidden rounded-[1.4rem] border border-black/20 bg-black/10 p-2">
                  <img
                    src={SIDEBAR_LOGO_COMPACT_SRC}
                    alt="BJJMAXXING"
                    className="h-16 w-16 object-contain"
                  />
                </div>
              ) : (
                <div className="flex w-full items-center overflow-hidden rounded-[1.4rem] border border-black/20 bg-black/10 p-3">
                  <img
                    src={SIDEBAR_LOGO_SRC}
                    alt="BJJMAXXING Logo"
                    className="h-20 w-full max-w-none object-contain object-left"
                  />
                </div>
              )}
            </Link>
          </div>
        </div>

        <nav className="mt-2 space-y-2">
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`group flex items-center rounded-[1.4rem] border transition ${
                  isSidebarCollapsed ? 'justify-center px-0 py-4' : 'gap-3 px-4 py-3.5'
                } ${
                  active
                    ? 'border-bjj-gold/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(245,158,11,0.06))] text-white shadow-orange-glow-sm'
                    : 'border-black/20 bg-black/10 text-white/62 hover:border-bjj-gold/16 hover:text-white'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center rounded-2xl ${
                    active ? 'text-bjj-gold' : 'text-white/56 group-hover:text-bjj-gold'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {!isSidebarCollapsed ? <span className="text-sm font-semibold">{item.label}</span> : null}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto space-y-3">
          {isSidebarCollapsed ? (
            <div className="flex justify-center">
              <Link
                href="/notifications"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-bjj-gold/18 bg-[#161d29] text-white/70 transition hover:text-white"
                aria-label="Benachrichtigungen"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-bjj-gold px-1 text-[10px] font-black text-bjj-coal">
                    {unreadNotifications}
                  </span>
                ) : null}
              </Link>
            </div>
          ) : null}

          <div
            className={`relative block rounded-[1.8rem] border border-black/20 bg-[linear-gradient(180deg,rgba(31,39,56,0.98),rgba(22,28,40,0.98))] transition-colors hover:border-bjj-gold/25 ${
              isSidebarCollapsed ? 'p-3' : 'p-5'
            }`}
          >
            {!isSidebarCollapsed ? (
              <Link
                href="/notifications"
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-bjj-gold/18 bg-[#161d29] text-white/70 transition hover:text-white"
                aria-label="Benachrichtigungen"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-bjj-gold px-1 text-[10px] font-black text-bjj-coal">
                    {unreadNotifications}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <Link href="/profile" className="block">
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : ''}`}>
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
                  <div className="mt-4 flex items-center gap-2">
                    {flagSvgUrl ? <img src={flagSvgUrl} alt="Landesflagge" className="h-4 w-6 rounded-[4px] object-cover" /> : null}
                    <p className="text-lg font-semibold text-bjj-text">{displayName}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.22em] text-bjj-gold">{archetypeName}</p>
                  </div>


                </>
              ) : (
                <div className="mt-3 flex justify-center">
                  {flagSvgUrl ? <img src={flagSvgUrl} alt="Landesflagge" className="h-4 w-6 rounded-[4px] object-cover" /> : null}
                </div>
              )}
            </Link>
          </div>

          <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            {!isSidebarCollapsed ? (
              <button
                onClick={handleLogout}
                className="flex-1 rounded-2xl border border-black/20 bg-[linear-gradient(180deg,rgba(31,39,56,0.98),rgba(22,28,40,0.98))] px-4 py-3 text-left text-sm font-semibold text-bjj-muted transition-colors hover:text-bjj-text"
              >
                Ausloggen
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/20 bg-[linear-gradient(180deg,rgba(26,34,48,0.98),rgba(17,23,33,0.98))] text-white/70 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:border-bjj-gold/20 hover:text-white lg:inline-flex"
              aria-label={isSidebarCollapsed ? 'Sidebar aufklappen' : 'Sidebar zuklappen'}
              title={isSidebarCollapsed ? 'Sidebar aufklappen' : 'Sidebar zuklappen'}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>
        </div>

          </aside>

          <div className={contentOffsetClass}>
            <main className={`${showGameplanSidebar && isGameplanImmersive ? 'w-full overflow-hidden px-0 py-0 lg:h-screen' : 'w-full px-4 py-6 md:px-6 md:py-8 lg:py-6'} pb-32 lg:pb-6`}>
              {children}
            </main>
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation - IMMER SICHTBAR auf kleinen Screens */}
      <nav className="fixed bottom-0 left-0 right-0 z-[99999] border-t border-bjj-border bg-[#0d1117] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {mobileNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${
                    isActive ? 'text-bjj-gold' : 'text-bjj-muted'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </Link>
              )
            })}
        </div>
      </nav>
    </div>
  )
}
