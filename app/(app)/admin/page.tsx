'use client'

import Link from 'next/link'
import { Bot, ClipboardCheck, Film, Map, RotateCcw, Shield, UploadCloud, Users, UserCircle } from 'lucide-react'

const adminAreas = [
  {
    id: 'profiles',
    label: 'Profile',
    description: 'Alle Nutzerprofile mit Stats und Social Links',
    icon: UserCircle,
    href: '/admin/profiles',
    color: 'from-rose-500/20 to-rose-600/10',
    borderColor: 'border-rose-500/30',
  },
  {
    id: 'reviews',
    label: 'Reviews',
    description: 'A-Plan Einreichungen verwalten und prüfen',
    icon: ClipboardCheck,
    href: '/admin/reviews',
    color: 'from-blue-500/20 to-blue-600/10',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'userqueue',
    label: 'User Queue',
    description: 'Zeige die nächsten Videos eines Users an',
    icon: Users,
    href: '/admin/user-queue',
    color: 'from-cyan-500/20 to-cyan-600/10',
    borderColor: 'border-cyan-500/30',
  },
  {
    id: 'gameplans',
    label: 'Gameplans',
    description: 'Trainingspläne erstellen und verwalten',
    icon: Map,
    href: '/admin/gameplans',
    color: 'from-bjj-gold/20 to-bjj-gold/10',
    borderColor: 'border-bjj-gold/30',
  },
  {
    id: 'outlierdb',
    label: 'OutlierDB',
    description: 'Externe Quellen importieren und verknüpfen',
    icon: Bot,
    href: '/admin/outlierdb',
    color: 'from-purple-500/20 to-purple-600/10',
    borderColor: 'border-purple-500/30',
  },
  {
    id: 'clips',
    label: 'Clip-Verwaltung',
    description: 'Alle Clips mit Filter, Sortierung und Taxonomie-Bearbeitung',
    icon: Film,
    href: '/admin/clips',
    color: 'from-cyan-500/20 to-cyan-600/10',
    borderColor: 'border-cyan-500/30',
  },
  {
    id: 'video-upload',
    label: 'Video hochladen',
    description: 'Manuelle Clips per URL ins Archiv legen',
    icon: UploadCloud,
    href: '/admin/video-upload',
    color: 'from-orange-500/20 to-orange-600/10',
    borderColor: 'border-orange-500/30',
  },
  {
    id: 'techniques',
    label: 'Techniken',
    description: 'Neue Techniken zur Bibliothek hinzufügen',
    icon: Shield,
    href: '/admin/techniques',
    color: 'from-emerald-500/20 to-emerald-600/10',
    borderColor: 'border-emerald-500/30',
  },
  {
    id: 'progress-reset',
    label: 'Progress Reset',
    description: 'Video- und Gameplan-Fortschritt fuer Tests zuruecksetzen',
    icon: RotateCcw,
    href: '/admin/progress-reset',
    color: 'from-red-500/20 to-red-600/10',
    borderColor: 'border-red-500/30',
  },
]

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-black text-white">Admin Dashboard</h1>
        <p className="mt-2 text-bjj-muted">Wähle einen Bereich aus, um fortzufahren</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminAreas.map((area) => {
          const Icon = area.icon
          return (
            <Link
              key={area.id}
              href={area.href}
              className={`group rounded-[1.8rem] border ${area.borderColor} bg-gradient-to-br ${area.color} p-6 transition-all hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition group-hover:bg-white/[0.08]">
                <Icon className="h-7 w-7 text-white" />
              </div>
              <h2 className="mt-4 text-xl font-black text-white">{area.label}</h2>
              <p className="mt-2 text-sm text-white/60">{area.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
