'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  read: boolean
  created_at: string
  metadata?: {
    review_id?: string
    status?: string
    source_user_id?: string
    video_url?: string
  } | null
}

function formatRelativeTime(value: string) {
  const now = Date.now()
  const created = new Date(value).getTime()
  const diffMinutes = Math.max(1, Math.round((now - created) / 60000))

  if (diffMinutes < 60) return `${diffMinutes} Min.`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} Std.`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} Tag${diffDays === 1 ? '' : 'e'}`
}

function getNotificationHref(item: NotificationItem) {
  if (item.type === 'review_submitted') {
    return item.metadata?.review_id ? `/admin/reviews?review=${item.metadata.review_id}` : '/admin/reviews'
  }

  if (item.type === 'review_status_updated') {
    return '/gameplan'
  }

  return '/notifications'
}

function getNotificationActionLabel(item: NotificationItem) {
  if (item.type === 'review_submitted') return 'Zur Einreichung'
  if (item.type === 'review_status_updated') return 'Zum Gameplan'
  return 'Oeffnen'
}

export default function NotificationsPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const user = await waitForAuthenticatedUser(supabase)

    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, read, created_at, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setItems((data ?? []) as NotificationItem[])
    setLoading(false)

    if ((data ?? []).some((item) => !item.read)) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    }
  }, [router, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return <div className="h-40 rounded-3xl border border-bjj-border bg-bjj-card shimmer" />
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-bjj-gold">Benachrichtigungen</p>
        <h1 className="mt-3 text-4xl font-black text-white">Neuigkeiten und Reaktionen</h1>
      </div>

      <section className="rounded-[2rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-bjj-border bg-black/10 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{item.title}</p>
                    {item.body ? <p className="mt-2 text-sm text-bjj-muted">{item.body}</p> : null}
                    <Link
                      href={getNotificationHref(item)}
                      className="mt-3 inline-flex rounded-xl border border-bjj-border bg-bjj-surface px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-bjj-gold transition-colors hover:border-bjj-gold/30"
                    >
                      {getNotificationActionLabel(item)}
                    </Link>
                  </div>
                  <span className="text-sm text-bjj-muted">{formatRelativeTime(item.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-bjj-border bg-black/10 p-5 text-sm text-bjj-muted">
            Noch keine Benachrichtigungen.
          </div>
        )}
      </section>
    </div>
  )
}
