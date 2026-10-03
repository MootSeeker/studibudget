import Dexie, { type Table } from 'dexie'
import type {
  Account,
  AccountBalance,
  Area,
  Budget,
  Category,
  Goal,
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
  outbox!: Table<OutboxEntry, number>

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
  }
}

export const db = new StudiBudgetDB()
