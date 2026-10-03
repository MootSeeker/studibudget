import type { StudiBudgetDB } from './db'
import { newId } from './seed'
import { createStore, type Store } from './store'
import { storedBalance } from '../domain/wealth'
import type { Account, AccountKind, Goal } from '../domain/types'

/** Konten, Monatsendstände und Sparziele. Alles läuft über den Store, wird also synchronisiert. */
export function createAccountOps(db: StudiBudgetDB, store: Store = createStore(db)) {
  const live = async <T extends { deleted: boolean }>(rows: Promise<T[]>) =>
    (await rows).filter((r) => !r.deleted)

  return {
    async addAccount(name: string, kind: AccountKind): Promise<void> {
      const clean = name.trim()
      if (!clean) throw new Error('Bitte gib einen Namen ein.')
      const accounts = await live(db.accounts.toArray())
      if (accounts.some((a) => a.name.toLowerCase() === clean.toLowerCase()))
        throw new Error('Dieses Konto gibt es schon.')
      await store.put('accounts', {
        id: newId(),
        deleted: false,
        name: clean,
        kind,
        include: true,
        order: accounts.reduce((m, a) => Math.max(m, a.order), -1) + 1,
      })
    },
    async addAccounts(items: { name: string; kind: AccountKind }[]): Promise<void> {
      const accounts = await live(db.accounts.toArray())
      const base = accounts.reduce((m, a) => Math.max(m, a.order), -1) + 1
      await store.putMany(
        'accounts',
        items.map((it, i) => ({
          id: newId(),
          deleted: false,
          name: it.name,
          kind: it.kind,
          include: true,
          order: base + i,
        })),
      )
    },
    async updateAccount(
      a: Account,
      patch: Partial<Pick<Account, 'name' | 'kind' | 'include'>>,
    ): Promise<void> {
      if (patch.name !== undefined) {
        patch = { ...patch, name: patch.name.trim() }
        if (!patch.name) throw new Error('Der Name darf nicht leer sein.')
      }
      await store.patch('accounts', a.id, patch)
    },
    async removeAccount(id: string): Promise<void> {
      await store.remove('accounts', id)
      for (const b of await live(db.accountBalances.where('accountId').equals(id).toArray()))
        await store.remove('accountBalances', b.id)
    },
    /** Setzt den Stand eines Kontos am Monatsende; `null` löscht die Angabe (= unbekannt). */
    async setBalance(account: Account, month: string, enteredCents: number | null): Promise<void> {
      const existing = (
        await live(db.accountBalances.where('accountId').equals(account.id).toArray())
      ).find((b) => b.month === month)
      if (enteredCents === null) {
        if (existing) await store.remove('accountBalances', existing.id)
        return
      }
      await store.put('accountBalances', {
        id: existing?.id ?? newId(),
        deleted: false,
        accountId: account.id,
        month,
        amountCents: storedBalance(account.kind, enteredCents),
      })
    },

    async addGoal(input: {
      name: string
      targetCents: number
      targetDate: string | null
      startCents: number
    }): Promise<void> {
      const name = input.name.trim()
      if (!name) throw new Error('Bitte gib einen Namen ein.')
      if (!(input.targetCents > 0)) throw new Error('Der Zielbetrag muss grösser als 0 sein.')
      if (input.startCents < 0) throw new Error('Der Anfangsbestand darf nicht negativ sein.')
      if (input.targetDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate))
        throw new Error('Bitte gib ein gültiges Datum ein.')
      const goals = await live(db.goals.toArray())
      if (goals.some((g) => !g.archived && g.name.toLowerCase() === name.toLowerCase()))
        throw new Error('Dieses Sparziel gibt es schon.')
      await store.put('goals', {
        id: newId(),
        deleted: false,
        name,
        targetCents: input.targetCents,
        targetDate: input.targetDate,
        startCents: input.startCents,
        archived: false,
      })
    },
    async updateGoal(
      g: Goal,
      patch: Partial<Pick<Goal, 'name' | 'targetCents' | 'targetDate' | 'startCents' | 'archived'>>,
    ): Promise<void> {
      if (patch.name !== undefined && !patch.name.trim())
        throw new Error('Der Name darf nicht leer sein.')
      if (patch.targetCents !== undefined && !(patch.targetCents > 0))
        throw new Error('Der Zielbetrag muss grösser als 0 sein.')
      await store.patch('goals', g.id, {
        ...patch,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      })
    },
  }
}

export type AccountOps = ReturnType<typeof createAccountOps>
