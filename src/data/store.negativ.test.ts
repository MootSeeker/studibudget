// @vitest-environment node
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { StudiBudgetDB } from './db'
import { newId } from './seed'
import { createStore } from './store'

let n = 0
const name = () => `storeneg-${++n}-${Math.random()}`
const person = (id = newId()) => ({ id, deleted: false, name: 'Anna', active: true })

describe('Store: Fehler und Randfälle', { tags: ['negativ'] }, () => {
  it('scheitert ein Schreibvorgang mittendrin, bleibt nichts zurück (weder Datensatz noch Outbox noch Uhr)', async () => {
    const db = new StudiBudgetDB(name())
    const store = createStore(db)
    await store.put('persons', person())
    const before = {
      persons: await db.persons.count(),
      outbox: await db.outbox.count(),
      state: await db.syncState.toArray(),
    }
    // Der zweite Datensatz hat keine ID: die Outbox lehnt den Eintrag ab, die ganze Transaktion muss zurückrollen.
    const broken = { ...person(), id: undefined } as unknown as ReturnType<typeof person>
    await expect(store.putMany('persons', [person(), broken])).rejects.toThrow()
    expect(await db.persons.count()).toBe(before.persons)
    expect(await db.outbox.count()).toBe(before.outbox)
    expect(await db.syncState.toArray()).toEqual(before.state)
  })
  it('einen Datensatz, den es nicht gibt, zu löschen schreibt nichts', async () => {
    const db = new StudiBudgetDB(name())
    const store = createStore(db)
    await store.remove('persons', newId())
    expect(await db.outbox.count()).toBe(0)
  })
  it('einen schon gelöschten Datensatz erneut zu löschen schreibt nichts', async () => {
    const db = new StudiBudgetDB(name())
    const store = createStore(db)
    const p = person()
    await store.put('persons', p)
    await store.remove('persons', p.id)
    const outbox = await db.outbox.count()
    await store.remove('persons', p.id)
    expect(await db.outbox.count()).toBe(outbox)
  })
  it('Ändern eines gelöschten oder fehlenden Eintrags wird abgelehnt', async () => {
    const db = new StudiBudgetDB(name())
    const store = createStore(db)
    const p = person()
    await store.put('persons', p)
    await store.remove('persons', p.id)
    await expect(store.patch('persons', p.id, { name: 'Neu' })).rejects.toThrow(
      /existiert nicht mehr/,
    )
    await expect(store.patch('persons', newId(), { name: 'Neu' })).rejects.toThrow(
      /existiert nicht mehr/,
    )
  })
  it('putMany ohne Einträge ändert nichts', async () => {
    const db = new StudiBudgetDB(name())
    await createStore(db).putMany('persons', [])
    expect(await db.syncState.count()).toBe(0)
  })
})

describe('Datenbank: Upgrade von einer alten Version', { tags: ['negativ'] }, () => {
  it('Daten aus Version 1 gehen beim Upgrade auf die aktuelle Version nicht verloren', async () => {
    const dbName = name()
    const old = new Dexie(dbName)
    // Die Tabellen von Version 1, wie sie die ersten Geräte angelegt haben.
    old.version(1).stores({
      settings: 'id',
      persons: 'id',
      areas: 'id, order',
      categories: 'id, areaId, type',
      budgets: 'id, categoryId, validFrom',
      transactions: 'id, date, categoryId, templateId, goalId',
      templates: 'id, categoryId',
      settlements: 'id, date, personId',
      accounts: 'id',
      accountBalances: 'id, accountId, month',
      goals: 'id',
      outbox: '++seq, table',
    })
    const id = newId()
    await old.table('persons').put({ ...person(id), updatedAt: 'x' })
    old.close()
    const db = new StudiBudgetDB(dbName)
    expect((await db.persons.get(id))?.name).toBe('Anna')
    expect(await db.cars.count()).toBe(0)
    db.close()
  })
})
