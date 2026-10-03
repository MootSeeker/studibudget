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
