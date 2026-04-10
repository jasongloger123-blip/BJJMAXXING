'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  dispatchSavedClipsChanged,
  readSavedClipIdsFromStorage,
  SAVED_CLIPS_EVENT,
  writeSavedClipIdsToStorage,
} from '@/lib/saved-clips'

type SavedClipButtonProps = {
  clipId: string
  className?: string
  activeClassName?: string
  inactiveClassName?: string
  label?: string
}

export function SavedClipButton({
  clipId,
  className = '',
  activeClassName = 'border-bjj-gold/40 bg-bjj-gold/16 text-bjj-gold',
  inactiveClassName = 'border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.08]',
  label,
}: SavedClipButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isSaved, setIsSaved] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadState() {
      const localIds = readSavedClipIdsFromStorage()
      if (!cancelled) {
        setIsSaved(localIds.includes(clipId))
      }

      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user

      if (!user) {
        if (!cancelled) setIsLoaded(true)
        return
      }

      const { data } = await supabase
        .from('user_saved_clips')
        .select('clip_id')
        .eq('user_id', user.id)
        .eq('clip_id', clipId)
        .maybeSingle()

      if (cancelled) return

      const nextSaved = Boolean(data?.clip_id)
      setIsSaved(nextSaved)
      setIsLoaded(true)

      const nextIds = nextSaved
        ? Array.from(new Set([...localIds.filter((id) => id !== clipId), clipId]))
        : localIds.filter((id) => id !== clipId)
      writeSavedClipIdsToStorage(nextIds)
      dispatchSavedClipsChanged(nextIds)
    }

    void loadState()

    function handleSavedClipsChanged(event: Event) {
      const detail = (event as CustomEvent<string[]>).detail
      if (!Array.isArray(detail)) return
      setIsSaved(detail.includes(clipId))
    }

    window.addEventListener(SAVED_CLIPS_EVENT, handleSavedClipsChanged)

    return () => {
      cancelled = true
      window.removeEventListener(SAVED_CLIPS_EVENT, handleSavedClipsChanged)
    }
  }, [clipId, supabase])

  async function handleToggle() {
    if (isSaving) return

    setIsSaving(true)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user

    if (!user) {
      setIsSaving(false)
      router.push('/login')
      return
    }

    const previousIds = readSavedClipIdsFromStorage()

    if (isSaved) {
      const { error } = await supabase.from('user_saved_clips').delete().eq('user_id', user.id).eq('clip_id', clipId)
      if (error) {
        setIsSaving(false)
        return
      }

      const nextIds = previousIds.filter((id) => id !== clipId)
      writeSavedClipIdsToStorage(nextIds)
      dispatchSavedClipsChanged(nextIds)
      setIsSaved(false)
      setIsSaving(false)
      return
    }

    const { error } = await supabase.from('user_saved_clips').insert({
      user_id: user.id,
      clip_id: clipId,
    })

    if (error) {
      setIsSaving(false)
      return
    }

    const nextIds = Array.from(new Set([...previousIds, clipId]))
    writeSavedClipIdsToStorage(nextIds)
    dispatchSavedClipsChanged(nextIds)
    setIsSaved(true)
    setIsSaving(false)
  }

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={!isLoaded || isSaving}
      className={`inline-flex items-center justify-center rounded-full border transition disabled:cursor-wait disabled:opacity-60 ${isSaved ? activeClassName : inactiveClassName} ${className}`}
      aria-label={isSaved ? 'Clip aus Favoriten entfernen' : 'Clip zu Favoriten hinzufuegen'}
      title={isSaved ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
    >
      <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
      {label ? <span className="ml-2 text-xs font-semibold">{label}</span> : null}
    </button>
  )
}
