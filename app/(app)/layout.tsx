import { Suspense } from 'react'
import AppShell from './AppShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bjj-bg" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
