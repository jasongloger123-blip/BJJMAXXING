'use client'

import { useEffect, useState } from 'react'
import { migrateOldTechniques, readCustomTechniques, type CustomTechniqueRecord } from '@/lib/custom-techniques'
import { Check, AlertCircle, Loader2 } from 'lucide-react'

export default function MigrationPage() {
  const [status, setStatus] = useState<'idle' | 'migrating' | 'completed' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [techniques, setTechniques] = useState<CustomTechniqueRecord[]>([])

  useEffect(() => {
    // Check current techniques
    const current = readCustomTechniques()
    setTechniques(current)
  }, [])

  function runMigration() {
    setStatus('migrating')
    try {
      migrateOldTechniques()
      const migrated = readCustomTechniques()
      setTechniques(migrated)
      setStatus('completed')
      setMessage(`Migration erfolgreich! ${migrated.length} Techniken sind jetzt im neuen Format.`)
    } catch (error) {
      setStatus('error')
      setMessage('Migration fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">Technik Migration</p>
        <h1 className="mt-2 text-3xl font-black text-white">Techniken aktualisieren</h1>
      </div>

      <div className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,20,30,0.98),rgba(11,14,21,0.94))] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bjj-gold/10 text-bjj-gold">
            {status === 'migrating' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : status === 'completed' ? (
              <Check className="h-6 w-6" />
            ) : (
              <AlertCircle className="h-6 w-6" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Datenbank-Update</h2>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              Die Techniken werden vom alten Format (v1) auf das neue erweiterte Format (v2) migriert. 
              Dies fügt Unterstützung für Videos, Counter, Drills, Key Points und Fehler hinzu.
            </p>
            
            {techniques.length > 0 && (
              <p className="mt-4 text-sm text-bjj-gold">
                {techniques.length} Technik{techniques.length === 1 ? '' : 'en'} gefunden
              </p>
            )}

            {message && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                status === 'completed' 
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}>
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={runMigration}
              disabled={status === 'migrating'}
              className="mt-6 rounded-2xl border border-bjj-gold/30 bg-bjj-gold/12 px-6 py-3 text-sm font-semibold text-bjj-gold transition hover:bg-bjj-gold/20 disabled:opacity-50"
            >
              {status === 'migrating' ? 'Wird migriert...' : 'Migration starten'}
            </button>
          </div>
        </div>
      </div>

      {techniques.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-bjj-gold">Vorschau</p>
          <h2 className="text-xl font-black text-white">Vorhandene Techniken</h2>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {techniques.map((technique) => (
              <div
                key={technique.id}
                className="rounded-2xl border border-white/10 bg-[#101723] p-4"
              >
                <div className="flex gap-4">
                  <img
                    src={technique.image}
                    alt={technique.title}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{technique.title}</p>
                    <p className="mt-1 text-xs text-white/50">
                      {technique.videos?.length || 0} Videos • {technique.counters?.length || 0} Counter • {technique.drills?.length || 0} Drills
                    </p>
                    <span className="mt-2 inline-block rounded-full bg-white/5 px-2 py-1 text-xs text-white/60">
                      {technique.stage}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
