import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'BJJMAXXING - Find your archetype. Build your gameplan.',
  description:
    'Die BJJ-App, die deinen Stil erkennt und dir den naechsten sinnvollen Trainingsschritt vorgibt.',
  keywords: ['BJJ', 'Jiu-Jitsu', 'Grappling', 'Skill Tree', 'Gameplan', 'Archetyp'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className={inter.variable}>
      <body className="min-h-screen bg-bjj-bg font-sans text-bjj-text antialiased">
        {children}
      </body>
    </html>
  )
}
