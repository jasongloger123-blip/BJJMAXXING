'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Back to App Header */}
      <div className="flex items-center justify-between border-b border-bjj-border bg-bjj-card p-4">
        <Link
          href="/skill-tree"
          className="flex items-center gap-2 text-sm text-bjj-muted transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur App
        </Link>
      </div>

      {/* Main Content */}
      <main className="p-4 lg:p-6">
        {children}
      </main>
    </div>
  )
}
