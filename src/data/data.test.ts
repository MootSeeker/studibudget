import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { catalogFor } from './catalog'
import { StudiBudgetDB } from './db'
import { SETTINGS_ID, seedFromCatalog } from './seed'

const names = (c: ReturnType<typeof catalogFor>) => c.map((i) => i.name)

describe('catalog', () => {
  it('Schweiz, WG: SERAFE, Franchise und WG-Kasse, kein Kostgeld, kein Auto', () => {
    const n = names(catalogFor('CH', 'wg', false))
    expect(n).toEqual(
      expect.arrayContaining(['SERAFE', 'Franchise / Selbstbehalt', 'WG-Kasse', 'Halbtax']),
    )
    expect(n).not.toContain('Kostgeld / Beitrag Eltern')
    expect(n).not.toContain('Parkplatz')
  })
  it('Deutschland, bei den Eltern: Kostgeld statt Miete, Rundfunkbeitrag entfällt', () => {
    const n = names(catalogFor('DE', 'eltern', false))
    expect(n).toContain('Kostgeld / Beitrag Eltern')
    expect(n).toContain('BAföG / Stipendium')
    expect(n).not.toContain('Miete')
    expect(n).not.toContain('Rundfunkbeitrag')
    expect(n).not.toContain('Halbtax')
  })
  it('Auto blendet den Bereich ein und landesspezifisch um', () => {
    expect(names(catalogFor('DE', 'allein', true))).toContain('Kfz-Steuer')
    expect(names(catalogFor('CH', 'allein', true))).toContain('Verkehrssteuer')
  })
  it('Schlüssel sind eindeutig', () => {
    const keys = catalogFor('CH', 'allein', true).map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('db seed', () => {
  it('legt Einstellungen, Bereiche und Kategorien an', async () => {
    const db = new StudiBudgetDB('test-seed')
    await seedFromCatalog(db, 'CH', 'wg', false)
    const s = await db.settings.get(SETTINGS_ID)
    expect(s).toMatchObject({ country: 'CH', living: 'wg', onboardingDone: false })
    expect(s!.semesters[0].name).toBe('Herbstsemester')
    const areas = await db.areas.toArray()
    const cats = await db.categories.toArray()
    expect(areas.map((a) => a.name)).toContain('Wohnen')
    expect(cats.every((c) => areas.some((a) => a.id === c.areaId))).toBe(true)
    expect(cats.length).toBe(catalogFor('CH', 'wg', false).length)
    await db.delete()
  })
})
