import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { SETTINGS_ID } from './seed'

/** undefined = lädt noch, null = gibt es nicht. */
export function useSettings() {
  return useLiveQuery(async () => {
    const s = await db.settings.get(SETTINGS_ID)
    return s && !s.deleted ? s : null
  })
}

export function usePersons() {
  return useLiveQuery(async () => (await db.persons.toArray()).filter((p) => !p.deleted), [], [])
}

export function useCategories() {
  return useLiveQuery(async () => (await db.categories.toArray()).filter((c) => !c.deleted), [], [])
}

export function useAreas() {
  return useLiveQuery(
    async () =>
      (await db.areas.toArray()).filter((a) => !a.deleted).sort((a, b) => a.order - b.order),
    [],
    [],
  )
}

export function useGoals() {
  return useLiveQuery(
    async () => (await db.goals.toArray()).filter((g) => !g.deleted && !g.archived),
    [],
    [],
  )
}

export function useCars() {
  return useLiveQuery(
    async () =>
      (await db.cars.toArray())
        .filter((c) => !c.deleted && !c.archived)
        .sort((a, b) => a.order - b.order),
    [],
    [],
  )
}

/** Alle Autos, auch archivierte (für Anzeige bestehender Buchungen). */
export function useAllCars() {
  return useLiveQuery(
    async () =>
      (await db.cars.toArray()).filter((c) => !c.deleted).sort((a, b) => a.order - b.order),
    [],
    [],
  )
}

export function useTemplates() {
  return useLiveQuery(async () => (await db.templates.toArray()).filter((t) => !t.deleted), [], [])
}

/** Buchungen eines Monats, plus solche, die aus einer Vorlage dieses Monats stammen (auch wenn das Datum verschoben wurde). */
export function useMonthTransactions(month: string) {
  return useLiveQuery(
    async () =>
      (await db.transactions.toArray()).filter(
        (t) => !t.deleted && (t.date.slice(0, 7) === month || t.templateMonth === month),
      ),
    [month],
    [],
  )
}

export function useBudgets() {
  return useLiveQuery(async () => (await db.budgets.toArray()).filter((b) => !b.deleted), [], [])
}

export function useAllTransactions() {
  return useLiveQuery(
    async () => (await db.transactions.toArray()).filter((t) => !t.deleted),
    [],
    [],
  )
}

export function useAccounts() {
  return useLiveQuery(
    async () =>
      (await db.accounts.toArray()).filter((a) => !a.deleted).sort((a, b) => a.order - b.order),
    [],
    [],
  )
}

export function useAccountBalances() {
  return useLiveQuery(
    async () => (await db.accountBalances.toArray()).filter((b) => !b.deleted),
    [],
    [],
  )
}

/** Alle Sparziele, auch archivierte (die Seite filtert). */
export function useAllGoals() {
  return useLiveQuery(async () => (await db.goals.toArray()).filter((g) => !g.deleted), [], [])
}

export function useSettlements() {
  return useLiveQuery(
    async () => (await db.settlements.toArray()).filter((s) => !s.deleted),
    [],
    [],
  )
}
