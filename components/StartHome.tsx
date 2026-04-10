'use client'

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Check, ChevronUp, MapPinned, MessageCircle, Play, ShieldCheck, Sparkles, X } from 'lucide-react'
import { ARCHETYPES } from '@/lib/archetypes'
import type { ResolvedGameplan } from '@/lib/gameplans'
import { createClient } from '@/lib/supabase/client'
import { waitForAuthenticatedUser } from '@/lib/supabase/auth-guard'
import { buildStartQueue, type ClipResult, type QueueCard, type QueueEvent } from '@/lib/start-queue'
import { YoutubeEmbed } from '@/components/YoutubeEmbed'
import { getNodeById } from '@/lib/nodes'
import { getFlagSvgUrl } from '@/lib/countries'

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
  nationality?: string | null
  likes: number
  dislikes: number
  userReaction: 1 | -1 | null
  replies: ClipReply[]
  parentReplyId?: string | null
}

type ClipComment = {
  id: string
  userId: string
  author: string
  text: string
  meta: string
  avatarUrl?: string | null
  nationality?: string | null
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

type QueueTransitionPhase = 'idle' | 'out' | 'prepare'

function extractYoutubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match?.[1] ?? null
}

function getClipPreviewImage(url: string) {
  const youtubeId = extractYoutubeId(url)
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
  }

  return null
}

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
  const [replyingToReply, setReplyingToReply] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [commentFeaturesReady, setCommentFeaturesReady] = useState(true)
  const [activePlan, setActivePlan] = useState<ResolvedGameplan | null>(null)
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
  const [displayCard, setDisplayCard] = useState<QueueCard | null>(null)
  const [transitionPhase, setTransitionPhase] = useState<QueueTransitionPhase>('idle')
  const [isFlying, setIsFlying] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [barPulseActive, setBarPulseActive] = useState(false)
  const [progressCountFlash, setProgressCountFlash] = useState(false)
  const [unlockSequence, setUnlockSequence] = useState<{ previousTitle: string; nextTitle: string; nextLabel: string } | null>(null)
  const [flyingVideoStyle, setFlyingVideoStyle] = useState<CSSProperties | null>(null)
  const videoShellRef = useRef<HTMLDivElement | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const swapTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const unlockTimerRef = useRef<number | null>(null)
  const hasInitializedDisplayCardRef = useRef(false)
  const unlockSnapshotRef = useRef<{
    currentNodeId: string | null
    currentSourceNodeId: string | null
    title: string | null
    progressCompletedRules: number
    progressTotalRules: number
  } | null>(null)

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

  const loadActivePlan = useCallback(async () => {
    try {
      const response = await fetch('/api/gameplan/active', { cache: 'no-store' })
      const payload = (await response.json()) as { plan?: ResolvedGameplan }
      if (!response.ok || !payload.plan) {
        setActivePlan(null)
        return
      }
      setActivePlan(payload.plan)
    } catch {
      setActivePlan(null)
    }
  }, [])

  useEffect(() => {
    void loadActivePlan()
  }, [loadActivePlan])

  const assignedArchetype = ARCHETYPES.find((item) => item.id === startState?.primaryArchetype) ?? null
  const queue = useMemo(() => buildStartQueue(completedIds, events, activePlan), [activePlan, completedIds, events])
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
  const visibleCard = displayCard ?? primaryCard ?? null
  const activePlanNode = useMemo(() => {
    const currentNodeId = activePlan?.unlockSummary.currentNodeId
    if (!currentNodeId) return null
    return activePlan?.nodes[currentNodeId] ?? null
  }, [activePlan])
  const currentTechniqueProgress = useMemo(() => {
    if (activePlanNode) {
      const completed = activePlanNode.progressCompletedRules ?? 0
      const total = activePlanNode.progressTotalRules ?? 0
      return {
        completed,
        total,
        percent: total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0,
      }
    }

    const fallbackNode = visibleCard ? getNodeById(visibleCard.nodeId) : null
    return {
      completed: 0,
      total: fallbackNode?.completionRules.length ?? 0,
      percent: 0,
    }
  }, [activePlanNode, visibleCard])
  const visiblePreviewImage = visibleCard ? getClipPreviewImage(visibleCard.clipUrl) : null
  const spotlightDetail = quickDetails[0]
  const supportDetail = quickDetails[1]

  useEffect(() => {
    if (!activePlan) return

    const currentNodeId = activePlan.unlockSummary.currentNodeId
    const currentSourceNodeId = activePlan.unlockSummary.currentSourceNodeId
    const currentNode = currentNodeId ? activePlan.nodes[currentNodeId] ?? null : null
    const nextSnapshot = {
      currentNodeId,
      currentSourceNodeId,
      title: currentNode?.title ?? null,
      progressCompletedRules: currentNode?.progressCompletedRules ?? 0,
      progressTotalRules: currentNode?.progressTotalRules ?? 0,
    }

    const previousSnapshot = unlockSnapshotRef.current
    unlockSnapshotRef.current = nextSnapshot

    if (!previousSnapshot) {
      return
    }

    const unlockedNewNode =
      previousSnapshot.currentNodeId !== nextSnapshot.currentNodeId ||
      previousSnapshot.currentSourceNodeId !== nextSnapshot.currentSourceNodeId
    const previousNodeFullyCharged =
      previousSnapshot.progressTotalRules > 0 &&
      previousSnapshot.progressCompletedRules === previousSnapshot.progressTotalRules

    if (!unlockedNewNode || !previousNodeFullyCharged || !currentNode) {
      return
    }

    setUnlockSequence({
      previousTitle: previousSnapshot.title ?? 'Vorheriger Schritt',
      nextTitle: currentNode.title,
      nextLabel: currentNode.label,
    })
    triggerProgressPulse()

    if (unlockTimerRef.current) {
      window.clearTimeout(unlockTimerRef.current)
    }

    unlockTimerRef.current = window.setTimeout(() => {
      setUnlockSequence(null)
    }, 2400)
  }, [activePlan])

  useEffect(() => {
    if (swapTimerRef.current) {
      window.clearTimeout(swapTimerRef.current)
      swapTimerRef.current = null
    }
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    if (unlockTimerRef.current) {
      window.clearTimeout(unlockTimerRef.current)
      unlockTimerRef.current = null
    }

    if (!primaryCard) {
      setDisplayCard(null)
      setUnlockSequence(null)
      hasInitializedDisplayCardRef.current = false
      return
    }

    if (!hasInitializedDisplayCardRef.current || !displayCard) {
      hasInitializedDisplayCardRef.current = true
      setDisplayCard(primaryCard)
      setTransitionPhase('idle')
      return
    }

    if (displayCard.id === primaryCard.id) {
      if (transitionPhase !== 'idle') {
        setTransitionPhase('idle')
      }
      return
    }

    setTransitionPhase('out')

    swapTimerRef.current = window.setTimeout(() => {
      setDisplayCard(primaryCard)
      setTransitionPhase('prepare')

      settleTimerRef.current = window.setTimeout(() => {
        setTransitionPhase('idle')
      }, 50)
    }, 400)
  }, [displayCard, primaryCard, transitionPhase])

  useEffect(() => {
    return () => {
      if (swapTimerRef.current) {
        window.clearTimeout(swapTimerRef.current)
      }
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current)
      }
      if (unlockTimerRef.current) {
        window.clearTimeout(unlockTimerRef.current)
      }
    }
  }, [])

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
    const userIds = Array.from(new Set((commentData ?? []).map((entry) => entry.user_id).filter(Boolean)))
    
    const [reactionsRes, repliesRes, replyReactionsRes, userProfilesRes] = await Promise.all([
      commentIds.length ? supabase.from('clip_comment_reactions').select('comment_id, user_id, value').in('comment_id', commentIds) : { data: [], error: null },
      commentIds.length ? supabase.from('clip_comment_replies').select('id, comment_id, user_id, author_name, author_avatar_url, content, created_at, parent_reply_id').in('comment_id', commentIds).order('created_at', { ascending: true }) : { data: [], error: null },
      supabase.from('clip_comment_reply_reactions').select('reply_id, user_id, value'),
      userIds.length ? supabase.from('user_profiles').select('id, nationality').in('id', userIds) : { data: [], error: null },
    ])

    const reactionData = reactionsRes.data ?? []
    const replyData = repliesRes.data ?? []
    const replyReactionData = replyReactionsRes.data ?? []
    const userProfilesData = userProfilesRes.data ?? []
    const reactionError = reactionsRes.error || repliesRes.error

    // Map user_id to nationality
    const userNationalityMap = new Map<string, string>()
    userProfilesData.forEach((profile: any) => {
      if (profile.id && profile.nationality) {
        userNationalityMap.set(profile.id, profile.nationality)
      }
    })

    setCommentFeaturesReady(!reactionError)

    // Build nested reply structure
    const buildReplyTree = (replies: any[], parentReplyId: string | null = null): ClipReply[] => {
      const directReplies = replies.filter((r) => (r.parent_reply_id ?? null) === parentReplyId)
      return directReplies.map((reply) => ({
        id: reply.id,
        author: reply.author_name,
        avatarUrl: reply.author_avatar_url,
        text: reply.content,
        meta: formatRelativeTime(reply.created_at),
        nationality: reply.user_id ? userNationalityMap.get(reply.user_id) ?? null : null,
        likes: replyReactionData.filter((r: any) => r.reply_id === reply.id && r.value === 1).length,
        dislikes: replyReactionData.filter((r: any) => r.reply_id === reply.id && r.value === -1).length,
        userReaction: replyReactionData.find((r: any) => r.reply_id === reply.id && r.user_id === startState.userId)?.value ?? null,
        replies: buildReplyTree(replies, reply.id),
        parentReplyId: reply.parent_reply_id,
      }))
    }

    setComments((commentData ?? []).map((entry) => ({
      id: entry.id,
      userId: entry.user_id,
      author: entry.author_name,
      avatarUrl: entry.author_avatar_url,
      text: entry.content,
      meta: formatRelativeTime(entry.created_at),
      nationality: entry.user_id ? userNationalityMap.get(entry.user_id) ?? null : null,
      likes: reactionData.filter((reaction: any) => reaction.comment_id === entry.id && reaction.value === 1).length,
      dislikes: reactionData.filter((reaction: any) => reaction.comment_id === entry.id && reaction.value === -1).length,
      userReaction: reactionData.find((reaction: any) => reaction.comment_id === entry.id && reaction.user_id === startState.userId)?.value ?? null,
      replies: buildReplyTree(replyData.filter((r: any) => r.comment_id === entry.id)),
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
    await loadActivePlan()
  }

  function triggerProgressPulse() {
    setBarPulseActive(false)
    setProgressCountFlash(false)

    window.setTimeout(() => {
      setBarPulseActive(true)
      setProgressCountFlash(true)

      window.setTimeout(() => setBarPulseActive(false), 700)
      window.setTimeout(() => setProgressCountFlash(false), 650)
    }, 10)
  }

  function buildFlyingVideoStyle() {
    const videoRect = videoShellRef.current?.getBoundingClientRect()
    const progressRect = progressBarRef.current?.getBoundingClientRect()

    if (!videoRect || !progressRect) {
      return null
    }

    const translateX = progressRect.left + progressRect.width / 2 - (videoRect.left + videoRect.width / 2)
    const translateY = progressRect.top + progressRect.height / 2 - (videoRect.top + videoRect.height / 2)

    return {
      left: `${videoRect.left}px`,
      top: `${videoRect.top}px`,
      width: `${videoRect.width}px`,
      height: `${videoRect.height}px`,
      '--video-fall-x': `${translateX}px`,
      '--video-fall-y': `${translateY}px`,
    } as CSSProperties
  }

  function handleAnimatedQueueAction(result: ClipResult) {
    if (!visibleCard || savingId === visibleCard.id || transitionPhase !== 'idle' || isFlying || isShaking) {
      return
    }

    if (result === 'known' && !validatedIds.includes(visibleCard.nodeId)) {
      const node = getNodeById(visibleCard.nodeId)
      if (node?.validationQuestion && node.validationOptions?.length && node.validationCorrectAnswer) {
        void submitQueueResult(visibleCard, result)
        return
      }
    }

    if (result === 'known') {
      setFlyingVideoStyle(buildFlyingVideoStyle())
      setIsFlying(true)
      triggerProgressPulse()
      window.setTimeout(() => {
        setIsFlying(false)
        setFlyingVideoStyle(null)
      }, 820)
    } else {
      setIsShaking(true)
      window.setTimeout(() => setIsShaking(false), 420)
    }

    void submitQueueResult(visibleCard, result)
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

  async function submitReply(commentId: string, parentReplyId?: string) {
    if (!primaryCard || !replyDrafts[commentId]?.trim() || !startState) return
    setSubmittingReplyId(commentId)
    setFeedback(null)
    const authorName = startState.username ?? startState.fullName ?? startState.email?.split('@')[0] ?? 'BJJ Athlete'
    const insertData: any = {
      comment_id: commentId,
      user_id: startState.userId,
      author_name: authorName,
      author_avatar_url: startState.avatarUrl,
      content: replyDrafts[commentId].trim(),
    }
    if (parentReplyId) {
      insertData.parent_reply_id = parentReplyId
    }
    const { error } = await supabase.from('clip_comment_replies').insert(insertData)
    setSubmittingReplyId(null)
    if (error) {
      setFeedback(`Antwort konnte nicht gespeichert werden: ${error.message}`)
      return
    }
    setReplyDrafts((current) => ({ ...current, [commentId]: '' }))
    setExpandedReplies((current) => ({ ...current, [commentId]: true }))
    await loadComments(primaryCard.id)
  }

  async function submitReplyReaction(replyId: string, value: 1 | -1) {
    if (!startState) return
    const { error } = await supabase.from('clip_comment_reply_reactions').upsert({ reply_id: replyId, user_id: startState.userId, value }, { onConflict: 'reply_id,user_id' })
    if (error) {
      setFeedback(`Reaktion konnte nicht gespeichert werden: ${error.message}`)
      return
    }
    if (primaryCard) await loadComments(primaryCard.id)
  }

  async function submitNestedReply(commentId: string, parentReplyId: string) {
    if (!primaryCard || !replyDrafts[parentReplyId]?.trim() || !startState) return
    setSubmittingReplyId(parentReplyId)
    setFeedback(null)
    const authorName = startState.username ?? startState.fullName ?? startState.email?.split('@')[0] ?? 'BJJ Athlete'
    const { error } = await supabase.from('clip_comment_replies').insert({
      comment_id: commentId,
      parent_reply_id: parentReplyId,
      user_id: startState.userId,
      author_name: authorName,
      author_avatar_url: startState.avatarUrl,
      content: replyDrafts[parentReplyId].trim(),
    })
    setSubmittingReplyId(null)
    if (error) {
      setFeedback(`Antwort konnte nicht gespeichert werden: ${error.message}`)
      return
    }
    setReplyDrafts((current) => ({ ...current, [parentReplyId]: '' }))
    setReplyingToReply((current) => ({ ...current, [parentReplyId]: false }))
    await loadComments(primaryCard.id)
  }

  // Recursive component for nested replies
  function ReplyComponent({ reply, commentId, depth = 0 }: { reply: ClipReply; commentId: string; depth?: number }) {
    const isReplying = replyingToReply[reply.id] ?? false
    const hasNestedReplies = reply.replies && reply.replies.length > 0
    const isExpanded = expandedReplies[reply.id] ?? false
    
    return (
      <div className={`${depth > 0 ? 'ml-8 border-l-2 border-white/5 pl-3' : ''}`}>
        <div className="mb-3 flex gap-2">
          {reply.avatarUrl ? (
            <img src={reply.avatarUrl} alt={reply.author} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
              {reply.author.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {reply.nationality && (
                <img 
                  src={getFlagSvgUrl(reply.nationality ?? undefined) ?? undefined} 
                  alt={reply.nationality} 
                  className="h-4 w-6 rounded-[2px] object-cover"
                />
              )}
              <span className="text-sm font-semibold text-white">{reply.author}</span>
              <span className="text-xs text-white/50">{reply.meta}</span>
            </div>
            <p className="text-sm text-white/70">{reply.text}</p>
            {commentFeaturesReady && (
              <div className="mt-2 flex items-center gap-3">
                <button 
                  onClick={() => void submitReplyReaction(reply.id, 1)} 
                  className={`flex items-center gap-1 text-xs ${reply.userReaction === 1 ? 'text-bjj-gold' : 'text-white/40 hover:text-white/70'}`}
                >
                  👍 {reply.likes}
                </button>
                <button 
                  onClick={() => void submitReplyReaction(reply.id, -1)} 
                  className={`flex items-center gap-1 text-xs ${reply.userReaction === -1 ? 'text-red-400' : 'text-white/40 hover:text-white/70'}`}
                >
                  👎 {reply.dislikes}
                </button>
                <button 
                  onClick={() => setReplyingToReply((current) => ({ ...current, [reply.id]: !current[reply.id] }))} 
                  className="text-xs text-white/40 hover:text-white/70"
                >
                  Antworten
                </button>
                {hasNestedReplies && (
                  <button 
                    onClick={() => setExpandedReplies((current) => ({ ...current, [reply.id]: !current[reply.id] }))} 
                    className="text-xs text-white/40 hover:text-white/70"
                  >
                    {isExpanded ? 'Antworten ausblenden' : `Antworten (${reply.replies.length})`}
                  </button>
                )}
              </div>
            )}
            
            {/* Reply input for this reply */}
            {isReplying && commentFeaturesReady && (
              <div className="mt-3 flex gap-2">
                <textarea 
                  value={replyDrafts[reply.id] ?? ''} 
                  onChange={(event) => setReplyDrafts((current) => ({ ...current, [reply.id]: event.target.value }))} 
                  rows={1} 
                  placeholder="Antworten..." 
                  className="flex-1 resize-none border-b border-white/20 bg-transparent text-sm text-white outline-none placeholder:text-white/40 focus:border-bjj-gold"
                />
                <button 
                  type="button" 
                  disabled={submittingReplyId === reply.id || !(replyDrafts[reply.id] ?? '').trim()} 
                  onClick={() => void submitNestedReply(commentId, reply.id)} 
                  className="text-sm text-bjj-gold disabled:opacity-50"
                >
                  Senden
                </button>
              </div>
            )}
            
            {/* Nested replies */}
            {isExpanded && reply.replies?.map((nestedReply) => (
              <ReplyComponent key={nestedReply.id} reply={nestedReply} commentId={commentId} depth={depth + 1} />
            ))}
          </div>
        </div>
      </div>
    )
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

  if (!visibleCard) {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,25,36,0.96),rgba(12,16,24,0.95))] p-6">
          <div className="h-[320px] rounded-[1.2rem] bg-white/[0.04] shimmer" />
          <div className="mt-5 h-3 w-40 rounded-full bg-white/10" />
          <div className="mt-3 h-10 w-72 rounded-2xl bg-white/10" />
          <div className="mt-6 h-24 rounded-[1.1rem] bg-white/[0.04]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {unlockSequence ? (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          <div className="start-home-unlock-vignette absolute inset-0" />
          <div className="absolute inset-x-4 top-24 flex justify-center md:inset-x-8">
            <div className="start-home-unlock-banner max-w-xl rounded-full border border-bjj-gold/20 bg-[rgba(12,16,24,0.82)] px-5 py-3 text-center backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bjj-gold/75">Neue Technik freigeschaltet</p>
              <p className="mt-2 text-lg font-black text-white md:text-xl">{unlockSequence.nextTitle}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{unlockSequence.nextLabel}</p>
            </div>
          </div>
        </div>
      ) : null}
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
      {/* Clean YouTube-Style Layout */}
      <div className="space-y-6">
        {/* Title above Video */}
        <header
          className={`start-home-slide transition-all duration-500 ${transitionPhase === 'out' ? 'start-home-slide-out' : ''} ${transitionPhase === 'prepare' ? 'start-home-slide-in' : ''} ${unlockSequence ? 'start-home-unlock-focus' : ''}`}
        >
          <h1 className="text-xl font-bold text-white lg:text-2xl">{visibleCard.title}</h1>
        </header>

        <div className={`relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] start-home-slide transition-all duration-500 ${transitionPhase === 'out' ? 'start-home-slide-out' : ''} ${transitionPhase === 'prepare' ? 'start-home-slide-in' : ''} ${unlockSequence ? 'start-home-unlock-focus' : ''}`}>
          {/* Left: Video + Info */}
          <div className="space-y-4">
            {/* Video Player */}
            <div
              ref={videoShellRef}
              className={`start-home-video-shell overflow-hidden rounded-xl bg-black transition-all duration-500 ${isShaking ? 'start-home-shake' : ''} ${isFlying ? 'opacity-60 blur-[1px]' : ''}`}
            >
              <YoutubeEmbed title={visibleCard.clipTitle} url={visibleCard.clipUrl} />
            </div>

            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.22em] text-white/58">
                <span>Technik Fortschritt</span>
                <span className={progressCountFlash ? 'start-home-count-flash' : ''}>
                  {currentTechniqueProgress.completed}/{currentTechniqueProgress.total}
                </span>
              </div>
              <div ref={progressBarRef} className={`mt-3 h-2.5 overflow-hidden rounded-full bg-white/10 ${barPulseActive ? 'start-home-bar-pulse' : ''}`}>
                <div
                  className="start-home-progress-fill h-full rounded-full bg-[linear-gradient(90deg,#d99f5c,#f0c27b)]"
                  style={{ width: `${currentTechniqueProgress.percent}%` }}
                >
                  {isFlying ? (
                    <div className="mr-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white/35 bg-white/15 start-home-check-pop">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Mobile Buttons - Centered below video, same size */}
            <div className="flex justify-center gap-4 lg:hidden">
              <button
                type="button"
                disabled={savingId === visibleCard.id || transitionPhase !== 'idle' || isFlying || isShaking}
                onClick={() => handleAnimatedQueueAction('not_yet')}
                className={`start-home-action-btn start-home-action-btn-negative flex h-28 w-40 flex-col items-center justify-center rounded-xl text-center disabled:opacity-50 ${isShaking ? 'start-home-pressed' : ''}`}
              >
                <X className="h-8 w-8 text-red-400" />
                <p className="mt-2 text-base font-bold text-white">Kann ich nicht</p>
              </button>

              <button
                type="button"
                disabled={savingId === visibleCard.id || transitionPhase !== 'idle' || isFlying || isShaking}
                onClick={() => handleAnimatedQueueAction('known')}
                className={`start-home-action-btn start-home-action-btn-positive flex h-28 w-40 flex-col items-center justify-center rounded-xl text-center disabled:opacity-50 ${isFlying ? 'start-home-pressed' : ''}`}
              >
                <Check className="h-8 w-8 text-green-400" />
                <p className="mt-2 text-base font-bold text-white">Kann ich</p>
              </button>
            </div>

            {/* Video Info */}
            <div className="space-y-3 pt-2">
              {/* Links only - no tags */}
              <div className="flex flex-wrap gap-3">
                <Link 
                  href={`/node/${visibleCard.nodeId}`} 
                  className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Technik Details
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Right: Clean Action Buttons (Desktop) - Centered, same size */}
          <div className="hidden flex-col items-center justify-center gap-4 lg:flex">
            <button
              type="button"
              disabled={savingId === visibleCard.id || transitionPhase !== 'idle' || isFlying || isShaking}
              onClick={() => handleAnimatedQueueAction('not_yet')}
              className={`start-home-action-btn start-home-action-btn-negative flex h-36 w-56 flex-col items-center justify-center rounded-xl text-center disabled:opacity-50 ${isShaking ? 'start-home-pressed' : ''}`}
            >
              <X className="h-10 w-10 text-red-400" />
              <p className="mt-3 text-lg font-bold text-white">Kann ich nicht</p>
            </button>

            <button
              type="button"
              disabled={savingId === visibleCard.id || transitionPhase !== 'idle' || isFlying || isShaking}
              onClick={() => handleAnimatedQueueAction('known')}
              className={`start-home-action-btn start-home-action-btn-positive flex h-36 w-56 flex-col items-center justify-center rounded-xl text-center disabled:opacity-50 ${isFlying ? 'start-home-pressed' : ''}`}
            >
              <Check className="h-10 w-10 text-green-400" />
              <p className="mt-3 text-lg font-bold text-white">Kann ich</p>
            </button>
          </div>

          {isFlying && visiblePreviewImage ? (
            <div className="start-home-flying-video fixed overflow-hidden rounded-[1.5rem]" style={flyingVideoStyle ?? undefined}>
              <img src={visiblePreviewImage} alt={visibleCard.title} className="h-full w-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
            </div>
          ) : null}
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
            <a href={visibleCard.clipUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-[linear-gradient(90deg,#8f4ad0,#3c87f0)] px-4 py-2 text-xs font-black text-white">Open in YouTube</a>
            <Link href={`/node/${visibleCard.nodeId}`} className="inline-flex rounded-lg border border-[#606983] bg-[#2c3447] px-4 py-2 text-xs font-black text-white">Node oeffnen</Link>
          </div>
        }
      />
      */}
      {/* Simple YouTube-Style Comments */}
      <section className="mt-8 border-t border-white/10 pt-6">
        <h3 className="text-lg font-bold text-white">{comments.length} Kommentare</h3>
        
        {/* Comment Input */}
        <div className="mt-4 flex gap-3">
          {startState?.avatarUrl ? (
            <img src={startState.avatarUrl} alt={displayName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bjj-gold/20 text-sm font-bold text-bjj-gold">
              {coachInitials || 'BJ'}
            </div>
          )}
          <div className="flex-1">
            <textarea 
              value={commentDraft} 
              onChange={(event) => setCommentDraft(event.target.value)} 
              rows={2} 
              placeholder="Kommentar hinzufügen..." 
              className="w-full resize-none border-b border-white/20 bg-transparent pb-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-bjj-gold"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setCommentDraft('')} 
                className="rounded-full px-4 py-2 text-sm font-medium text-white/60 hover:text-white"
              >
                Abbrechen
              </button>
              <button 
                type="button" 
                disabled={submittingComment || !commentDraft.trim()} 
                onClick={() => void submitComment()} 
                className="rounded-full bg-bjj-gold px-4 py-2 text-sm font-bold text-bjj-coal disabled:opacity-50"
              >
                Kommentieren
              </button>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="mt-6 space-y-4">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {comment.avatarUrl ? (
                  <img src={comment.avatarUrl} alt={comment.author} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                    {comment.author.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {comment.nationality && (
                      <img 
                        src={getFlagSvgUrl(comment.nationality ?? undefined) ?? undefined} 
                        alt={comment.nationality} 
                        className="h-4 w-6 rounded-[2px] object-cover"
                      />
                    )}
                    <span className="font-semibold text-white">{comment.author}</span>
                    <span className="text-xs text-white/50">{comment.meta}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/80">{comment.text}</p>
                  {commentFeaturesReady && (
                    <div className="mt-2 flex items-center gap-4">
                      <button 
                        onClick={() => void submitReaction(comment.id, 1)} 
                        className={`flex items-center gap-1 text-xs ${comment.userReaction === 1 ? 'text-bjj-gold' : 'text-white/50 hover:text-white'}`}
                      >
                        👍 {comment.likes}
                      </button>
                      <button 
                        onClick={() => void submitReaction(comment.id, -1)} 
                        className={`flex items-center gap-1 text-xs ${comment.userReaction === -1 ? 'text-red-400' : 'text-white/50 hover:text-white'}`}
                      >
                        👎 {comment.dislikes}
                      </button>
                      <button 
                        onClick={() => setExpandedReplies((current) => ({ ...current, [comment.id]: !current[comment.id] }))} 
                        className="text-xs text-white/50 hover:text-white"
                      >
                        {expandedReplies[comment.id] ? 'Antworten ausblenden' : `Antworten ${comment.replies.length > 0 ? `(${comment.replies.length})` : ''}`}
                      </button>
                    </div>
                  )}
                  
                  {/* Replies */}
                  {expandedReplies[comment.id] && (
                    <div className="mt-3 pl-4 border-l-2 border-white/10">
                      {comment.replies.map((reply) => (
                        <ReplyComponent key={reply.id} reply={reply} commentId={comment.id} />
                      ))}
                      {commentFeaturesReady && (
                        <div className="flex gap-2">
                          <textarea 
                            value={replyDrafts[comment.id] ?? ''} 
                            onChange={(event) => setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))} 
                            rows={1} 
                            placeholder="Antworten..." 
                            className="flex-1 resize-none border-b border-white/20 bg-transparent text-sm text-white outline-none placeholder:text-white/40 focus:border-bjj-gold"
                          />
                          <button 
                            type="button" 
                            disabled={submittingReplyId === comment.id || !(replyDrafts[comment.id] ?? '').trim()} 
                            onClick={() => void submitReply(comment.id)} 
                            className="text-sm text-bjj-gold disabled:opacity-50"
                          >
                            Senden
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/50">Noch keine Kommentare. Sei der Erste!</p>
          )}
        </div>
      </section>
      {feedback ? <div className="rounded-[1.6rem] border border-bjj-gold/20 bg-bjj-gold/10 px-5 py-4 text-sm text-bjj-text">{feedback}</div> : null}
    </div>
  )
}
