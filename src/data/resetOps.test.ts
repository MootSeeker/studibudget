import { beforeEach, describe, expect, it } from 'vitest'
import { backupOk, ID, live, seed } from '../test/resetSeed'
import { db } from './db'
import { createResetOps } from './resetOps'
import { store } from './store'

const ops = createResetOps(db, store)

beforeEach(seed)

describe('Daten zurücksetzen in der Datenbank (Issue #30)', () => {
  it('die Ausgangsdaten bestehen die Backup-Prüfung', async () => {
    expect(await backupOk()).toBe(true)
  })

  it('Buchungen löschen lässt Kategorien, Personen und Einstellungen stehen', async () => {
    const before = {
      cats: (await db.categories.toArray()).length,
      persons: (await db.persons.toArray()).length,
    }
    const plan = await ops.reset(['transactions'])
    expect(plan.total).toBe(2)
    expect(await live('transactions')).toHaveLength(0)
    expect(await live('templates')).toHaveLength(1)
    expect((await db.categories.toArray()).length).toBe(before.cats)
    expect((await db.persons.toArray()).length).toBe(before.persons)
    expect((await db.settings.toArray())[0].onboardingDone).toBe(true)
  })

  it('Löschungen landen in der Outbox und werden synchronisiert', async () => {
    await db.outbox.clear()
    await ops.reset(['budgets', 'settlements'])
    const queued = (await db.outbox.toArray()).map((o) => `${o.table}|${o.recordId}`).sort()
    expect(queued).toEqual([`budgets|${ID.b1}`, `settlements|${ID.s1}`])
    expect((await db.budgets.get(ID.b1))?.deleted).toBe(true)
  })

  it('Vorlagen und Sparziele weg, Buchungen bleiben ohne Verweis', async () => {
    await ops.reset(['templates', 'goals'])
    const t1 = await db.transactions.get(ID.t1)
    const t2 = await db.transactions.get(ID.t2)
    expect(t1).toMatchObject({ deleted: false, myAmountCents: 80000 })
    expect(t1).not.toHaveProperty('templateId')
    expect(t2).not.toHaveProperty('goalId')
    expect(await backupOk()).toBe(true)
  })
})
