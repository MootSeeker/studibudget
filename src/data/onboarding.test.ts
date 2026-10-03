// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyCatalogPlan, planCatalogChange } from './catalogSync'
import { StudiBudgetDB } from './db'
import { completeOnboarding, type OnboardingInput } from './onboarding'
import { SETTINGS_ID } from './seed'
import { defaultSemesters } from '../domain/period'

let n = 0
const fresh = () => new StudiBudgetDB(`onb-${++n}-${Math.random()}`)

const input = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  country: 'CH',
  living: 'wg',
  hasCar: false,
  partnerSharePct: 50,
  persons: ['Anna', ' Ben ', ''],
  semesters: defaultSemesters('CH'),
  budgets: { miete: 80000, einkauf: 40000, handy: 0 },
  ...over,
})

describe('completeOnboarding', () => {
  it('legt Einstellungen, Personen, Kategorien und nur die gesetzten Budgets an', async () => {
    const db = fresh()
    await completeOnboarding(db, input(), '2026-10')
    const s = await db.settings.get(SETTINGS_ID)
    expect(s).toMatchObject({ country: 'CH', living: 'wg', onboardingDone: true })
    expect((await db.persons.toArray()).map((p) => p.name).sort()).toEqual(['Anna', 'Ben'])
    const cats = await db.categories.toArray()
    const budgets = await db.budgets.toArray()
    expect(budgets).toHaveLength(2)
    const miete = cats.find((c) => c.catalogKey === 'miete')!
    expect(budgets.find((b) => b.categoryId === miete.id)).toMatchObject({
      amountCents: 80000,
      validFrom: '2026-10',
    })
    expect(cats.find((c) => c.catalogKey === 'wg_kasse')).toBeTruthy()
    expect(await db.outbox.count()).toBeGreaterThan(0) // wird synchronisiert
  })
  it('ein Fehler mittendrin lässt die Einrichtung nicht als fertig gelten', async () => {
    const db = fresh()
    const bad = { ...input(), budgets: { miete: 1 } }
    const store = (await import('./store')).createStore(db)
    const failing = {
      ...store,
      put: async () => {
        throw new Error('kaputt')
      },
    }
    await expect(completeOnboarding(db, bad, '2026-10', failing as typeof store)).rejects.toThrow()
    expect(await db.settings.get(SETTINGS_ID)).toBeUndefined()
  })
})

describe('doppelte Namen', () => {
  it('die Einrichtung lehnt doppelte Personen ab und legt nichts an', async () => {
    const db = fresh()
    await expect(
      completeOnboarding(db, input({ persons: ['Anna', ' anna'] }), '2026-10'),
    ).rejects.toThrow('mehrfach')
    expect(await db.persons.count()).toBe(0)
    expect(await db.settings.count()).toBe(0)
  })
})

describe('Katalog bei Änderungen', () => {
  const ctx = { country: 'CH' as const, living: 'wg' as const, hasCar: false }

  it('WG → bei den Eltern: Miete wird ausgeblendet, Kostgeld kommt dazu, Daten bleiben', async () => {
    const db = fresh()
    await completeOnboarding(db, input(), '2026-10')
    const plan = await planCatalogChange(db, ctx, { ...ctx, living: 'eltern' })
    expect(plan.hide.map((c) => c.catalogKey)).toEqual(
      expect.arrayContaining(['miete', 'nebenkosten', 'wg_kasse', 'strom']),
    )
    expect(plan.add.map((i) => i.key)).toEqual(['kostgeld'])
    const miete = (await db.categories.toArray()).find((c) => c.catalogKey === 'miete')!
    await applyCatalogPlan(db, plan)
    const after = await db.categories.toArray()
    expect(after.find((c) => c.id === miete.id)).toMatchObject({ hidden: true, deleted: false })
    expect(after.find((c) => c.catalogKey === 'kostgeld')).toMatchObject({ hidden: false })
    const wohnen = (await db.areas.toArray()).find((a) => a.name === 'Wohnen')!
    expect(after.find((c) => c.catalogKey === 'kostgeld')!.areaId).toBe(wohnen.id)
  })

  it('zurück zur WG blendet die Kategorien wieder ein, ohne Duplikate', async () => {
    const db = fresh()
    await completeOnboarding(db, input(), '2026-10')
    await applyCatalogPlan(db, await planCatalogChange(db, ctx, { ...ctx, living: 'eltern' }))
    const back = await planCatalogChange(db, { ...ctx, living: 'eltern' }, ctx)
    expect(back.unhide.map((c) => c.catalogKey)).toContain('miete')
    expect(back.add).toEqual([])
    await applyCatalogPlan(db, back)
    const miete = (await db.categories.toArray()).filter((c) => c.catalogKey === 'miete')
    expect(miete).toHaveLength(1)
    expect(miete[0].hidden).toBe(false)
  })

  it('Land CH → DE benennt nur unveränderte Standardnamen um', async () => {
    const db = fresh()
    await completeOnboarding(db, input({ living: 'allein', persons: [] }), '2026-10')
    const rundfunk = (await db.categories.toArray()).find((c) => c.catalogKey === 'rundfunk')!
    const kk = (await db.categories.toArray()).find((c) => c.catalogKey === 'krankenkasse')!
    const { updatedAt: _a, ...kkRest } = kk
    await (
      await import('./store')
    )
      .createStore(db)
      .put('categories', { ...kkRest, name: 'Meine Kasse' })
    const next = { country: 'DE' as const, living: 'allein' as const, hasCar: false }
    const plan = await planCatalogChange(db, { ...ctx, living: 'allein' }, next)
    expect(plan.rename.map((r) => r.name)).toContain('Rundfunkbeitrag')
    expect(plan.rename.find((r) => r.category.id === kk.id)).toBeUndefined()
    expect(plan.hide.map((c) => c.catalogKey)).toEqual(
      expect.arrayContaining(['franchise', 'halbtax', 'steuer_kanton']),
    )
    expect(plan.add.map((i) => i.key)).toEqual(expect.arrayContaining(['kindergeld', 'steuer_de']))
    await applyCatalogPlan(db, plan)
    expect((await db.categories.get(rundfunk.id))!.name).toBe('Rundfunkbeitrag')
    expect((await db.categories.get(kk.id))!.name).toBe('Meine Kasse')
  })

  it('Auto einschalten fügt den Bereich «Mobilität Auto» hinzu', async () => {
    const db = fresh()
    await completeOnboarding(db, input({ living: 'allein', persons: [] }), '2026-10')
    const plan = await planCatalogChange(
      db,
      { ...ctx, living: 'allein' },
      { ...ctx, living: 'allein', hasCar: true },
    )
    expect(plan.add.length).toBe(7)
    await applyCatalogPlan(db, plan)
    expect((await db.areas.toArray()).some((a) => a.name === 'Mobilität Auto')).toBe(true)
  })

  it('ohne Änderung ist der Plan leer', async () => {
    const db = fresh()
    await completeOnboarding(db, input(), '2026-10')
    expect((await planCatalogChange(db, ctx, ctx)).empty).toBe(true)
  })
})
