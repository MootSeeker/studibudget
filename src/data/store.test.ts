// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { createCategoryOps } from './categoryOps'
import { StudiBudgetDB } from './db'
import { completeOnboarding } from './onboarding'
import { createStore } from './store'
import { createAccountOps } from './accountOps'
import { defaultSemesters } from '../domain/period'

let n = 0
async function setup() {
  const db = new StudiBudgetDB(`store-${++n}-${Math.random()}`)
  await completeOnboarding(
    db,
    {
      country: 'CH',
      living: 'wg',
      hasCar: false,
      partnerSharePct: 50,
      persons: ['Anna'],
      semesters: defaultSemesters('CH'),
      budgets: {},
    },
    '2026-10',
  )
  let t = 1_000_000
  const store = createStore(db, () => (t += 10))
  return { db, store }
}
const byKey = async (db: StudiBudgetDB, key: string) =>
  (await db.categories.toArray()).find((c) => c.catalogKey === key)!

describe('store.patch', () => {
  it('ändert nur die genannten Felder, stempelt neu und merkt für den Sync vor', async () => {
    const { db, store } = await setup()
    const c = await byKey(db, 'miete')
    await db.outbox.clear()
    await store.patch('categories', c.id, { fix: false, hidden: true })
    const after = (await db.categories.get(c.id))!
    expect(after).toMatchObject({
      name: c.name,
      areaId: c.areaId,
      type: c.type,
      fix: false,
      hidden: true,
    })
    expect(after.updatedAt > c.updatedAt).toBe(true)
    expect(await db.outbox.toArray()).toMatchObject([{ table: 'categories', recordId: c.id }])
  })

  it('eine Funktion bekommt den aktuellen Datensatz (nicht einen alten)', async () => {
    const { db, store } = await setup()
    const anna = (await db.persons.toArray())[0]
    await store.patch('persons', anna.id, { name: 'Anni' })
    await store.patch('persons', anna.id, (cur) => ({ name: `${cur.name}!` }))
    expect((await db.persons.get(anna.id))!.name).toBe('Anni!')
  })

  it('wirft bei fehlendem oder gelöschtem Eintrag und schreibt nichts', async () => {
    const { db, store } = await setup()
    await expect(store.patch('persons', 'gibt-es-nicht', { name: 'x' })).rejects.toThrow(
      'existiert nicht mehr',
    )
    const anna = (await db.persons.toArray())[0]
    await store.remove('persons', anna.id)
    const outbox = await db.outbox.count()
    await expect(store.patch('persons', anna.id, { name: 'x' })).rejects.toThrow(
      'existiert nicht mehr',
    )
    expect(await db.outbox.count()).toBe(outbox)
  })

  it('meldet die Änderung an Beobachter (Sync)', async () => {
    const { db, store } = await setup()
    const seen = vi.fn()
    store.onChange(seen)
    await store.patch('persons', (await db.persons.toArray())[0].id, { active: false })
    expect(seen).toHaveBeenCalledTimes(1)
  })
})

describe('veralteter Bildschirmzustand überschreibt nichts mehr (Regression)', () => {
  it('Kategorie: Umbenennen, dann Häkchen auf einer alten Kopie behält den neuen Namen', async () => {
    const { db, store } = await setup()
    const ops = createCategoryOps(db, store)
    const stale = await byKey(db, 'strom') // Kopie, wie sie die Seite noch anzeigt
    await ops.updateCategory(stale, { name: 'Strom & Gas' })
    await ops.updateCategory(stale, { fix: true }) // die Seite hat den neuen Namen noch nicht bekommen
    expect(await db.categories.get(stale.id)).toMatchObject({ name: 'Strom & Gas', fix: true })
  })

  it('Konto und Sparziel: gleiche Absicherung', async () => {
    const { db, store } = await setup()
    const ops = createAccountOps(db, store)
    await ops.addAccount('Privat', 'bank')
    const staleAccount = (await db.accounts.toArray())[0]
    await ops.updateAccount(staleAccount, { name: 'Lohnkonto' })
    await ops.updateAccount(staleAccount, { include: false })
    expect(await db.accounts.get(staleAccount.id)).toMatchObject({
      name: 'Lohnkonto',
      include: false,
    })

    await ops.addGoal({ name: 'Ferien', targetCents: 100000, targetDate: null, startCents: 0 })
    const staleGoal = (await db.goals.toArray())[0]
    await ops.updateGoal(staleGoal, { targetCents: 200000 })
    await ops.updateGoal(staleGoal, { archived: true })
    expect(await db.goals.get(staleGoal.id)).toMatchObject({ targetCents: 200000, archived: true })
  })

  it('Bereich umbenennen und Verschieben mit alter Kopie', async () => {
    const { db, store } = await setup()
    const ops = createCategoryOps(db, store)
    const staleArea = (await db.areas.toArray())[0]
    await ops.renameArea(staleArea, 'Neu A')
    await ops.renameArea(staleArea, 'Neu B')
    expect((await db.areas.get(staleArea.id))!.name).toBe('Neu B')
  })
})
