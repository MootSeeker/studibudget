import type { BudgetImportPlan } from '../domain/budgetFile'
import type { StudiBudgetDB } from './db'
import { newId } from './seed'
import { createStore, type Store } from './store'

export function createBudgetOps(db: StudiBudgetDB, store: Store = createStore(db)) {
  const live = async () => (await db.budgets.toArray()).filter((b) => !b.deleted)

  return {
    /** Alle Budgetwerte löschen; Buchungen und Kategorien bleiben. Gibt die Zahl der gelöschten Werte zurück. */
    async reset(): Promise<number> {
      const old = await live()
      await store.writeBatch([
        { name: 'budgets', drafts: old.map((b) => ({ ...b, deleted: true })) },
      ])
      return old.length
    },

    /** Das bestehende Budget wird ersetzt, alles in einer Transaktion: entweder ganz oder gar nicht. */
    async replaceWith(plan: BudgetImportPlan): Promise<void> {
      const old = await live()
      await store.writeBatch([
        {
          name: 'budgets',
          drafts: [
            ...old.map((b) => ({ ...b, deleted: true })),
            ...plan.matched.map((m) => ({
              id: newId(),
              deleted: false,
              categoryId: m.categoryId,
              validFrom: m.validFrom,
              amountCents: m.amountCents,
            })),
          ],
        },
      ])
    },
  }
}
