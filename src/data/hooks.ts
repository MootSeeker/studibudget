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
