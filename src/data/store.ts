import type { StudiBudgetDB } from './db'
import { db as defaultDb } from './db'
import { format, tick, type ClockState } from '../sync/hlc'
import type {
  Account,
  AccountBalance,
  Area,
  Car,
  Budget,
  Category,
  Goal,
  InboxConnection,
  Person,
  Settings,
  Settlement,
  Synced,
  Template,
  Transaction,
} from '../domain/types'

/** Tabellen, die zwischen Geräten synchronisiert werden. */
export interface TableTypes {
  settings: Settings
  persons: Person
  areas: Area
  categories: Category
  budgets: Budget
  transactions: Transaction
  templates: Template
  settlements: Settlement
  accounts: Account
  accountBalances: AccountBalance
  goals: Goal
  cars: Car
  inboxConnections: InboxConnection
}

export type SyncedTable = keyof TableTypes
export const SYNCED_TABLES: SyncedTable[] = [
  'settings',
  'persons',
  'areas',
  'categories',
  'budgets',
  'transactions',
  'templates',
  'settlements',
  'accounts',
  'accountBalances',
  'goals',
  'cars',
  'inboxConnections',
]

export type Draft<N extends SyncedTable> = Omit<TableTypes[N], 'updatedAt'>

const randomDevice = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')

export async function loadSyncState(db: StudiBudgetDB) {
  return (
    (await db.syncState.get('state')) ?? {
      id: 'state' as const,
      deviceId: randomDevice(),
      lastSeq: 0,
      wall: 0,
      counter: 0,
    }
  )
}

/**
 * Einziger Weg, synchronisierte Daten zu schreiben: stempelt jeden Datensatz mit der Uhr
 * und merkt ihn in der Outbox für den Upload vor. Löschen ist ein Grabstein (`deleted: true`).
 */
export function createStore(db: StudiBudgetDB = defaultDb, now: () => number = Date.now) {
  const listeners = new Set<() => void>()

  async function write<N extends SyncedTable>(name: N, drafts: Draft<N>[]): Promise<void> {
    if (drafts.length === 0) return
    await db.transaction('rw', [db.table(name), db.syncState, db.outbox], async () => {
      const state = await loadSyncState(db)
      let clock: ClockState = { wall: state.wall, counter: state.counter }
      for (const d of drafts) {
        clock = tick(clock, now())
        await db.table(name).put({ ...d, updatedAt: format(clock, state.deviceId) })
        await db.outbox.add({ table: name, recordId: (d as unknown as Synced).id })
      }
      await db.syncState.put({ ...state, ...clock })
    })
    listeners.forEach((l) => l())
  }

  /**
   * Einzelne Felder ändern: Der aktuelle Datensatz wird innerhalb der Transaktion gelesen und nur die geänderten Felder werden
   * darauf angewendet. So überschreibt eine Änderung auf Basis eines veralteten Bildschirmzustands keine Änderung, die kurz
   * davor gespeichert wurde. `changes` darf eine Funktion des aktuellen Datensatzes sein.
   */
  async function patch<N extends SyncedTable>(
    name: N,
    id: string,
    changes: Partial<Draft<N>> | ((current: TableTypes[N]) => Partial<Draft<N>>),
  ): Promise<void> {
    await db.transaction('rw', [db.table(name), db.syncState, db.outbox], async () => {
      const current = (await db.table(name).get(id)) as TableTypes[N] | undefined
      if (!current || current.deleted) throw new Error('Dieser Eintrag existiert nicht mehr.')
      const state = await loadSyncState(db)
      const clock = tick({ wall: state.wall, counter: state.counter }, now())
      const delta = typeof changes === 'function' ? changes(current) : changes
      await db.table(name).put({ ...current, ...delta, updatedAt: format(clock, state.deviceId) })
      await db.outbox.add({ table: name, recordId: id })
      await db.syncState.put({ ...state, ...clock })
    })
    listeners.forEach((l) => l())
  }

  /** Mehrere Tabellen in EINER Transaktion schreiben: entweder alles oder nichts (für den Backup-Import). */
  async function writeBatch(entries: { name: SyncedTable; drafts: object[] }[]): Promise<void> {
    const total = entries.reduce((n, e) => n + e.drafts.length, 0)
    if (total === 0) return
    await db.transaction(
      'rw',
      [...SYNCED_TABLES.map((t) => db.table(t)), db.syncState, db.outbox],
      async () => {
        const state = await loadSyncState(db)
        let clock: ClockState = { wall: state.wall, counter: state.counter }
        for (const { name, drafts } of entries) {
          for (const d of drafts) {
            clock = tick(clock, now())
            await db.table(name).put({ ...d, updatedAt: format(clock, state.deviceId) })
            await db.outbox.add({ table: name, recordId: (d as Synced).id })
          }
        }
        await db.syncState.put({ ...state, ...clock })
      },
    )
    listeners.forEach((l) => l())
  }

  return {
    writeBatch,
    patch,
    put: <N extends SyncedTable>(name: N, draft: Draft<N>) => write(name, [draft]),
    putMany: write,
    async remove(name: SyncedTable, id: string): Promise<void> {
      const rec = await db.table(name).get(id)
      if (rec && !rec.deleted) await write(name, [{ ...rec, deleted: true }])
    },
    /** Wird nach jeder lokalen Änderung aufgerufen (für den Sync). */
    onChange(cb: () => void): () => void {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

export type Store = ReturnType<typeof createStore>
export const store = createStore()

/**
 * Der Store zu einer Datenbank. Für die App-Datenbank ist es der gemeinsame `store`: Nur seine Änderungen stossen den Sync
 * an (`onChange`). Ein eigener Store (andere Datenbank, andere Uhr) gilt nur in Tests.
 */
export const storeFor = (db: StudiBudgetDB): Store => (db === defaultDb ? store : createStore(db))
