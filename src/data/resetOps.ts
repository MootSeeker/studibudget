import { planReset, type ResetData, type ResetKind, type ResetPlan } from '../domain/reset'
import type { StudiBudgetDB } from './db'
import { createStore, type Store } from './store'

export function createResetOps(db: StudiBudgetDB, store: Store = createStore(db)) {
  async function load(): Promise<ResetData> {
    return {
      budgets: await db.budgets.toArray(),
      transactions: await db.transactions.toArray(),
      templates: await db.templates.toArray(),
      settlements: await db.settlements.toArray(),
      accounts: await db.accounts.toArray(),
      accountBalances: await db.accountBalances.toArray(),
      goals: await db.goals.toArray(),
    }
  }

  return {
    load,
    /**
     * Löscht die gewählten Arten und bereinigt Verweise darauf, alles in einer Transaktion. Die Grabsteine werden
     * synchronisiert, die anderen Geräte löschen also mit. Der Plan wird frisch aus der Datenbank berechnet.
     */
    async reset(selected: Iterable<ResetKind>): Promise<ResetPlan> {
      const plan = planReset(await load(), selected)
      await store.writeBatch(plan.writes)
      return plan
    },
  }
}
