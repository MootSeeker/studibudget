// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createCategoryOps } from './categoryOps'
import { StudiBudgetDB } from './db'
import { completeOnboarding } from './onboarding'
import { defaultSemesters } from '../domain/period'

let n = 0
async function setup() {
  const db = new StudiBudgetDB(`ops-${++n}-${Math.random()}`)
  await completeOnboarding(
    db,
    {
      country: 'CH',
      living: 'allein',
      hasCar: false,
      partnerSharePct: 50,
      persons: [],
      semesters: defaultSemesters('CH'),
      budgets: {},
    },
    '2026-10',
  )
  return { db, ops: createCategoryOps(db) }
}
const byKey = async (db: StudiBudgetDB, key: string) =>
  (await db.categories.toArray()).find((c) => c.catalogKey === key)!

describe('Kategorie-Operationen', () => {
  it('neue Kategorie landet am Ende ihres Bereichs; doppelte Namen und leere werden abgelehnt', async () => {
    const { db, ops } = await setup()
    const haushalt = (await db.areas.toArray()).find((a) => a.name === 'Haushalt')!
    await ops.addCategory(haushalt.id, '  Katzenfutter ', 'ausgabe')
    const added = (await db.categories.toArray()).find((c) => c.name === 'Katzenfutter')!
    expect(added).toMatchObject({ areaId: haushalt.id, type: 'ausgabe', hidden: false, fix: false })
    const max = Math.max(...(await db.categories.toArray()).map((c) => c.order))
    expect(added.order).toBe(max)
    await expect(ops.addCategory(haushalt.id, 'katzenfutter', 'ausgabe')).rejects.toThrow('schon')
    await expect(ops.addCategory(haushalt.id, '   ', 'ausgabe')).rejects.toThrow('Namen')
  })

  it('Umbenennen, Fixkosten, Übertrag, Ausblenden', async () => {
    const { db, ops } = await setup()
    const strom = await byKey(db, 'strom')
    await ops.updateCategory(strom, { name: 'Strom & Gas', fix: true, rolloverFrom: '2026-10' })
    expect(await db.categories.get(strom.id)).toMatchObject({
      name: 'Strom & Gas',
      fix: true,
      rolloverFrom: '2026-10',
    })
    await ops.updateCategory((await db.categories.get(strom.id))!, { hidden: true })
    expect((await db.categories.get(strom.id))!.hidden).toBe(true)
    await expect(ops.updateCategory(strom, { name: ' ' })).rejects.toThrow('leer')
  })

  it('Verschieben nach oben/unten tauscht nur mit dem Nachbarn im Bereich', async () => {
    const { db, ops } = await setup()
    const a = await byKey(db, 'einkauf')
    const b = await byKey(db, 'mensa')
    expect(a.order).toBeLessThan(b.order)
    await ops.move(b, -1)
    const [a2, b2] = [await db.categories.get(a.id), await db.categories.get(b.id)]
    expect(b2!.order).toBeLessThan(a2!.order)
    const first = await byKey(db, 'miete')
    await ops.move(first, -1) // erster im Bereich: keine Änderung
    expect((await db.categories.get(first.id))!.order).toBe(first.order)
  })

  it('in anderen Bereich verschieben', async () => {
    const { db, ops } = await setup()
    const freizeit = (await db.areas.toArray()).find((a) => a.name === 'Freizeit')!
    const c = await byKey(db, 'strom')
    await ops.updateCategory(c, { areaId: freizeit.id })
    expect(await db.categories.get(c.id)).toMatchObject({ areaId: freizeit.id })
  })

  it('Bereiche anlegen und umbenennen', async () => {
    const { db, ops } = await setup()
    await ops.addArea('Haustier')
    await expect(ops.addArea('haustier')).rejects.toThrow('schon')
    const area = (await db.areas.toArray()).find((a) => a.name === 'Haustier')!
    expect(area.order).toBe(Math.max(...(await db.areas.toArray()).map((a) => a.order)))
    await ops.renameArea(area, 'Tiere')
    expect((await db.areas.get(area.id))!.name).toBe('Tiere')
    await expect(ops.renameArea(area, '')).rejects.toThrow('leer')
  })

  it('alle Änderungen landen in der Outbox (werden synchronisiert)', async () => {
    const { db, ops } = await setup()
    await db.outbox.clear()
    await ops.addArea('X')
    expect(await db.outbox.count()).toBe(1)
  })
})
