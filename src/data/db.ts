import Dexie, { type Table } from 'dexie'
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
  Template,
  Transaction,
} from '../domain/types'

/** Lokale, noch nicht hochgeladene Änderung (für den späteren Sync). */
export interface OutboxEntry {
  seq?: number
  table: string
  recordId: string
}

/** Lokal gespeicherter Datenschlüssel (angemeldet bleiben). Wird beim Abmelden gelöscht. */
export interface KeystoreEntry {
  id: 'dek'
  email: string
  key: CryptoKey
}

/** Lokaler Sync-Zustand (pro Gerät, nicht synchronisiert). */
export interface SyncStateRow {
  id: 'state'
  deviceId: string
  lastSeq: number
  wall: number
  counter: number
}

export class StudiBudgetDB extends Dexie {
  settings!: Table<Settings, string>
  persons!: Table<Person, string>
  areas!: Table<Area, string>
  categories!: Table<Category, string>
  budgets!: Table<Budget, string>
  transactions!: Table<Transaction, string>
  templates!: Table<Template, string>
  settlements!: Table<Settlement, string>
  accounts!: Table<Account, string>
  accountBalances!: Table<AccountBalance, string>
  goals!: Table<Goal, string>
  cars!: Table<Car, string>
  inboxConnections!: Table<InboxConnection, string>
  outbox!: Table<OutboxEntry, number>
  keystore!: Table<KeystoreEntry, string>
  syncState!: Table<SyncStateRow, string>

  constructor(name = 'studibudget') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      persons: 'id',
      areas: 'id, order',
      categories: 'id, areaId, type',
      budgets: 'id, categoryId, validFrom',
      transactions: 'id, date, categoryId, templateId, goalId',
      templates: 'id, categoryId',
      settlements: 'id, date, personId',
      accounts: 'id',
      accountBalances: 'id, accountId, month',
      goals: 'id',
      outbox: '++seq, table',
    })
    this.version(2).stores({ keystore: 'id' })
    this.version(3).stores({ syncState: 'id' })
    this.version(4).stores({ cars: 'id, order' })
    this.version(5).stores({ inboxConnections: 'id' })
  }

  /** Alle lokalen Daten und Schlüssel löschen (Abmelden, Kontowechsel). */
  async wipe(): Promise<void> {
    // Eine einzige Transaktion: Einzelne clear()-Aufrufe nebeneinander liessen in WebKit Tabellen (z. B. den
    // Abgleichsstand) stehen, während andere schon leer waren.
    await this.transaction('rw', this.tables, async () => {
      for (const t of this.tables) await t.clear()
    })
  }
}

export const db = new StudiBudgetDB()
