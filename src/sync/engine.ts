import { decryptRecord, encryptRecord } from '../crypto/records'
import type { StudiBudgetDB } from '../data/db'
import { SYNCED_TABLES, loadSyncState, type Store, type SyncedTable } from '../data/store'
import { receive } from './hlc'
import { TransportError, type PushRow, type Transport } from './transport'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  message?: string
  lastSyncAt?: number
  /** Anzahl Datensätze, die nicht entschlüsselt werden konnten und übersprungen wurden. */
  skipped: number
}

export interface EngineOptions {
  pageSize?: number
  pushBatch?: number
  intervalMs?: number
  debounceMs?: number
}

const isSyncedTable = (t: unknown): t is SyncedTable => SYNCED_TABLES.includes(t as SyncedTable)

export class SyncEngine {
  private status: SyncStatus = { state: 'idle', skipped: 0 }
  private listeners = new Set<(s: SyncStatus) => void>()
  private running: Promise<void> | null = null
  private again = false
  private cleanup: (() => void)[] = []
  private readonly pageSize: number
  private readonly pushBatch: number

  private db: StudiBudgetDB
  private store: Store
  private transport: Transport
  private dek: CryptoKey
  private opts: EngineOptions

  constructor(
    db: StudiBudgetDB,
    store: Store,
    transport: Transport,
    dek: CryptoKey,
    opts: EngineOptions = {},
  ) {
    this.db = db
    this.store = store
    this.transport = transport
    this.dek = dek
    this.opts = opts
    this.pageSize = opts.pageSize ?? 500
    this.pushBatch = Math.min(opts.pushBatch ?? 500, 500)
  }

  getStatus(): SyncStatus {
    return this.status
  }

  subscribe(cb: (s: SyncStatus) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((l) => l(this.status))
  }

  /** Startet die automatischen Auslöser: sofort, bei Änderungen, beim Wieder-Online-Gehen, regelmässig. */
  start(): void {
    let timer: ReturnType<typeof setTimeout> | undefined
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void this.syncNow(), this.opts.debounceMs ?? 2000)
    }
    const now = () => void this.syncNow()
    const visible = () => document.visibilityState === 'visible' && now()
    this.cleanup.push(this.store.onChange(later))
    window.addEventListener('online', now)
    document.addEventListener('visibilitychange', visible)
    const interval = setInterval(
      () => document.visibilityState === 'visible' && now(),
      this.opts.intervalMs ?? 60_000,
    )
    this.cleanup.push(() => {
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('online', now)
      document.removeEventListener('visibilitychange', visible)
    })
    now()
  }

  stop(): void {
    this.cleanup.forEach((c) => c())
    this.cleanup = []
  }

  /** Hochladen, dann Neues holen. Gleichzeitige Aufrufe laufen nacheinander und werden zusammengefasst. */
  syncNow(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        await this.cycle()
      } while (this.again)
    })().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async cycle(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.set({ state: 'offline', message: undefined })
      return
    }
    this.set({ state: 'syncing', message: undefined, skipped: 0 })
    try {
      await this.push()
      const skipped = await this.pull()
      this.set({ state: 'idle', lastSyncAt: Date.now(), skipped })
    } catch (e) {
      if (e instanceof TransportError && e.kind === 'network') this.set({ state: 'offline' })
      else if (e instanceof TransportError && e.kind === 'auth')
        this.set({ state: 'error', message: 'Bitte melde dich neu an.' })
      else
        this.set({
          state: 'error',
          message: e instanceof Error ? e.message : 'Sync fehlgeschlagen.',
        })
    }
  }

  private async push(): Promise<void> {
    const entries = await this.db.outbox.orderBy('seq').toArray()
    if (entries.length === 0) return
    const maxSeq = entries[entries.length - 1].seq!
    const unique = new Map(entries.map((e) => [`${e.table}|${e.recordId}`, e]))
    const rows: PushRow[] = []
    for (const e of unique.values()) {
      if (!isSyncedTable(e.table)) continue
      const rec = await this.db.table(e.table).get(e.recordId)
      if (!rec) continue
      rows.push({
        id: e.recordId,
        hlc: rec.updatedAt,
        deleted: rec.deleted === true,
        ciphertext: await encryptRecord(this.dek, e.recordId, { table: e.table, data: rec }),
      })
    }
    for (let i = 0; i < rows.length; i += this.pushBatch) {
      await this.transport.push(rows.slice(i, i + this.pushBatch))
    }
    // Nur bis zum gelesenen Stand löschen: Änderungen während des Uploads bleiben vorgemerkt.
    await this.db.outbox.where('seq').belowOrEqual(maxSeq).delete()
  }

  private async pull(): Promise<number> {
    let skipped = 0
    for (;;) {
      const state = await loadSyncState(this.db)
      const rows = await this.transport.pull(state.lastSeq, this.pageSize)
      if (rows.length === 0) return skipped
      let clock = { wall: state.wall, counter: state.counter }
      const apply: { table: SyncedTable; data: { id: string; updatedAt: string } }[] = []
      for (const row of rows) {
        try {
          const rec = await decryptRecord(this.dek, row.id, row.ciphertext)
          const data = rec.data as { id?: string; updatedAt?: string }
          if (
            !isSyncedTable(rec.table) ||
            data?.id !== row.id ||
            typeof data.updatedAt !== 'string'
          )
            throw new Error('ungültig')
          apply.push({ table: rec.table, data: data as { id: string; updatedAt: string } })
        } catch {
          skipped++
        }
      }
      const lastSeq = rows[rows.length - 1].seq
      await this.db.transaction(
        'rw',
        [...SYNCED_TABLES.map((t) => this.db.table(t)), this.db.syncState],
        async () => {
          for (const { table, data } of apply) {
            clock = receive(clock, data.updatedAt)
            const local = await this.db.table(table).get(data.id)
            if (!local || data.updatedAt > local.updatedAt) await this.db.table(table).put(data)
          }
          await this.db.syncState.put({ ...state, ...clock, lastSeq })
        },
      )
      if (rows.length < this.pageSize) return skipped
    }
  }
}
