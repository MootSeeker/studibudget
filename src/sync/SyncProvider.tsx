import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { supabase } from '../auth/supabase'
import { db } from '../data/db'
import { store } from '../data/store'
import { SyncEngine, type SyncStatus } from './engine'
import { supabaseTransport } from './transport'

interface SyncApi {
  status: SyncStatus
  pending: number
  syncNow(): void
}

const Ctx = createContext<SyncApi | null>(null)
const IDLE: SyncStatus = { state: 'idle', skipped: 0 }

/** Startet den Sync, solange jemand angemeldet ist (liegt innerhalb des AuthGate). */
export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>(IDLE)
  const [engine, setEngine] = useState<SyncEngine | null>(null)
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)

  useEffect(() => {
    let cancelled = false
    let started: SyncEngine | null = null
    void (async () => {
      const entry = await db.keystore.get('dek')
      if (cancelled || !entry || !supabase) return
      started = new SyncEngine(db, store, supabaseTransport(supabase), entry.key)
      started.subscribe(setStatus)
      started.start()
      setEngine(started)
    })()
    return () => {
      cancelled = true
      started?.stop()
      setEngine(null)
    }
  }, [])

  return (
    <Ctx.Provider value={{ status, pending, syncNow: () => void engine?.syncNow() }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSync(): SyncApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSync braucht den SyncProvider')
  return v
}

export function describeStatus(status: SyncStatus, pending: number): string {
  if (status.state === 'syncing') return 'Synchronisiert …'
  if (status.state === 'error') return status.message ?? 'Sync-Fehler'
  if (status.state === 'offline')
    return pending > 0
      ? `Offline – ${pending} Änderung${pending === 1 ? '' : 'en'} ausstehend`
      : 'Offline'
  if (pending > 0) return `${pending} Änderung${pending === 1 ? '' : 'en'} ausstehend`
  if (status.skipped > 0) return `Synchronisiert (${status.skipped} nicht lesbar)`
  return 'Synchronisiert'
}
