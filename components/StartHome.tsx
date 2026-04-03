'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Check, ChevronUp, MapPinned, MessageCircle, Play, Share2, ShieldCheck, Sparkles, X } from 'lucide-react'
import { ARCHETYPES } from '@/lib/archetypes'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'
import { buildStartQueue, type ClipResult, type QueueCard, type QueueEvent } from '@/lib/start-queue'
import { YoutubeEmbed } from '@/components/YoutubeEmbed'
import { getNodeById } from '@/lib/nodes'

type StartState = {
  userId: string
  username: string | null
  fullName: string | null
  email: string | null
  avatarUrl: string | null
  primaryArchetype: string | null
  gymName: string | null
  gymPlaceId: string | null
  gymLocation: string | null
  gymSource: string | null
  gymUnlistedName: string | null
}

type ClipReply = {
  id: string
  author: string
  text: string
  meta: string
  avatarUrl?: string | null
}

type ClipComment = {
  id: string
  userId: string
  author: string
  text: string
  meta: string
  avatarUrl?: string | null
  likes: number
  dislikes: number
  userReaction: 1 | -1 | null
  replies: ClipReply[]
}

type GymSuggestion = {
  placeId: string
  name: string
  secondaryText: string
  description: string
  types: string[]
}

type GymDetails = {
  placeId: string
  name: string
  location: string
  types: string[]
}

type ProgressRow = {
  node_id: string
  completed?: boolean
  validated?: boolean
}

type ProgressSnapshot = {
  watched?: boolean
  drilled?: boolean
  attempted?: boolean
  hit_in_sparring?: boolean
  completed?: boolean
  completed_at?: string | null
  validated?: boolean
  validated_at?: string | null
} | null

function isMissingColumnError(error: { message?: string } | null, column: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(`progress.${column}`) && message.includes('does not exist')
}

async function loadUserProfileSafe(supabase: ReturnType<typeof createClient>, userId: string) {
  const attempts = [
    'username, full_name, email, avatar_url, primary_archetype, gym_name, gym_place_id, gym_location, gym_source, gym_unlisted_name',
    'username, full_name, email, avatar_url, primary_archetype',
    'full_name, email, avatar_url, primary_archetype',
  ]

  for (const select of attempts) {
    const result = await supabase.from('user_profiles').select(select).eq('id', userId).maybeSingle()
    if (!result.error) {
      return {
        data: {
          username: null,
          gym_name: null,
          gym_place_id: null,
          gym_location: null,
          gym_source: null,
          gym_unlisted_name: null,
          ...(result.data ?? {}),
        },
        error: null,
      }
    }
  }

  return {
    data: null,
    error: 'Profil konnte nicht geladen werden.',
  }
}

const flowSteps = ['Entry', 'Guard', 'Control', 'Transition', 'Finish']

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

function isProfileReady(state: StartState | null) {
  return Boolean(state && (state.username ?? state.fullName) && state.primaryArchetype && (state.gymPlaceId ?? state.gymName ?? state.gymUnlistedName))
}

export default function StartHome() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null)
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingGym, setSavingGym] = useState(false)
  const [startState, setStartState] = useState<StartState | null>(null)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [validatedIds, setValidatedIds] = useState<string[]>([])
  const [events, setEvents] = useState<QueueEvent[]>([])
  const [comments, setComments] = useState<ClipComment[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [commentFeaturesReady, setCommentFeaturesReady] = useState(true)
  const [gymQuery, setGymQuery] = useState('')
  const [gymSuggestions, setGymSuggestions] = useState<GymSuggestion[]>([])
  const [gymLoading, setGymLoading] = useState(false)
  const [gymError, setGymError] = useState<string | null>(null)
  const [selectedGym, setSelectedGym] = useState<GymDetails | null>(null)
  const [manualGymMode, setManualGymMode] = useState(true)
  const [manualGymName, setManualGymName] = useState('')
  const [pendingValidation, setPendingValidation] = useState<{
    card: QueueCard
    question: string
    options: string[]
    correct: string
  } | null>(null)
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null)

  const loadState = useCallback(async () => {
    const user = await waitForAuthenticatedUser(supabase)
    if (!user) {
      router.push('/login')
      return
    }

    const [profileResult, progressResult, eventsResult] = await Promise.all([
      loadUserProfileSafe(supabase, user.id),
      (async () => {
        const result = await supabase.from('progress').select('node_id, completed, validated').eq('user_id', user.id)
        if (!isMissingColumnError(result.error, 'validated')) return result
        const fallback = await supabase.from('progress').select('node_id, completed').eq('user_id', user.id)
        return {
          data: (fallback.data ?? []).map((entry) => ({ ...entry, validated: false })),
          error: fallback.error,
        }
      })(),
      supabase.from('training_clip_events').select('node_id, clip_key, clip_type, result, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    const profile = profileResult.data as any

    setStartState({
      userId: user.id,
      username: profile?.username ?? null,
      fullName: profile?.full_name ?? user.user_metadata?.full_name ?? null,
      email: profile?.email ?? user.email ?? null,
      avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      primaryArchetype: profile?.primary_archetype ?? null,
      gymName: profile?.gym_name ?? null,
      gymPlaceId: profile?.gym_place_id ?? null,
      gymLocation: profile?.gym_location ?? null,
      gymSource: profile?.gym_source ?? null,
      gymUnlistedName: profile?.gym_unlisted_name ?? null,
    })
    setUsernameDraft(profile?.username ?? '')
    const progressRows = (progressResult.data ?? []) as ProgressRow[]
    setCompletedIds(progressRows.filter((entry) => entry.completed).map((entry) => entry.node_id))
    setValidatedIds(progressRows.filter((entry) => entry.validated).map((entry) => entry.node_id))
    setEvents((eventsResult.data ?? []) as QueueEvent[])
    setLoading(false)
    window.dispatchEvent(new Event('profile-ready-changed'))
  }, [router, supabase])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const assignedArchetype = ARCHETYPES.find((item) => item.id === startState?.primaryArchetype) ?? null
  const queue = useMemo(() => buildStartQueue(completedIds, events), [completedIds, events])
  const primaryCard = queue[0]
  const hasGym = Boolean(startState?.gymPlaceId ?? startState?.gymName ?? startState?.gymUnlistedName)
  const displayName = startState?.username ?? startState?.fullName ?? startState?.email?.split('@')[0] ?? 'BJJ Athlete'
  const coachInitials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const quickDetails = primaryCard
    ? primaryCard.keyPoints.slice(0, 2).length
      ? primaryCard.keyPoints.slice(0, 2)
      : [{ label: 'Focus', items: [primaryCard.principle] }]
    : []
  const overallProgress = useMemo(() => {
    const baseline = completedIds.length + validatedIds.length
    const total = Math.max(flowSteps.length, 1)
    return Math.max(18, Math.min(100, Math.round((baseline / total) * 100)))
  }, [completedIds.length, validatedIds.length])
  const spotlightDetail = quickDetails[0]
  const supportDetail = quickDetails[1]

  const loadComments = useCallback(async (clipKey: string) => {
    if (!startState) return
    const { data: commentData, error: commentError } = await supabase
      .from('clip_comments')
      .select('id, user_id, author_name, author_avatar_url, content, created_at')
      .eq('clip_key', clipKey)
      .order('created_at', { ascending: false })
    if (commentError) {
      setFeedback(`Kommentare konnten nicht geladen werden: ${commentError.message}`)
      setComments([])
      return
    }

    const commentIds = (commentData ?? []).map((entry) => entry.id)
    const [{ data: reactionData, error: reactionError }, { data: replyData, error: replyError }] = commentIds.length
      ? await Promise.all([
          supabase.from('clip_comment_reactions').select('comment_id, user_id, value').in('comment_id', commentIds),
          supabase.from('clip_comment_replies').select('id, comment_id, author_name, author_avatar_url, content, created_at').in('comment_id', commentIds).order('created_at', { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }]

    setCommentFeaturesReady(!(reactionError || replyError))
    setComments((commentData ?? []).map((entry) => ({
      id: entry.id,
      userId: entry.user_id,
      author: entry.author_name,
      avatarUrl: entry.author_avatar_url,
      text: entry.content,
      meta: formatRelativeTime(entry.created_at),
      likes: (reactionData ?? []).filter((reaction: any) => reaction.comment_id === entry.id && reaction.value === 1).length,
      dislikes: (reactionData ?? []).filter((reaction: any) => reaction.comment_id === entry.id && reaction.value === -1).length,
      userReaction: (reactionData ?? []).find((reaction: any) => reaction.comment_id === entry.id && reaction.user_id === startState.userId)?.value ?? null,
      replies: (replyData ?? []).filter((reply: any) => reply.comment_id === entry.id).map((reply: any) => ({
        id: reply.id,
        author: reply.author_name,
        avatarUrl: reply.author_avatar_url,
        text: reply.content,
        meta: formatRelativeTime(reply.created_at),
      })),
    })))
  }, [startState, supabase])

  useEffect(() => {
    if (!primaryCard || !startState || !isProfileReady(startState)) {
      setComments([])
      return
    }
    void loadComments(primaryCard.id)
  }, [loadComments, primaryCard, startState])

  useEffect(() => {
    if (!assignedArchetype || hasGym || manualGymMode) {
      setGymSuggestions([])
      return
    }
    if (gymQuery.trim().length < 2) {
      setGymSuggestions([])
      return
    }

    const timeout = window.setTimeout(async () => {
      setGymLoading(true)
      setGymError(null)
      try {
        const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(gymQuery.trim())}`)
        const payload = await response.json()
        setGymSuggestions(payload.suggestions ?? [])
        if (payload.error) {
          setGymError(payload.error)
        } else if ((payload.suggestions ?? []).length === 0) {
          setGymError('Kein passendes Gym gefunden. Probiere einen anderen Namen oder nutze den Fallback.')
        }
      } catch {
        setGymSuggestions([])
        setGymError('Gym-Vorschlaege konnten nicht geladen werden.')
      } finally {
        setGymLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [assignedArchetype, gymQuery, hasGym, manualGymMode])

  async function submitQueueResult(
    card: QueueCard,
    result: ClipResult,
    options?: { skipValidation?: boolean; validatedFromQuiz?: boolean }
  ) {
    if (!startState) return
    setSavingId(card.id)
    setFeedback(null)

    if (result === 'known' && !options?.skipValidation && !validatedIds.includes(card.nodeId)) {
      const node = getNodeById(card.nodeId)
      if (node?.validationQuestion && node.validationOptions?.length && node.validationCorrectAnswer) {
        setPendingValidation({
          card,
          question: node.validationQuestion,
          options: node.validationOptions,
          correct: node.validationCorrectAnswer,
        })
        setSavingId(null)
        return
      }
    }

    const { error: insertError } = await supabase.from('training_clip_events').insert({
      user_id: startState.userId,
      node_id: card.nodeId,
      clip_key: card.id,
      clip_type: card.type,
      result,
    })

    if (insertError) {
      setSavingId(null)
      setFeedback(`Aktion konnte nicht gespeichert werden: ${insertError.message}`)
      return
    }

    let existingProgress: ProgressSnapshot = null
    let progressLoadError: { message?: string } | null = null

    const progressWithValidation = await supabase
      .from('progress')
      .select('watched, drilled, attempted, hit_in_sparring, completed, completed_at, validated, validated_at')
      .eq('user_id', startState.userId)
      .eq('node_id', card.nodeId)
      .maybeSingle()

    if (isMissingColumnError(progressWithValidation.error, 'validated')) {
      const fallbackProgress = await supabase
        .from('progress')
        .select('watched, drilled, attempted, hit_in_sparring, completed, completed_at')
        .eq('user_id', startState.userId)
        .eq('node_id', card.nodeId)
        .maybeSingle()

      existingProgress = fallbackProgress.data ? { ...fallbackProgress.data, validated: false, validated_at: null } : null
      progressLoadError = fallbackProgress.error
    } else {
      existingProgress = progressWithValidation.data
      progressLoadError = progressWithValidation.error
    }

    if (progressLoadError) {
      setSavingId(null)
      setFeedback(`Fortschritt konnte nicht geladen werden: ${progressLoadError.message}`)
      return
    }

    const alreadyValidated = Boolean(existingProgress?.validated) || validatedIds.includes(card.nodeId)
    const justValidated = Boolean(options?.validatedFromQuiz)
    const validationPassed = alreadyValidated || justValidated
    const nodeCompleted = Boolean(existingProgress?.completed) || (result === 'known' && validationPassed)
    const validatedValue = result === 'known' ? validationPassed : Boolean(existingProgress?.validated)

    const progressPayload = {
      user_id: startState.userId,
      node_id: card.nodeId,
      watched: true,
      drilled: Boolean(existingProgress?.drilled) || result === 'relevant' || result === 'not_yet' || result === 'known',
      attempted: Boolean(existingProgress?.attempted) || result === 'relevant' || result === 'known',
      hit_in_sparring: Boolean(existingProgress?.hit_in_sparring) || result === 'known',
      completed: nodeCompleted,
      completed_at: nodeCompleted ? existingProgress?.completed_at ?? new Date().toISOString() : null,
      validated: validatedValue,
      validated_at: validatedValue ? existingProgress?.validated_at ?? new Date().toISOString() : null,
    }

    let progressError: { message?: string } | null = null
    const progressUpsert = await supabase.from('progress').upsert(progressPayload, { onConflict: 'user_id,node_id' })

    if (isMissingColumnError(progressUpsert.error, 'validated')) {
      const { validated: _validated, validated_at: _validatedAt, ...fallbackPayload } = progressPayload
      const fallbackUpsert = await supabase.from('progress').upsert(fallbackPayload, { onConflict: 'user_id,node_id' })
      progressError = fallbackUpsert.error
    } else {
      progressError = progressUpsert.error
    }

    setSavingId(null)

    if (progressError) {
      setFeedback(`Fortschritt konnte nicht gespeichert werden: ${progressError.message}`)
      return
    }

    setFeedback(null)
    if (validatedValue && !validatedIds.includes(card.nodeId)) {
      setValidatedIds((current) => [...current, card.nodeId])
    }
    await loadState()
  }

  async function handleValidationAnswer(option: string) {
    if (!pendingValidation) return
    const correct = option === pendingValidation.correct
    if (!correct) {
      setValidationFeedback('Nicht ganz. Bleib beim Node und schau dir den Clip noch einmal an.')
      setPendingValidation(null)
      return
    }

    setValidationFeedback(null)
    const { card } = pendingValidation
    setPendingValidation(null)
    await submitQueueResult(card, 'known', { skipValidation: true, validatedFromQuiz: true })
  }

  async function saveUsernameAndContinue() {
    if (!startState) return
    const normalizedUsername = usernameDraft.trim().toLowerCase().replace(/\s+/g, '-')
    if (normalizedUsername.length < 3) {
      setFeedback('Dein Nutzername muss mindestens 3 Zeichen haben.')
      return
    }
    setSavingUsername(true)
    setFeedback(null)
    const existingQuery = await supabase.from('user_profiles').select('id').eq('username', normalizedUsername).neq('id', startState.userId).maybeSingle()
    if (!existingQuery.error && existingQuery.data) {
      setSavingUsername(false)
      setFeedback('Dieser Nutzername ist schon vergeben.')
      return
    }

    let updateResult = await supabase.from('user_profiles').update({ username: normalizedUsername }).eq('id', startState.userId)
    if (updateResult.error) {
      updateResult = await supabase.from('user_profiles').update({ full_name: usernameDraft.trim() }).eq('id', startState.userId)
    }
    setSavingUsername(false)
    if (updateResult.error) {
      setFeedback(`Nutzername konnte nicht gespeichert werden: ${updateResult.error.message}`)
      return
    }

    const hasAssignedArchetype = Boolean(startState.primaryArchetype)

    setStartState((current) =>
      current ? { ...current, username: normalizedUsername, fullName: usernameDraft.trim() } : current
    )
    window.dispatchEvent(new Event('profile-ready-changed'))

    if (!hasAssignedArchetype) {
      router.push('/archetype-test')
    }
  }

  async function selectGymSuggestion(suggestion: GymSuggestion) {
    setGymLoading(true)
    setGymError(null)
    try {
      const response = await fetch(`/api/places/details?place_id=${encodeURIComponent(suggestion.placeId)}`)
      const payload = await response.json()
      if (!response.ok) {
        setGymError(payload.error ?? 'Gym-Details konnten nicht geladen werden.')
        return
      }
      setSelectedGym(payload as GymDetails)
      setGymQuery(payload.name)
      setGymSuggestions([])
    } catch {
      setGymError('Gym-Details konnten nicht geladen werden.')
    } finally {
      setGymLoading(false)
    }
  }

  async function saveGymAndContinue() {
    if (!startState) return
    setSavingGym(true)
    setFeedback(null)

    const payload = manualGymMode
      ? {
          gym_name: manualGymName.trim(),
          gym_place_id: null,
          gym_location: null,
          gym_types: [],
          gym_source: 'manual',
          gym_unlisted_name: manualGymName.trim(),
          gym_verified: false,
        }
      : selectedGym
        ? {
            gym_name: selectedGym.name,
            gym_place_id: selectedGym.placeId,
            gym_location: selectedGym.location,
            gym_types: selectedGym.types,
            gym_source: 'google',
            gym_unlisted_name: null,
            gym_verified: true,
          }
        : null

    if (!payload || (!manualGymMode && !selectedGym) || (manualGymMode && !manualGymName.trim())) {
      setSavingGym(false)
      setFeedback('Waehle zuerst ein Gym aus oder trage dein Gym manuell ein.')
      return
    }

    const { error } = await supabase.from('user_profiles').update(payload).eq('id', startState.userId)
    setSavingGym(false)
    if (error) {
      setFeedback(`Gym konnte nicht gespeichert werden: ${error.message}`)
      return
    }

    setStartState((current) =>
      current
        ? {
            ...current,
            gymName: payload.gym_name,
            gymPlaceId: payload.gym_place_id,
            gymLocation: payload.gym_location,
            gymSource: payload.gym_source,
            gymUnlistedName: payload.gym_unlisted_name,
          }
        : current
    )
    window.dispatchEvent(new Event('profile-ready-changed'))
    router.refresh()
  }

  async function submitComment() {
    if (!primaryCard || !commentDraft.trim() || !startState) return
    setSubmittingComment(true)
    setFeedback(null)
    const authorName = startState.username ?? startState.fullName ?? startState.email?.split('@')[0] ?? 'BJJ Athlete'
    const { error } = await supabase.from('clip_comments').insert({
      user_id: startState.userId,
      node_id: primaryCard.nodeId,
      clip_key: primaryCard.id,
      author_name: authorName,
      author_avatar_url: startState.avatarUrl,
      content: commentDraft.trim(),
    })
    setSubmittingComment(false)
    if (error) {
      setFeedback(`Kommentar konnte nicht gespeichert werden: ${error.message}`)
      return
    }
    setCommentDraft('')
    await loadComments(primaryCard.id)
  }

  async function submitReaction(commentId: string, value: 1 | -1) {
    if (!startState) return
    const { error } = await supabase.from('clip_comment_reactions').upsert({ comment_id: commentId, user_id: startState.userId, value }, { onConflict: 'comment_id,user_id' })
    if (error) {
      setFeedback(`Reaktion konnte nicht gespeichert werden: ${error.message}`)
      return
    }
    if (primaryCard) await loadComments(primaryCard.id)
  }

  async function submitReply(commentId: string) {
    if (!primaryCard || !replyDrafts[commentId]?.trim() || !startState) return
    setSubmittingReplyId(commentId)
    setFeedback(null)
    const authorName = startState.username ?? startState.fullName ?? startState.email?.split('@')[0] ?? 'BJJ Athlete'
    const { error } = await supabase.from('clip_comment_replies').insert({
      comment_id: commentId,
      user_id: startState.userId,
      author_name: authorName,
      author_avatar_url: startState.avatarUrl,
      content: replyDrafts[commentId].trim(),
    })
    setSubmittingReplyId(null)
    if (error) {
      setFeedback(`Antwort konnte nicht gespeichert werden: ${error.message}`)
      return
    }
    setReplyDrafts((current) => ({ ...current, [commentId]: '' }))
    setExpandedReplies((current) => ({ ...current, [commentId]: true }))
    await loadComments(primaryCard.id)
  }

  if (loading) {
    return <div className="h-40 rounded-3xl border border-bjj-border bg-bjj-card shimmer" />
  }

  if (startState && !(startState.username ?? startState.fullName)) {
    return (
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0f1419] px-6 py-10 text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:px-10 md:py-12">
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#ff006e]/15 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-5rem] top-1/2 h-72 w-72 rounded-full bg-[#00f2ff]/12 blur-[130px]" />

        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,0,110,0.2),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-[#ccff00]">
                Setup Mode
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-300">
                5 Fragen. 1 klarer Plan.
              </span>
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black uppercase leading-[0.95] md:text-6xl xl:text-7xl">
              Definiere erst deinen Namen.
              <span className="mt-2 block text-[#00f2ff]">Dann startet dein System.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              Das Verhalten bleibt gleich. Wir geben deiner Startseite nur eine deutlich staerkere Reel- und Hybrid-Optik.
            </p>

            <div className="mt-10 flex flex-nowrap items-center gap-3 overflow-x-auto pb-2">
              {flowSteps.map((step, index) => (
                <div key={step} className="flex shrink-0 items-center gap-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white md:min-w-[150px] md:text-base">
                    {step}
                  </div>
                  {index < flowSteps.length - 1 ? <ChevronUp className="h-5 w-5 rotate-90 text-[#ff006e]" /> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">Dein Handle</p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight md:text-4xl">Wie soll dich die App nennen?</h2>
            <div className="mt-6">
              <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-[#ccff00]">Name in der App</label>
              <input
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                placeholder="z. B. guardhunter"
                className="mt-3 w-full rounded-[1.3rem] border border-white/10 bg-black/20 px-5 py-4 text-lg text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <button
              onClick={() => void saveUsernameAndContinue()}
              disabled={savingUsername}
              className="mt-6 inline-flex w-full items-center justify-center rounded-[1.4rem] bg-[#ccff00] px-6 py-4 text-lg font-black uppercase tracking-[0.12em] text-black shadow-[0_0_30px_rgba(204,255,0,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingUsername ? 'Speichert...' : 'Archetypen herausfinden'}
            </button>
          </section>
        </div>
      </div>
    )
  }

  if (!assignedArchetype) {
    return (
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0f1419] px-6 py-10 text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:px-10 md:py-12">
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#ff006e]/15 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-5rem] top-1/2 h-72 w-72 rounded-full bg-[#00f2ff]/12 blur-[130px]" />

        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,242,255,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 md:p-8">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#ccff00]" />
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-300">Archetypen-Quiz</p>
            </div>
            <h1 className="mt-6 text-4xl font-black uppercase leading-[0.95] md:text-6xl xl:text-7xl">
              Finde deinen Archetyp.
              <span className="mt-2 block text-[#ff006e]">Starte dein A-Game.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              Der Funnel und die Funktionen bleiben gleich. Wir setzen die Startseite nur visuell in die neue Richtung um.
            </p>
            <div className="mt-10 flex flex-nowrap items-center gap-3 overflow-x-auto pb-2">
              {flowSteps.map((step, index) => (
                <div key={step} className="flex shrink-0 items-center gap-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white md:min-w-[150px] md:text-base">
                    {step}
                  </div>
                  {index < flowSteps.length - 1 ? <ChevronUp className="h-5 w-5 rotate-90 text-[#00f2ff]" /> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">Next Step</p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight md:text-4xl">Welche Route passt zu deinem Stil?</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 md:text-base">
              Fuenf Fragen reichen, damit dein Gameplan nicht nach Zufall wirkt.
            </p>
            <button
              onClick={() => router.push('/archetype-test')}
              className="mt-6 inline-flex w-full items-center justify-center rounded-[1.4rem] bg-[#ff006e] px-6 py-4 text-lg font-black uppercase tracking-[0.12em] text-white shadow-[0_0_28px_rgba(255,0,110,0.32)] transition hover:-translate-y-0.5"
            >
              Archetypen herausfinden
            </button>
          </section>
        </div>
      </div>
    )
  }

  if (!hasGym) {
    return (
      <div className="flex min-h-[calc(100vh-110px)] items-center justify-center">
        <section className="w-full max-w-5xl rounded-[2.8rem] border border-bjj-border bg-[#120f0d] px-6 py-10 shadow-card md:px-10 md:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-bjj-gold">Step 2</p>
          <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">Erstelle dein Gym</h1>
          <p className="mt-4 max-w-2xl text-lg text-bjj-muted">
            Trage dein Gym direkt ein. Du prüfst es später als Admin und bestätigst dann, ob es wirklich existiert.
          </p>

          <div className="mt-8 max-w-2xl">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Gym-Name</label>
            <input
              value={manualGymName}
              onChange={(event) => setManualGymName(event.target.value)}
              placeholder="z. B. Fightschool Hannover oder Unisport Grappling Berlin"
              className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-card px-5 py-4 text-lg text-white outline-none placeholder:text-bjj-muted"
            />
            <p className="mt-3 text-sm text-bjj-muted">
              Erlaubt sind BJJ-Gyms, MMA-Gyms, Vereine, Universitäten, Sporthallen oder Fitnessstudios mit Grappling/BJJ-Angebot.
            </p>
            {gymError ? <p className="mt-3 text-sm text-red-300">{gymError}</p> : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void saveGymAndContinue()}
                disabled={savingGym || !manualGymName.trim()}
                className="rounded-xl bg-bjj-gold px-6 py-3 text-base font-black text-bjj-coal disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingGym ? 'Speichert...' : 'Gym erstellen'}
              </button>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-bjj-border bg-bjj-card/70 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-bjj-gold">Optional</p>
            <p className="mt-2 text-sm text-bjj-muted">
              Wenn du spaeter doch Google-Vorschlaege nutzen willst, kannst du die Suche wieder aktivieren.
            </p>
            <button
              type="button"
              onClick={() => setManualGymMode(false)}
              className="mt-4 rounded-xl border border-bjj-border bg-bjj-surface px-5 py-3 text-sm font-semibold text-bjj-muted"
            >
              Google-Suche oeffnen
            </button>
          </div>

          {!manualGymMode ? (
            <div className="mt-8">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-bjj-gold">Gym suchen</label>
              <input value={gymQuery} onChange={(event) => { setGymQuery(event.target.value); setSelectedGym(null) }} placeholder="z. B. Fightschool Hannover" className="mt-3 w-full rounded-2xl border border-bjj-border bg-bjj-card px-5 py-4 text-lg text-white outline-none placeholder:text-bjj-muted" />
              {gymLoading ? <p className="mt-3 text-sm text-bjj-muted">Gym-Vorschlaege werden geladen...</p> : null}
              {gymError ? <p className="mt-3 text-sm text-red-300">{gymError}</p> : null}

              {gymSuggestions.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-bjj-border bg-bjj-card">
                  {gymSuggestions.map((suggestion) => (
                    <button key={suggestion.placeId} type="button" onClick={() => void selectGymSuggestion(suggestion)} className="flex w-full items-start justify-between gap-4 border-b border-white/10 px-5 py-4 text-left last:border-b-0 hover:bg-white/5">
                      <div>
                        <p className="text-lg font-semibold text-white">{suggestion.name}</p>
                        <p className="mt-1 text-sm text-bjj-muted">{suggestion.secondaryText || suggestion.description}</p>
                      </div>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-bjj-muted">{suggestion.types[0] ?? 'Place'}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedGym ? (
                <div className="mt-5 rounded-2xl border border-bjj-gold/30 bg-bjj-gold/10 p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-bjj-gold">Ausgewaehlt</p>
                  <p className="mt-2 text-xl font-black text-white">{selectedGym.name}</p>
                  <p className="mt-2 text-sm text-bjj-muted">{selectedGym.location}</p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void saveGymAndContinue()} disabled={savingGym || !selectedGym} className="rounded-xl bg-bjj-gold px-6 py-3 text-base font-black text-bjj-coal disabled:cursor-not-allowed disabled:opacity-50">
                  {savingGym ? 'Speichert...' : 'Google-Gym uebernehmen'}
                </button>
                <button type="button" onClick={() => { setManualGymMode(true); setGymSuggestions([]); setSelectedGym(null); setGymError(null) }} className="rounded-xl border border-bjj-border bg-bjj-card px-6 py-3 text-sm font-semibold text-bjj-muted">
                  Zurueck zu manueller Erstellung
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  if (!primaryCard) return null

  return (
    <div className="space-y-5">
      {pendingValidation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-[1.6rem] border border-bjj-border bg-bjj-card p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bjj-gold">Verifikation</p>
            <p className="mt-2 text-2xl font-black text-white">{pendingValidation.question}</p>
            <div className="mt-5 grid gap-3">
              {pendingValidation.options.map((option) => (
                <button key={option} type="button" onClick={() => void handleValidationAnswer(option)} className="w-full rounded-xl border border-bjj-border bg-bjj-surface px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-bjj-gold/40">
                  {option}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPendingValidation(null)} className="mt-5 text-xs font-semibold text-bjj-muted underline-offset-4 hover:underline">
              Spaeter beantworten
            </button>
          </div>
        </div>
      ) : null}
      {validationFeedback ? (
        <div className="rounded-[1.2rem] border border-bjj-gold/20 bg-bjj-gold/10 px-5 py-3 text-sm text-bjj-text">
          {validationFeedback}
        </div>
      ) : null}
      <div className="relative overflow-hidden rounded-[2.2rem] border border-white/8 bg-[linear-gradient(180deg,#0f1419,#090d13)] shadow-[0_28px_70px_rgba(0,0,0,0.34)]">
        <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-[#ff006e]/12 blur-[110px]" />
        <div className="pointer-events-none absolute right-[-4rem] top-1/3 h-72 w-72 rounded-full bg-[#00f2ff]/12 blur-[120px]" />

        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.9fr]">
          <section className="border-b border-white/5 lg:border-b-0 lg:border-r lg:border-white/5">
            <div className="relative overflow-hidden bg-black">
              <div className="relative">
                <YoutubeEmbed title={primaryCard.clipTitle} url={primaryCard.clipUrl} />

                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-[#0f1419]/88 via-[#0f1419]/30 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-[#0f1419] via-[#0f1419]/70 to-transparent" />

                <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-4 md:left-6 md:right-6 md:top-6">
                  <div className="max-w-[70%]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-[#00f2ff]/30 bg-[#00f2ff]/15 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#00f2ff] md:text-[10px]">
                        {primaryCard.categoryTag}
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-200 md:text-[10px]">
                        {primaryCard.levelTag}
                      </span>
                    </div>
                    <h1 className="mt-3 text-2xl font-black uppercase leading-[0.92] text-white md:text-4xl lg:text-5xl">
                      {primaryCard.title}
                    </h1>
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 backdrop-blur-md">
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 md:flex">
                      <Sparkles className="h-4 w-4 text-[#ff006e]" />
                      {comments.length} Kommentare
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 z-20 md:bottom-6 md:left-6 md:right-6">
                  <div className="flex items-end justify-between gap-4">
                    <div className="max-w-xl">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/55 md:text-xs">Heute im Fokus</p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-white/85 md:text-base">
                        {primaryCard.description}
                      </p>
                    </div>
                    <div className="hidden flex-col items-end gap-2 md:flex">
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                        Node {primaryCard.nodeId}
                      </div>
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                        Queue Active
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#ff006e,#00f2ff)] shadow-[0_0_18px_rgba(255,0,110,0.4)]"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 py-4 md:hidden">
              <button
                type="button"
                disabled={savingId === primaryCard.id}
                onClick={() => void submitQueueResult(primaryCard, 'not_yet')}
                className="group flex min-h-[118px] flex-col items-center justify-center rounded-[1.7rem] border border-blue-400/25 bg-[#18304d]/70 px-4 py-5 text-center shadow-[0_12px_28px_rgba(24,48,77,0.28)] transition hover:border-blue-300/45 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-400/10 text-blue-300">
                  <X className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.26em] text-blue-300/65">Instruction Loop</p>
                <p className="mt-1 text-lg font-black uppercase text-white">Kann ich nicht</p>
              </button>

              <button
                type="button"
                disabled={savingId === primaryCard.id}
                onClick={() => void submitQueueResult(primaryCard, 'known')}
                className="group flex min-h-[118px] flex-col items-center justify-center rounded-[1.7rem] border border-[#ccff00]/45 bg-[linear-gradient(135deg,rgba(204,255,0,0.94),rgba(173,255,47,0.8))] px-4 py-5 text-center shadow-[0_0_35px_rgba(204,255,0,0.2)] transition hover:shadow-[0_0_55px_rgba(204,255,0,0.26)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white/30 text-black">
                  <Check className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.26em] text-black/55">Unlock Sequence</p>
                <p className="mt-1 text-lg font-black uppercase text-black">Kann ich</p>
              </button>
            </div>

            <div className="space-y-5 px-4 py-5 md:px-6 md:py-6">
              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="landing-glass-card rounded-[1.8rem] p-5 md:p-6">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] text-[#00f2ff]">
                    <Play className="h-4 w-4" />
                    Technik Analyse
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-white/72 md:text-base">
                    {primaryCard.principle}
                  </p>
                  {spotlightDetail ? (
                    <div className="mt-5 rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">{spotlightDetail.label}</p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-white/88">{spotlightDetail.items[0]}</p>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4">
                  <div className="landing-glass-card rounded-[1.8rem] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Coach</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff006e,#00f2ff)] text-sm font-black text-white">
                        {coachInitials || 'CJ'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">Craig Jones</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Lead Coach</p>
                      </div>
                    </div>
                  </div>

                  {supportDetail ? (
                    <div className="landing-glass-card rounded-[1.8rem] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">{supportDetail.label}</p>
                      <p className="mt-3 text-sm font-semibold leading-relaxed text-white/88">{supportDetail.items[0]}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
            <header className="landing-glass-card rounded-[1.9rem] p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#ff006e]/20 bg-[#ff006e]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#ff7eb5]">
                  Start Queue
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                  {displayName}
                </span>
                <span className="ml-auto rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  {assignedArchetype?.name ?? 'Archetyp offen'}
                </span>
              </div>

              <h2 className="mt-5 text-3xl font-black uppercase leading-[0.95] text-white md:text-4xl">
                Trainiere den naechsten Hebel
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/68 md:text-base">
                Bewerte ehrlich, ob der Schritt schon sitzt. So bleibt dein Plan klar und dein Feed relevant.
              </p>
            </header>

            <div className="grid grid-cols-3 gap-3">
              <div className="landing-glass-card rounded-[1.5rem] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Completed</p>
                <p className="mt-2 text-2xl font-black text-white">{completedIds.length}</p>
              </div>
              <div className="landing-glass-card rounded-[1.5rem] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Validated</p>
                <p className="mt-2 text-2xl font-black text-white">{validatedIds.length}</p>
              </div>
              <div className="landing-glass-card rounded-[1.5rem] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Comments</p>
                <p className="mt-2 text-2xl font-black text-white">{comments.length}</p>
              </div>
            </div>

            <div className="hidden gap-3 sm:grid-cols-2 lg:grid-cols-1 md:grid">
              <button
                type="button"
                disabled={savingId === primaryCard.id}
                onClick={() => void submitQueueResult(primaryCard, 'not_yet')}
                className="group flex min-h-[108px] flex-col items-center justify-center rounded-[1.7rem] border border-blue-400/20 bg-[#18304d]/45 px-5 py-5 text-center transition hover:border-blue-400/40 hover:bg-[#1a3452] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-400/10 text-blue-300">
                  <X className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.26em] text-blue-300/65">Instruction Loop</p>
                <p className="mt-1 text-lg font-black uppercase text-white">Kann ich nicht</p>
              </button>

              <button
                type="button"
                disabled={savingId === primaryCard.id}
                onClick={() => void submitQueueResult(primaryCard, 'known')}
                className="group flex min-h-[108px] flex-col items-center justify-center rounded-[1.7rem] border border-[#ccff00]/45 bg-[linear-gradient(135deg,rgba(204,255,0,0.92),rgba(173,255,47,0.78))] px-5 py-5 text-center shadow-[0_0_35px_rgba(204,255,0,0.18)] transition hover:shadow-[0_0_55px_rgba(204,255,0,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white/30 text-black">
                  <Check className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.26em] text-black/55">Unlock Sequence</p>
                <p className="mt-1 text-lg font-black uppercase text-black">Kann ich</p>
              </button>
            </div>

            <div className="landing-glass-card rounded-[1.8rem] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Schnellzugriff</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/node/${primaryCard.nodeId}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/70 transition hover:text-white">
                  Node Detail
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <a href={primaryCard.clipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/70 transition hover:text-white">
                  YouTube
                  <Share2 className="h-4 w-4" />
                </a>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  System Active
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {/* Legacy layout kept for rollback
      <div className="start-layout-replace">
        responseActions={
          <>
            <button type="button" disabled={savingId === primaryCard.id} onClick={() => void submitQueueResult(primaryCard, 'not_yet')} className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-bjj-border bg-bjj-surface text-5xl font-black text-[#ff6b6b] transition-colors hover:border-bjj-gold/30 disabled:cursor-not-allowed disabled:text-bjj-muted">✕</button>
            <button type="button" disabled={savingId === primaryCard.id} onClick={() => void submitQueueResult(primaryCard, 'known')} className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-bjj-border bg-bjj-surface text-5xl font-black text-[#41d36c] transition-colors hover:border-bjj-gold/30 disabled:cursor-not-allowed disabled:text-bjj-muted">✓</button>
          </>
        }
        metaActions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={primaryCard.clipUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-[linear-gradient(90deg,#8f4ad0,#3c87f0)] px-4 py-2 text-xs font-black text-white">Open in YouTube</a>
            <Link href={`/node/${primaryCard.nodeId}`} className="inline-flex rounded-lg border border-[#606983] bg-[#2c3447] px-4 py-2 text-xs font-black text-white">Node oeffnen</Link>
          </div>
        }
      />
      */}
      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,25,34,0.98),rgba(12,16,23,0.98))] shadow-[0_20px_50px_rgba(0,0,0,0.26)]">
        <div className="border-b border-white/10 px-5 py-5 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-2xl font-black uppercase text-white md:text-3xl">Kommentare <span className="text-white/35">({comments.length})</span></p>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/45 md:flex">
              <ChevronUp className="h-4 w-4" />
              Reel Thread
            </div>
          </div>
        </div>
        <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-5 py-5 md:px-6">
          <div className="rounded-[1.8rem] border border-white/10 bg-black/15 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:p-5">
            <div className="flex items-start gap-3">
              {startState?.avatarUrl ? (
                <img src={startState.avatarUrl} alt={displayName} className="h-11 w-11 rounded-2xl object-cover border border-white/10" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff006e,#00f2ff)] text-sm font-black text-white">
                  {coachInitials || 'BJ'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">In die Diskussion gehen</p>
                <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={3} placeholder="Was ist dir bei der Technik aufgefallen?" className="mt-3 w-full rounded-2xl border border-white/10 bg-[#151d2a] px-4 py-4 text-sm text-white outline-none placeholder:text-bjj-muted" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Feedback, Fragen oder eigene Sparring-Erfahrung</p>
                  <button type="button" disabled={submittingComment || !commentDraft.trim()} onClick={() => void submitComment()} className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#ff006e,#00f2ff)] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-50">
                    Kommentar senden
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {comments.length > 0 ? (
          <div className="max-h-[720px] overflow-auto bg-[radial-gradient(circle_at_top,rgba(255,0,110,0.04),transparent_28%)] px-3 py-3 md:px-4">
            {comments.map((comment) => (
              <div key={comment.id} className="mb-3 rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] last:mb-0 md:px-5 md:py-5">
                <div className="flex items-start gap-3">
                  {comment.avatarUrl ? <img src={comment.avatarUrl} alt={comment.author} className="h-11 w-11 rounded-2xl object-cover border border-white/10" /> : <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#394258] text-sm font-black text-white">{comment.author.slice(0, 2).toUpperCase()}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-black uppercase text-white">{comment.author}</p>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{comment.meta}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#dbe3f1] md:text-base">{comment.text}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {commentFeaturesReady ? (
                        <>
                          <button type="button" onClick={() => void submitReaction(comment.id, 1)} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${comment.userReaction === 1 ? 'bg-[#20452c] text-[#8ff0b0]' : 'bg-[#1a2130] text-bjj-muted'}`}>👍 <span>{comment.likes}</span></button>
                          <button type="button" onClick={() => void submitReaction(comment.id, -1)} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${comment.userReaction === -1 ? 'bg-[#482426] text-[#ff9a9a]' : 'bg-[#1a2130] text-bjj-muted'}`}>👎 <span>{comment.dislikes}</span></button>
                        </>
                      ) : null}
                      <button type="button" onClick={() => setExpandedReplies((current) => ({ ...current, [comment.id]: !current[comment.id] }))} className="rounded-full bg-[#1a2130] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-bjj-muted">
                        {expandedReplies[comment.id] ? 'Antworten einklappen' : `Antworten${comment.replies.length ? ` (${comment.replies.length})` : ''}`}
                      </button>
                    </div>
                    <div className="mt-4 border-l border-white/10 pl-4 md:pl-5">
                      {expandedReplies[comment.id] && comment.replies.length > 0 ? (
                        <div className="space-y-3">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-3 rounded-2xl bg-black/10 px-3 py-3">
                              {reply.avatarUrl ? <img src={reply.avatarUrl} alt={reply.author} className="h-9 w-9 rounded-2xl object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#394258] text-xs font-black text-white">{reply.author.slice(0, 2).toUpperCase()}</div>}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3"><p className="text-sm font-black uppercase text-white">{reply.author}</p><span className="text-[10px] uppercase tracking-[0.16em] text-bjj-muted">{reply.meta}</span></div>
                                <p className="mt-1 text-sm leading-relaxed text-[#dbe3f1]">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {commentFeaturesReady ? (
                        <div className="mt-3 space-y-2">
                            <textarea value={replyDrafts[comment.id] ?? ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))} rows={2} placeholder="Antworten..." className="w-full rounded-2xl border border-white/10 bg-[#151d2a] px-4 py-3 text-sm text-white outline-none placeholder:text-bjj-muted" />
                            <button type="button" disabled={submittingReplyId === comment.id || !(replyDrafts[comment.id] ?? '').trim()} onClick={() => void submitReply(comment.id)} className="inline-flex rounded-xl bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-50">Antworten</button>
                          </div>
                        ) : null}
                      </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : <div className="px-5 py-8 text-sm text-bjj-muted md:px-6">Noch keine Kommentare. Sei der Erste, der etwas zum Node schreibt.</div>}
      </section>
      {feedback ? <div className="rounded-[1.6rem] border border-bjj-gold/20 bg-bjj-gold/10 px-5 py-4 text-sm text-bjj-text">{feedback}</div> : null}
    </div>
  )
}
