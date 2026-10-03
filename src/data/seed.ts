import { catalogFor } from './catalog'
import type { StudiBudgetDB } from './db'
import { defaultSemesters } from '../domain/period'
import type { Area, Category, Country, Living, Settings } from '../domain/types'

export const newId = () => crypto.randomUUID()
const stamp = () => new Date().toISOString()

export function defaultSettings(country: Country, living: Living, hasCar: boolean): Settings {
  return {
    id: 'settings',
    updatedAt: stamp(),
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

/** Legt Einstellungen sowie Bereiche und Kategorien aus dem Katalog an (Erststart). */
export async function seedFromCatalog(
  db: StudiBudgetDB,
  country: Country,
  living: Living,
  hasCar: boolean,
): Promise<void> {
  const items = catalogFor(country, living, hasCar)
  const areas = new Map<string, Area>()
  const categories: Category[] = []
  for (const it of items) {
    if (!areas.has(it.area)) {
      areas.set(it.area, {
        id: newId(),
        updatedAt: stamp(),
        deleted: false,
        name: it.area,
        order: areas.size,
        hidden: false,
      })
    }
    categories.push({
      id: newId(),
      updatedAt: stamp(),
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
  await db.transaction('rw', db.settings, db.areas, db.categories, async () => {
    await db.settings.put(defaultSettings(country, living, hasCar))
    await db.areas.bulkPut([...areas.values()])
    await db.categories.bulkPut(categories)
  })
}
