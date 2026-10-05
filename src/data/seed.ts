import { catalogFor } from './catalog'
import type { StudiBudgetDB } from './db'
import { storeFor, type Draft } from './store'
import { defaultSemesters } from '../domain/period'
import type { Country, Living } from '../domain/types'

export const newId = () => crypto.randomUUID()

/** Feste ID: Es gibt pro Konto genau eine Einstellungen-Zeile (muss eine gültige UUID sein, der Server verlangt es). */
export const SETTINGS_ID = '00000000-0000-4000-8000-000000000001'

export function defaultSettings(
  country: Country,
  living: Living,
  hasCar: boolean,
): Draft<'settings'> {
  return {
    id: SETTINGS_ID,
    deleted: false,
    country,
    living,
    hasCar,
    myPartnerSharePct: 50,
    semesters: defaultSemesters(country),
    ampel: { yellowPct: 80, redPct: 100 },
    theme: 'system',
    backupReminderDays: 30,
    lastBackupAt: null,
    onboardingDone: false,
  }
}

/** Bereiche und Kategorien aus dem Katalog als Entwürfe (noch nicht gespeichert). */
export function buildCatalogDrafts(country: Country, living: Living, hasCar: boolean) {
  const areas = new Map<string, Draft<'areas'>>()
  const categories: Draft<'categories'>[] = []
  for (const it of catalogFor(country, living, hasCar)) {
    if (!areas.has(it.area)) {
      areas.set(it.area, {
        id: newId(),
        deleted: false,
        name: it.area,
        order: areas.size,
        hidden: false,
      })
    }
    categories.push({
      id: newId(),
      deleted: false,
      areaId: areas.get(it.area)!.id,
      name: it.name,
      type: it.type,
      fix: it.fix,
      rolloverFrom: null,
      hidden: false,
      order: categories.length,
      catalogKey: it.key,
    })
  }
  return { areas: [...areas.values()], categories }
}

/** Legt Einstellungen sowie Bereiche und Kategorien aus dem Katalog an. */
export async function seedFromCatalog(
  db: StudiBudgetDB,
  country: Country,
  living: Living,
  hasCar: boolean,
): Promise<void> {
  const store = storeFor(db)
  const { areas, categories } = buildCatalogDrafts(country, living, hasCar)
  await store.put('settings', defaultSettings(country, living, hasCar))
  await store.putMany('areas', areas)
  await store.putMany('categories', categories)
}
