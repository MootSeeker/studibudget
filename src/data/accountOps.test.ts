// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createAccountOps } from './accountOps'
import { StudiBudgetDB } from './db'

let n = 0
const setup = () => {
  const db = new StudiBudgetDB(`acc-${++n}-${Math.random()}`)
  return { db, ops: createAccountOps(db) }
}
const only = async (db: StudiBudgetDB, name: string) =>
  (await db.accounts.toArray()).find((a) => a.name === name)!

describe('Konten', () => {
  it('legt Konten an (Reihenfolge fortlaufend), lehnt leere und doppelte Namen ab', async () => {
    const { db, ops } = setup()
    await ops.addAccount(' Privatkonto ', 'bank')
    await ops.addAccount('Sparkonto', 'spar')
    expect(
      (await db.accounts.toArray()).sort((a, b) => a.order - b.order).map((a) => a.name),
    ).toEqual(['Privatkonto', 'Sparkonto'])
    await expect(ops.addAccount('privatkonto', 'bank')).rejects.toThrow('schon')
    await expect(ops.addAccount('  ', 'bank')).rejects.toThrow('Namen')
  })
  it('Vorschläge in einem Zug übernehmen', async () => {
    const { db, ops } = setup()
    await ops.addAccounts([
      { name: 'A', kind: 'bank' },
      { name: 'B', kind: 'schuld' },
    ])
    expect(await db.accounts.count()).toBe(2)
    expect(await db.outbox.count()).toBe(2)
  })
  it('Stand setzen: gleicher Monat überschreibt, leer löscht (= unbekannt), Schuld wird negativ gespeichert', async () => {
    const { db, ops } = setup()
    await ops.addAccount('Privat', 'bank')
    await ops.addAccount('Karte', 'schuld')
    const privat = await only(db, 'Privat')
    const karte = await only(db, 'Karte')
    await ops.setBalance(privat, '2026-10', 100000)
    await ops.setBalance(privat, '2026-10', 120000)
    expect(await db.accountBalances.count()).toBe(1)
    expect((await db.accountBalances.toArray())[0].amountCents).toBe(120000)
    await ops.setBalance(karte, '2026-10', 25000)
    expect(
      (await db.accountBalances.toArray()).find((b) => b.accountId === karte.id)!.amountCents,
    ).toBe(-25000)
    await ops.setBalance(privat, '2026-10', null)
    const live = (await db.accountBalances.toArray()).filter((b) => !b.deleted)
    expect(live.map((b) => b.accountId)).toEqual([karte.id])
    await ops.setBalance(privat, '2026-11', null) // nichts da: kein Fehler
  })
  it('Konto entfernen entfernt auch seine Stände', async () => {
    const { db, ops } = setup()
    await ops.addAccount('Privat', 'bank')
    const a = await only(db, 'Privat')
    await ops.setBalance(a, '2026-10', 5)
    await ops.removeAccount(a.id)
    expect((await db.accounts.get(a.id))!.deleted).toBe(true)
    expect((await db.accountBalances.toArray()).every((b) => b.deleted)).toBe(true)
  })
  it('umbenennen, Art ändern, Einbeziehen', async () => {
    const { db, ops } = setup()
    await ops.addAccount('Privat', 'bank')
    const a = await only(db, 'Privat')
    await ops.updateAccount(a, { name: 'Lohnkonto', include: false, kind: 'spar' })
    expect(await db.accounts.get(a.id)).toMatchObject({
      name: 'Lohnkonto',
      include: false,
      kind: 'spar',
    })
    await expect(ops.updateAccount(a, { name: ' ' })).rejects.toThrow('leer')
  })
})

describe('Sparziele', () => {
  const goal = { name: 'Ferien', targetCents: 100000, targetDate: '2027-07-31', startCents: 0 }
  it('legt ein Ziel an und prüft die Eingaben', async () => {
    const { db, ops } = setup()
    await ops.addGoal(goal)
    expect(await db.goals.toArray()).toMatchObject([
      { name: 'Ferien', targetCents: 100000, archived: false },
    ])
    await expect(ops.addGoal({ ...goal, name: 'ferien' })).rejects.toThrow('schon')
    await expect(ops.addGoal({ ...goal, name: '' })).rejects.toThrow('Namen')
    await expect(ops.addGoal({ ...goal, name: 'X', targetCents: 0 })).rejects.toThrow(
      'grösser als 0',
    )
    await expect(ops.addGoal({ ...goal, name: 'X', startCents: -1 })).rejects.toThrow('negativ')
    await expect(ops.addGoal({ ...goal, name: 'X', targetDate: '31.07.2027' })).rejects.toThrow(
      'Datum',
    )
    await ops.addGoal({ ...goal, name: 'Ohne Datum', targetDate: null })
  })
  it('bearbeiten und archivieren; ein archiviertes Ziel blockiert den Namen nicht mehr', async () => {
    const { db, ops } = setup()
    await ops.addGoal(goal)
    const g = (await db.goals.toArray())[0]
    await ops.updateGoal(g, { targetCents: 150000, name: ' Reise ' })
    expect(await db.goals.get(g.id)).toMatchObject({ targetCents: 150000, name: 'Reise' })
    await expect(ops.updateGoal(g, { targetCents: 0 })).rejects.toThrow('grösser als 0')
    await ops.updateGoal((await db.goals.get(g.id))!, { archived: true })
    await ops.addGoal({ ...goal, name: 'Reise' })
    expect(await db.goals.count()).toBe(2)
  })
})
