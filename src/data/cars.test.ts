// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { exportBackup, parseBackup } from './backup'
import { isCarCategory } from './catalog'
import { StudiBudgetDB } from './db'
import { completeOnboarding } from './onboarding'
import { newId } from './seed'
import { createStore } from './store'
import { defaultSemesters } from '../domain/period'

let n = 0
const fresh = () => new StudiBudgetDB(`car-${++n}-${Math.random()}`)

async function setup() {
  const db = fresh()
  await completeOnboarding(
    db,
    {
      country: 'CH',
      living: 'allein',
      hasCar: true,
      partnerSharePct: 50,
      persons: [],
      semesters: defaultSemesters('CH'),
      budgets: {},
    },
    '2026-10',
  )
  const store = createStore(db)
  const carId = newId()
  await store.put('cars', { id: carId, deleted: false, name: 'Golf', archived: false, order: 0 })
  const cats = await db.categories.toArray()
  return { db, store, carId, cats }
}

describe('isCarCategory', () => {
  it('erkennt Katalog- und selbst angelegte Kategorien im Auto-Bereich', async () => {
    const { cats } = await setup()
    const parkplatz = cats.find((c) => c.catalogKey === 'auto_parkplatz')!
    const miete = cats.find((c) => c.catalogKey === 'miete')!
    expect(isCarCategory(parkplatz, cats)).toBe(true)
    expect(isCarCategory(miete, cats)).toBe(false)
    const eigene = { areaId: parkplatz.areaId }
    expect(isCarCategory(eigene, cats)).toBe(true)
  })
})

describe('Autos im Backup', () => {
  it('Export und Import behalten Auto und carId; alte Backups ohne «cars» bleiben gültig', async () => {
    const { db, store, carId, cats } = await setup()
    const parkplatz = cats.find((c) => c.catalogKey === 'auto_parkplatz')!
    await store.put('transactions', {
      id: newId(),
      deleted: false,
      date: '2026-10-02',
      categoryId: parkplatz.id,
      amountCents: 5000,
      myAmountCents: 5000,
      note: '',
      carId,
    })
    const backup = await exportBackup(db)
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.counts.cars).toBe(1)
      expect(parsed.backup.data.transactions[0].carId).toBe(carId)
    }
    const old = JSON.parse(JSON.stringify(backup))
    delete old.data.cars
    for (const t of old.data.transactions) delete t.carId
    expect(parseBackup(JSON.stringify(old)).ok).toBe(true)
  })

  it('Buchung mit unbekanntem Auto wird abgelehnt', async () => {
    const { db, store, cats } = await setup()
    const parkplatz = cats.find((c) => c.catalogKey === 'auto_parkplatz')!
    await store.put('transactions', {
      id: newId(),
      deleted: false,
      date: '2026-10-02',
      categoryId: parkplatz.id,
      amountCents: 5000,
      myAmountCents: 5000,
      note: '',
      carId: newId(),
    })
    const r = parseBackup(JSON.stringify(await exportBackup(db)))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('unbekanntes Auto')
  })
})
