'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Edit3, Eye, ImagePlus, Info, Play, Plus, Search, Shield, Target, Trash2, X } from 'lucide-react'
import type { TechniqueStage } from '@/components/technique-library/types'
import { ARCHETYPES } from '@/lib/archetypes'
import {
  CUSTOM_TECHNIQUES_EVENT,
  deleteCustomTechnique,
  readCustomTechniques,
  updateCustomTechnique,
  writeCustomTechniques,
  type CustomTechniqueRecord,
  type TechniqueCounter,
  type TechniqueDrill,
  type TechniqueStyleContent,
  type TechniqueStyleOverrides,
  type TechniqueVideo,
} from '@/lib/custom-techniques'
import { getTechniqueCoverageLabel, getTechniqueStyleLabel, type TechniqueStyle, type TechniqueStyleCoverage } from '@/lib/technique-style'
import { uploadTechniqueImage } from '@/lib/supabase/storage'

type TabId = 'basic' | 'videos' | 'counters' | 'drills' | 'keypoints' | 'errors'
type ContentMode = 'shared' | TechniqueStyle

const STAGE_LABELS: Record<TechniqueStage, string> = { position: 'Position', pass: 'Pass', submission: 'Submission' }
const COVERAGE_OPTIONS: TechniqueStyleCoverage[] = ['gi', 'nogi', 'both']

function getItemStyleLabel(styleCoverage: TechniqueStyleCoverage) {
  return getTechniqueCoverageLabel(styleCoverage)
}

function emptyOverrides(): TechniqueStyleOverrides {
  return { gi: {}, nogi: {} }
}

function cleanContent(value?: TechniqueStyleContent) {
  if (!value) return undefined
  const next: TechniqueStyleContent = {}
  if (value.description?.trim()) next.description = value.description
  if (value.videos?.length) next.videos = value.videos
  if (value.counters?.length) next.counters = value.counters
  if (value.drills?.length) next.drills = value.drills
  if (value.keyPoints?.length) next.keyPoints = value.keyPoints
  if (value.commonErrors?.length) next.commonErrors = value.commonErrors
  return Object.keys(next).length ? next : undefined
}

function cleanOverrides(value: TechniqueStyleOverrides) {
  const gi = cleanContent(value.gi)
  const nogi = cleanContent(value.nogi)
  return gi || nogi ? { ...(gi ? { gi } : {}), ...(nogi ? { nogi } : {}) } : undefined
}

export default function AdminTechniquesPage() {
  const [customTechniques, setCustomTechniques] = useState<CustomTechniqueRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const [contentMode, setContentMode] = useState<ContentMode>('shared')
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [stage, setStage] = useState<TechniqueStage>('position')
  const [styleCoverage, setStyleCoverage] = useState<TechniqueStyleCoverage>('both')
  const [styleOverrides, setStyleOverrides] = useState<TechniqueStyleOverrides>(emptyOverrides())
  const [image, setImage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videos, setVideos] = useState<TechniqueVideo[]>([])
  const [counters, setCounters] = useState<TechniqueCounter[]>([])
  const [drills, setDrills] = useState<TechniqueDrill[]>([])
  const [keyPoints, setKeyPoints] = useState<string[]>([])
  const [commonErrors, setCommonErrors] = useState<string[]>([])
  const [prerequisites, setPrerequisites] = useState<string[]>([])
  const [recommendedArchetypeIds, setRecommendedArchetypeIds] = useState<string[]>([])
  const [newVideo, setNewVideo] = useState({ title: '', url: '', platform: 'youtube' as TechniqueVideo['platform'] })
  const [newCounter, setNewCounter] = useState<{ title: string; description: string; styleCoverage: TechniqueStyleCoverage }>({
    title: '',
    description: '',
    styleCoverage: 'both',
  })
  const [newDrill, setNewDrill] = useState<{ title: string; description: string; duration: string; styleCoverage: TechniqueStyleCoverage }>({
    title: '',
    description: '',
    duration: '',
    styleCoverage: 'both',
  })
  const [newKeyPoint, setNewKeyPoint] = useState('')
  const [newError, setNewError] = useState('')
  const [newPrerequisite, setNewPrerequisite] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const sync = () => setCustomTechniques(readCustomTechniques())
    sync()
    window.addEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
    return () => window.removeEventListener(CUSTOM_TECHNIQUES_EVENT, sync)
  }, [])

  useEffect(() => {
    if (styleCoverage !== 'both' && contentMode !== 'shared') setContentMode('shared')
  }, [contentMode, styleCoverage])

  const currentOverride = contentMode === 'shared' ? undefined : styleOverrides[contentMode]
  const currentDescription = contentMode === 'shared' ? description : currentOverride?.description ?? ''
  const currentVideos = contentMode === 'shared' ? videos : currentOverride?.videos ?? []
  const currentCounters = contentMode === 'shared' ? counters : currentOverride?.counters ?? []
  const currentDrills = contentMode === 'shared' ? drills : currentOverride?.drills ?? []
  const currentKeyPoints = contentMode === 'shared' ? keyPoints : currentOverride?.keyPoints ?? []
  const currentCommonErrors = contentMode === 'shared' ? commonErrors : currentOverride?.commonErrors ?? []
  const editableModes: ContentMode[] = styleCoverage === 'both' ? ['shared', 'gi', 'nogi'] : ['shared']

  const filteredTechniques = useMemo(() => {
    if (!searchQuery.trim()) return customTechniques
    const query = searchQuery.toLowerCase()
    return customTechniques.filter((technique) =>
      [technique.title, technique.subtitle, technique.description, technique.styleOverrides?.gi?.description, technique.styleOverrides?.nogi?.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [customTechniques, searchQuery])

  function setOverridePatch(patch: Partial<TechniqueStyleContent>) {
    if (contentMode === 'shared') return
    setStyleOverrides((current) => ({ ...current, [contentMode]: { ...(current[contentMode] ?? {}), ...patch } }))
  }

  function resetForm() {
    setTitle('')
    setSubtitle('')
    setDescription('')
    setStage('position')
    setStyleCoverage('both')
    setStyleOverrides(emptyOverrides())
    setImage('')
    setImageFile(null)
    setVideos([])
    setCounters([])
    setDrills([])
    setKeyPoints([])
    setCommonErrors([])
    setPrerequisites([])
    setRecommendedArchetypeIds([])
    setEditingId(null)
    setContentMode('shared')
    setActiveTab('basic')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function loadTechniqueForEdit(technique: CustomTechniqueRecord) {
    setEditingId(technique.id)
    setTitle(technique.title)
    setSubtitle(technique.subtitle)
    setDescription(technique.description)
    setStage(technique.stage)
    setStyleCoverage(technique.styleCoverage)
    setStyleOverrides({ gi: technique.styleOverrides?.gi ?? {}, nogi: technique.styleOverrides?.nogi ?? {} })
    setImage(technique.image)
    setVideos(technique.videos)
    setCounters(technique.counters)
    setDrills(technique.drills)
    setKeyPoints(technique.keyPoints)
    setCommonErrors(technique.commonErrors)
    setPrerequisites(technique.prerequisites)
    setRecommendedArchetypeIds(technique.recommendedArchetypeIds ?? [])
    setContentMode('shared')
    setActiveTab('basic')
    setShowCreateForm(true)
  }

  async function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setImageFile(file)
    setImage(objectUrl)
  }

  function removeImage() {
    if (image.startsWith('blob:')) URL.revokeObjectURL(image)
    setImage('')
    setImageFile(null)
  }

  async function saveTechnique() {
    if (!title.trim()) return setMessage('Bitte einen Titel eingeben')
    setUploading(true)
    setMessage(null)
    let imageUrl = image

    if (imageFile) {
      const techniqueId = editingId || `custom-technique-${crypto.randomUUID().slice(0, 8)}`
      const result = await uploadTechniqueImage(imageFile, techniqueId)
      if (result.error || !result.url) {
        setMessage(result.error || 'Upload fehlgeschlagen')
        setUploading(false)
        return
      }
      imageUrl = result.url
    }

    const now = new Date().toISOString()
    const record: CustomTechniqueRecord = {
      id: editingId || `custom-technique-${crypto.randomUUID().slice(0, 8)}`,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Custom Technik',
      description: description.trim() || 'Neue Technik aus der Bibliothek.',
      image: imageUrl,
      stage,
      track: stage === 'position' ? 'foundation' : stage === 'pass' ? 'secondary' : 'top-game',
      creator: 'BJJMAXXING',
      fighter: 'BJJMAXXING',
      level: stage === 'submission' ? 5 : stage === 'pass' ? 3 : 2,
      videos,
      counters,
      drills,
      keyPoints,
      commonErrors,
      prerequisites,
      recommendedArchetypeIds,
      styleCoverage,
      styleOverrides: cleanOverrides(styleOverrides),
      createdAt: editingId ? customTechniques.find((item) => item.id === editingId)?.createdAt || now : now,
      updatedAt: now,
    }

    if (editingId) updateCustomTechnique(editingId, record)
    else writeCustomTechniques([record, ...customTechniques])

    setMessage(editingId ? 'Technik erfolgreich aktualisiert!' : 'Technik erfolgreich erstellt!')
    resetForm()
    setShowCreateForm(false)
    setUploading(false)
    setTimeout(() => setMessage(null), 3000)
  }

  function deleteItem(id: string) {
    if (!confirm('Moechtest du diese Technik wirklich loeschen?')) return
    deleteCustomTechnique(id)
    setMessage('Technik geloescht')
    setTimeout(() => setMessage(null), 3000)
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof Info }> = [
    { id: 'basic', label: 'Basis', icon: Info },
    { id: 'videos', label: `Videos ${currentVideos.length ? `(${currentVideos.length})` : ''}`, icon: Play },
    { id: 'counters', label: `Counter ${currentCounters.length ? `(${currentCounters.length})` : ''}`, icon: Shield },
    { id: 'drills', label: `Drills ${currentDrills.length ? `(${currentDrills.length})` : ''}`, icon: Target },
    { id: 'keypoints', label: `Key Points ${currentKeyPoints.length ? `(${currentKeyPoints.length})` : ''}`, icon: Check },
    { id: 'errors', label: `Fehler ${currentCommonErrors.length ? `(${currentCommonErrors.length})` : ''}`, icon: AlertTriangle },
  ]

  const modeLabel = (mode: ContentMode) => (mode === 'shared' ? 'Beide gemeinsam' : `${getTechniqueStyleLabel(mode)} Override`)

  const setCurrentDescription = (value: string) => (contentMode === 'shared' ? setDescription(value) : setOverridePatch({ description: value }))
  const setCurrentVideos = (value: TechniqueVideo[]) => (contentMode === 'shared' ? setVideos(value) : setOverridePatch({ videos: value }))
  const setCurrentCounters = (value: TechniqueCounter[]) => (contentMode === 'shared' ? setCounters(value) : setOverridePatch({ counters: value }))
  const setCurrentDrills = (value: TechniqueDrill[]) => (contentMode === 'shared' ? setDrills(value) : setOverridePatch({ drills: value }))
  const setCurrentKeyPoints = (value: string[]) => (contentMode === 'shared' ? setKeyPoints(value) : setOverridePatch({ keyPoints: value }))
  const setCurrentCommonErrors = (value: string[]) => (contentMode === 'shared' ? setCommonErrors(value) : setOverridePatch({ commonErrors: value }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">Technik Verwaltung</p>
          <h1 className="mt-2 text-3xl font-black text-white">Techniken</h1>
        </div>
        <button type="button" onClick={() => { resetForm(); setShowCreateForm(!showCreateForm) }} className="rounded-2xl border border-bjj-gold/30 bg-bjj-gold/12 px-4 py-3 text-sm font-semibold text-bjj-gold transition hover:bg-bjj-gold/20">
          <Plus className="mr-2 inline h-4 w-4" />
          {showCreateForm ? 'Abbrechen' : 'Neue Technik'}
        </button>
      </div>

      {message ? <div className={`rounded-2xl border px-4 py-3 text-sm ${message.includes('erfolgreich') || message.includes('geloescht') ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{message}</div> : null}

      {showCreateForm ? (
        <section className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,20,30,0.98),rgba(11,14,21,0.94))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">{editingId ? 'Technik bearbeiten' : 'Neue Technik erstellen'}</h2>
              <p className="mt-2 text-sm text-white/55">Gemeinsame Inhalte gelten zuerst fuer beide Stile. Gi- und No-Gi-Overrides sind optional.</p>
            </div>
            <button type="button" onClick={() => void saveTechnique()} disabled={uploading || !title.trim()} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-400 disabled:opacity-50">
              {uploading ? 'Wird gespeichert...' : editingId ? 'Aktualisieren' : 'Speichern'}
            </button>
          </div>

          <div className="mb-6 border-b border-white/8">
            <nav className="flex flex-wrap gap-4 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-bold uppercase tracking-[0.12em] transition whitespace-nowrap ${
                    activeTab === tab.id ? 'border-bjj-gold text-bjj-gold' : 'border-transparent text-white/38 hover:text-white/72'
                  }`}>
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="space-y-6">
            {activeTab === 'basic' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titel *" className="w-full rounded-2xl border border-white/10 bg-[#101723] px-4 py-3 text-sm text-white outline-none focus:border-bjj-gold/50" />
                  <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Untertitel" className="w-full rounded-2xl border border-white/10 bg-[#101723] px-4 py-3 text-sm text-white outline-none focus:border-bjj-gold/50" />
                  <select value={stage} onChange={(event) => setStage(event.target.value as TechniqueStage)} className="w-full rounded-2xl border border-white/10 bg-[#101723] px-4 py-3 text-sm text-white outline-none focus:border-bjj-gold/50">
                    <option value="position">Position</option>
                    <option value="pass">Pass</option>
                    <option value="submission">Submission</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/40">Stil-Abdeckung</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {COVERAGE_OPTIONS.map((option) => (
                        <button key={option} type="button" onClick={() => setStyleCoverage(option)} className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                          styleCoverage === option ? 'border border-bjj-gold/40 bg-bjj-gold/12 text-bjj-gold' : 'border border-white/10 bg-[#101723] text-white/70 hover:border-white/20 hover:text-white'
                        }`}>
                          {getTechniqueCoverageLabel(option)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/40">Detail-Editor</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {editableModes.map((mode) => (
                        <button key={mode} type="button" onClick={() => setContentMode(mode)} className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                          contentMode === mode ? 'border border-bjj-gold/40 bg-bjj-gold/12 text-bjj-gold' : 'border border-white/10 bg-[#101723] text-white/70 hover:border-white/20 hover:text-white'
                        }`}>
                          {modeLabel(mode)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-6 text-white/45">
                      {contentMode === 'shared' ? 'Dieser Inhalt wird standardmaessig fuer Gi und No-Gi genutzt.' : `Nur wenn du fuer ${getTechniqueStyleLabel(contentMode)} bewusst abweichen willst, brauchst du hier einen Override.`}
                    </p>
                  </div>

                  <textarea value={currentDescription} onChange={(event) => setCurrentDescription(event.target.value)} placeholder={contentMode === 'shared' ? 'Gemeinsame Beschreibung' : `${getTechniqueStyleLabel(contentMode)} Beschreibung`} rows={5} className="w-full rounded-2xl border border-white/10 bg-[#101723] px-4 py-3 text-sm text-white outline-none focus:border-bjj-gold/50 resize-none" />

                  <div className="flex items-center gap-3">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="technique-image-upload" />
                    {!image ? (
                      <label htmlFor="technique-image-upload" className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/20 bg-[#101723] px-4 py-3 text-sm text-white/70 transition hover:border-bjj-gold/50 hover:text-white">
                        <ImagePlus className="h-4 w-4" />
                        Titelbild hochladen
                      </label>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/10"><img src={image} alt="Vorschau" className="h-full w-full object-cover" /></div>
                        <button type="button" onClick={removeImage} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-red-500/20 hover:text-red-400"><X className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/40">Empfohlene Archetypen</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {ARCHETYPES.map((archetype) => {
                      const active = recommendedArchetypeIds.includes(archetype.id)
                      return (
                        <button
                          key={archetype.id}
                          type="button"
                          onClick={() =>
                            setRecommendedArchetypeIds((current) =>
                              current.includes(archetype.id) ? current.filter((entry) => entry !== archetype.id) : [...current, archetype.id]
                            )
                          }
                          className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                            active ? 'border-bjj-gold/35 bg-bjj-gold/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/72'
                          }`}
                        >
                          <p className="font-semibold">{archetype.name}</p>
                          <p className="mt-1 text-xs text-white/45">{archetype.tagline}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/40">Voraussetzungen</p>
                  <div className="mb-2 flex gap-2">
                    <input value={newPrerequisite} onChange={(event) => setNewPrerequisite(event.target.value)} placeholder="Voraussetzung hinzufuegen..." className="flex-1 rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" onKeyDown={(event) => {
                      if (event.key === 'Enter' && newPrerequisite.trim()) {
                        event.preventDefault()
                        setPrerequisites([...prerequisites, newPrerequisite.trim()])
                        setNewPrerequisite('')
                      }
                    }} />
                    <button type="button" onClick={() => {
                      if (!newPrerequisite.trim()) return
                      setPrerequisites([...prerequisites, newPrerequisite.trim()])
                      setNewPrerequisite('')
                    }} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/70 transition hover:bg-bjj-gold/20"><Plus className="h-4 w-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {prerequisites.map((item, index) => (
                      <span key={`${item}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
                        {item}
                        <button type="button" onClick={() => setPrerequisites(prerequisites.filter((_, i) => i !== index))} className="ml-1 text-white/40 hover:text-white"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'videos' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input value={newVideo.title} onChange={(event) => setNewVideo({ ...newVideo, title: event.target.value })} placeholder="Video Titel" className="flex-1 rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" />
                  <input value={newVideo.url} onChange={(event) => setNewVideo({ ...newVideo, url: event.target.value })} placeholder="Video URL" className="flex-[2] rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" />
                  <select value={newVideo.platform} onChange={(event) => setNewVideo({ ...newVideo, platform: event.target.value as TechniqueVideo['platform'] })} className="rounded-2xl border border-white/10 bg-[#101723] px-3 py-2 text-sm text-white outline-none">
                    <option value="youtube">YouTube</option>
                    <option value="instagram">Instagram</option>
                    <option value="other">Andere</option>
                  </select>
                  <button type="button" onClick={() => {
                    if (!newVideo.title.trim() || !newVideo.url.trim()) return
                    setCurrentVideos([...currentVideos, { ...newVideo, id: `video-${Date.now()}`, title: newVideo.title.trim(), url: newVideo.url.trim() }])
                    setNewVideo({ title: '', url: '', platform: 'youtube' })
                  }} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/70 transition hover:bg-bjj-gold/20"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2">
                  {currentVideos.map((video, index) => (
                    <div key={video.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101723] px-4 py-3">
                      <div className="flex items-center gap-3"><Play className="h-4 w-4 text-bjj-gold" /><span className="text-sm text-white">{video.title}</span><span className="text-xs text-white/40">({video.platform})</span></div>
                      <button type="button" onClick={() => setCurrentVideos(currentVideos.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'counters' ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <input value={newCounter.title} onChange={(event) => setNewCounter({ ...newCounter, title: event.target.value })} placeholder="Counter Titel" className="rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" />
                  <textarea value={newCounter.description} onChange={(event) => setNewCounter({ ...newCounter, description: event.target.value })} placeholder="Beschreibung des Counters" rows={2} className="rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none resize-none" />
                  <select value={newCounter.styleCoverage} onChange={(event) => setNewCounter({ ...newCounter, styleCoverage: event.target.value as TechniqueStyleCoverage })} className="rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none">
                    {COVERAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{getTechniqueCoverageLabel(option)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => {
                    if (!newCounter.title.trim() || !newCounter.description.trim()) return
                    setCurrentCounters([...currentCounters, { id: `counter-${Date.now()}`, title: newCounter.title.trim(), description: newCounter.description.trim(), styleCoverage: newCounter.styleCoverage }])
                    setNewCounter({ title: '', description: '', styleCoverage: 'both' })
                  }} className="self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-bjj-gold/20"><Plus className="mr-2 inline h-4 w-4" />Counter hinzufuegen</button>
                </div>
                <div className="space-y-2">
                  {currentCounters.map((counter, index) => (
                    <div key={counter.id} className="rounded-xl border border-white/10 bg-[#101723] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold text-white">{counter.title}</p><p className="mt-1 text-sm text-white/60">{counter.description}</p><p className="mt-2 text-xs text-bjj-gold">{getItemStyleLabel(counter.styleCoverage ?? 'both')}</p></div>
                        <button type="button" onClick={() => setCurrentCounters(currentCounters.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'drills' ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <input value={newDrill.title} onChange={(event) => setNewDrill({ ...newDrill, title: event.target.value })} placeholder="Drill Titel" className="rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" />
                  <textarea value={newDrill.description} onChange={(event) => setNewDrill({ ...newDrill, description: event.target.value })} placeholder="Beschreibung des Drills" rows={2} className="rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none resize-none" />
                  <input value={newDrill.duration} onChange={(event) => setNewDrill({ ...newDrill, duration: event.target.value })} placeholder="Dauer" className="rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" />
                  <select value={newDrill.styleCoverage} onChange={(event) => setNewDrill({ ...newDrill, styleCoverage: event.target.value as TechniqueStyleCoverage })} className="rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none">
                    {COVERAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{getTechniqueCoverageLabel(option)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => {
                    if (!newDrill.title.trim() || !newDrill.description.trim()) return
                    setCurrentDrills([...currentDrills, { id: `drill-${Date.now()}`, title: newDrill.title.trim(), description: newDrill.description.trim(), duration: newDrill.duration.trim() || undefined, styleCoverage: newDrill.styleCoverage }])
                    setNewDrill({ title: '', description: '', duration: '', styleCoverage: 'both' })
                  }} className="self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-bjj-gold/20"><Plus className="mr-2 inline h-4 w-4" />Drill hinzufuegen</button>
                </div>
                <div className="space-y-2">
                  {currentDrills.map((drill, index) => (
                    <div key={drill.id} className="rounded-xl border border-white/10 bg-[#101723] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold text-white">{drill.title}</p><p className="mt-1 text-sm text-white/60">{drill.description}</p>{drill.duration ? <p className="mt-1 text-xs text-bjj-gold">{drill.duration}</p> : null}<p className="mt-2 text-xs text-bjj-gold">{getItemStyleLabel(drill.styleCoverage ?? 'both')}</p></div>
                        <button type="button" onClick={() => setCurrentDrills(currentDrills.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'keypoints' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input value={newKeyPoint} onChange={(event) => setNewKeyPoint(event.target.value)} placeholder="Wichtiger Punkt..." className="flex-1 rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" onKeyDown={(event) => {
                    if (event.key === 'Enter' && newKeyPoint.trim()) {
                      event.preventDefault()
                      setCurrentKeyPoints([...currentKeyPoints, newKeyPoint.trim()])
                      setNewKeyPoint('')
                    }
                  }} />
                  <button type="button" onClick={() => {
                    if (!newKeyPoint.trim()) return
                    setCurrentKeyPoints([...currentKeyPoints, newKeyPoint.trim()])
                    setNewKeyPoint('')
                  }} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/70 transition hover:bg-bjj-gold/20"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2">
                  {currentKeyPoints.map((point, index) => (
                    <div key={`${point}-${index}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101723] px-4 py-3">
                      <div className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400" /><span className="text-sm text-white">{point}</span></div>
                      <button type="button" onClick={() => setCurrentKeyPoints(currentKeyPoints.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'errors' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input value={newError} onChange={(event) => setNewError(event.target.value)} placeholder="Haeufiger Fehler..." className="flex-1 rounded-2xl border border-white/10 bg-[#101723] px-4 py-2 text-sm text-white outline-none" onKeyDown={(event) => {
                    if (event.key === 'Enter' && newError.trim()) {
                      event.preventDefault()
                      setCurrentCommonErrors([...currentCommonErrors, newError.trim()])
                      setNewError('')
                    }
                  }} />
                  <button type="button" onClick={() => {
                    if (!newError.trim()) return
                    setCurrentCommonErrors([...currentCommonErrors, newError.trim()])
                    setNewError('')
                  }} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/70 transition hover:bg-bjj-gold/20"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2">
                  {currentCommonErrors.map((error, index) => (
                    <div key={`${error}-${index}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101723] px-4 py-3">
                      <div className="flex items-center gap-3"><AlertTriangle className="h-4 w-4 text-orange-400" /><span className="text-sm text-white">{error}</span></div>
                      <button type="button" onClick={() => setCurrentCommonErrors(currentCommonErrors.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">Bestehende Techniken</p>
            <h2 className="text-xl font-black text-white">Alle Techniken ({customTechniques.length})</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Techniken suchen..." className="w-full min-w-[240px] rounded-full border border-white/10 bg-[#101723] py-2 pl-10 pr-4 text-sm text-white outline-none focus:border-bjj-gold/50" />
          </div>
        </div>

        {filteredTechniques.length === 0 ? (
          <p className="text-white/50">{searchQuery ? 'Keine Techniken gefunden.' : 'Noch keine Techniken erstellt.'}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTechniques.map((technique) => (
              <div key={technique.id} className="group rounded-2xl border border-white/10 bg-[#101723] p-4 transition hover:border-bjj-gold/30">
                <div className="flex gap-4">
                  <img src={technique.image} alt={technique.title} className="h-20 w-20 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white transition group-hover:text-bjj-gold">{technique.title}</p>
                    <p className="mt-1 truncate text-sm text-white/60">{technique.subtitle}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/60">{STAGE_LABELS[technique.stage]}</span>
                      <span className="inline-block rounded-full bg-bjj-gold/10 px-2 py-0.5 text-xs text-bjj-gold">{getTechniqueCoverageLabel(technique.styleCoverage)}</span>
                      {technique.videos.length ? <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/60">{technique.videos.length} Videos</span> : null}
                      {technique.recommendedArchetypeIds?.length ? <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/60">{technique.recommendedArchetypeIds.length} Archetypen</span> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
                  <Link href={`/technique/${technique.id}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.08]"><Eye className="h-3.5 w-3.5" />Ansehen</Link>
                  <button type="button" onClick={() => loadTechniqueForEdit(technique)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-bjj-gold/20 hover:text-bjj-gold"><Edit3 className="h-3.5 w-3.5" />Bearbeiten</button>
                  <button type="button" onClick={() => deleteItem(technique.id)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/70 transition hover:bg-red-500/20 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
