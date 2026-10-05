import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSemesters } from '../domain/period'
import { createAccountOps } from './accountOps'
import { applyBackup, exportBackup } from './backup'
import { createBudgetOps } from './budgetOps'
import { createCategoryOps } from './categoryOps'
import { db } from './db'
import { completeOnboarding } from './onboarding'
import { createResetOps } from './resetOps'
import { store, storeFor } from './store'

const onboarding: Parameters<typeof completeOnboarding>[1] = {
  country: 'CH',
  living: 'allein',
  hasCar: false,
  partnerSharePct: 50,
  persons: [],
  semesters: defaultSemesters('CH'),
  budgets: {},
}

beforeEach(async () => {
  await db.wipe()
})

/** Der Sync startet über `store.onChange`; jede Schreibstelle der App muss ihn dort melden (Regression #79). */
describe('gemeinsamer Store löst den Sync aus (Regression #79)', () => {
  it('storeFor(db) ist für die App-Datenbank der gemeinsame Store', () => {
    expect(storeFor(db)).toBe(store)
  })

  it('Einrichtung, Konten, Kategorien, Budget, Zurücksetzen und Backup melden ihre Änderungen', async () => {
    const onChange = vi.fn()
    const off = store.onChange(onChange)
    const meldet = async (fn: () => Promise<unknown>) => {
      onChange.mockClear()
      await fn()
      expect(onChange).toHaveBeenCalled()
    }

    await meldet(() => completeOnboarding(db, onboarding))
    const area = (await db.areas.toArray())[0]
    await meldet(() => createCategoryOps(db).addCategory(area.id, 'Yoga', 'ausgabe'))
    await meldet(() => createAccountOps(db).addAccount('Konto', 'bank'))
    const yoga = (await db.categories.toArray()).find((c) => c.name === 'Yoga')!
    await store.put('budgets', {
      id: crypto.randomUUID(),
      deleted: false,
      categoryId: yoga.id,
      validFrom: '2026-01',
      amountCents: 100,
    })
    await meldet(() => createBudgetOps(db).replaceWith({ matched: [], skipped: [] }))
    const backup = await exportBackup(db)
    await meldet(() => applyBackup(db, backup))
    await meldet(() => createResetOps(db).reset(['accounts']))
    off()
  })
})
