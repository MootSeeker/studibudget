// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { defaultSemesters } from '../domain/period'
import { buildSharedEqual } from '../domain/split'
import { MAX_BACKUP_BYTES, exportBackup, parseBackup, type Backup } from './backup'
import { StudiBudgetDB } from './db'
import { completeOnboarding } from './onboarding'
import { newId } from './seed'
import { createStore } from './store'

let n = 0
const fresh = () => new StudiBudgetDB(`bakneg-${++n}-${Math.random()}`)

/** Ein kleiner, gültiger Bestand: eine WG-Person, eine geteilte Buchung, eine Vorlage, ein Konto mit Stand. */
async function valid(): Promise<Backup> {
  const db = fresh()
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
  const store = createStore(db)
  const cat = (await db.categories.toArray()).find((c) => c.catalogKey === 'einkauf')!
  const anna = (await db.persons.toArray())[0]
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date: '2026-10-02',
    categoryId: cat.id,
    amountCents: 9000,
    myAmountCents: 4500,
    note: '',
    shared: buildSharedEqual(9000, 'me', ['me', anna.id]),
  })
  await store.put('templates', {
    id: newId(),
    deleted: false,
    categoryId: cat.id,
    amountCents: 8000,
    note: 'Miete',
    shared: buildSharedEqual(8000, 'me', ['me', anna.id]),
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    active: true,
  })
  const accountId = newId()
  await store.put('accounts', {
    id: accountId,
    deleted: false,
    name: 'Privat',
    kind: 'bank',
    include: true,
    order: 0,
  })
  await store.put('accountBalances', {
    id: newId(),
    deleted: false,
    accountId,
    month: '2026-10',
    amountCents: 1000,
  })
  return JSON.parse(JSON.stringify(await exportBackup(db)))
}
const clone = (b: Backup): Backup => JSON.parse(JSON.stringify(b))
const parse = (b: unknown) => parseBackup(JSON.stringify(b))
const errorOf = (r: ReturnType<typeof parseBackup>) => (r.ok ? '' : r.error)

describe('Backup: beschädigte Kopf-Angaben', { tags: ['negativ'] }, () => {
  it('die unveränderte Ausgangsdatei ist gültig', async () => {
    expect(parse(await valid()).ok).toBe(true)
  })
  it.each([
    ['fehlt', undefined],
    ['als Text', '1'],
    ['Kommazahl', 1.5],
    ['null-Wert', null],
  ])('schemaVersion %s wird abgelehnt', async (_n, version) => {
    const b = await valid()
    const bad = { ...b, schemaVersion: version }
    expect(parse(bad).ok).toBe(false)
  })
  it('app in anderer Schreibweise wird abgelehnt', async () => {
    const b = await valid()
    expect(errorOf(parse({ ...b, app: 'StudiBudget' }))).toMatch(/keine StudiBudget-Backup/)
  })
  it.each([
    ['data als Liste', []],
    ['data null', null],
    ['data als Text', 'x'],
  ])('%s wird abgelehnt', async (_n, data) => {
    const b = await valid()
    expect(parse({ ...b, data }).ok).toBe(false)
  })
  it('eine Tabelle als Objekt statt Liste wird abgelehnt', async () => {
    const b = await valid()
    expect(parse({ ...b, data: { ...b.data, persons: {} } }).ok).toBe(false)
  })
  it('zwei Einstellungs-Zeilen werden abgelehnt', async () => {
    const b = await valid()
    b.data.settings.push({ ...b.data.settings[0], id: newId() })
    expect(errorOf(parse(b))).toMatch(/keine Einstellungen/)
  })
  it('eine Datei mit BOM am Anfang ist kein lesbares JSON', async () => {
    const json = JSON.stringify(await valid())
    expect(errorOf(parseBackup('﻿' + json))).toMatch(/kein lesbares JSON/)
    // Beim Einlesen einer Datei entfernt `Blob.text()` das BOM; das ist der Weg der App.
    const text = await new Blob(['﻿' + json]).text()
    expect(parseBackup(text).ok).toBe(true)
  })
  it('tief verschachteltes JSON bringt den Leser nicht zum Absturz', () => {
    const deep = '['.repeat(5000) + ']'.repeat(5000)
    expect(() => parseBackup(deep)).not.toThrow()
    expect(parseBackup(deep).ok).toBe(false)
  })
  it('__proto__ im JSON verändert Object.prototype nicht', async () => {
    const json = JSON.stringify(await valid()).replace(
      '"data":',
      '"__proto__":{"polluted":true},"data":',
    )
    parseBackup(json)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
  it('Grösse: genau am Limit wird gelesen, ein Zeichen mehr abgelehnt', () => {
    expect(errorOf(parseBackup('x'.repeat(MAX_BACKUP_BYTES + 1)))).toMatch(/zu gross/)
    expect(errorOf(parseBackup('x'.repeat(MAX_BACKUP_BYTES)))).toMatch(/kein lesbares JSON/)
  })
})

describe('Backup: Verweise und Aufbau', { tags: ['negativ'] }, () => {
  it(
    'Vorlage mit unbekannter Person im Anteil wird abgelehnt (Regression #39)',
    { tags: ['regression'] },
    async () => {
      const b = clone(await valid())
      b.data.templates[0].shared = {
        paidBy: 'me',
        parts: [
          { who: 'me', cents: 4000 },
          { who: newId(), cents: 4000 },
        ],
      }
      expect(errorOf(parse(b))).toMatch(/Vorlage verweist auf eine unbekannte Person/)
    },
  )
  it(
    'Buchung auf eine gelöschte Kategorie wird abgelehnt (Regression #40)',
    { tags: ['regression'] },
    async () => {
      const b = clone(await valid())
      const catId = b.data.transactions[0].categoryId as string
      b.data.categories.find((c) => c.id === catId)!.deleted = true
      expect(errorOf(parse(b))).toMatch(/Buchung verweist auf eine unbekannte Kategorie/)
    },
  )
  it(
    'gelöschte Zeilen mit ungültigen Verweisen stören nicht, sie werden nie eingespielt (Regression #40)',
    { tags: ['regression'] },
    async () => {
      const b = clone(await valid())
      b.data.transactions[0].deleted = true
      b.data.transactions[0].categoryId = newId()
      expect(parse(b).ok).toBe(true)
    },
  )
  it(
    'doppelte IDs in einer Tabelle werden abgelehnt (Regression #41)',
    { tags: ['regression'] },
    async () => {
      const b = clone(await valid())
      b.data.persons.push({ ...b.data.persons[0] })
      expect(errorOf(parse(b))).toMatch(/doppelt/)
    },
  )
  it('Kontostand ohne Konto wird abgelehnt', async () => {
    const b = clone(await valid())
    b.data.accounts = []
    expect(errorOf(parse(b))).toMatch(/Kontostand verweist auf ein unbekanntes Konto/)
  })
})

describe('Backup: Export mit verwaistem Kontostand', { tags: ['negativ'] }, () => {
  it(
    'der Kontostand eines gelöschten Kontos kommt nicht ins Backup (Regression #43)',
    { tags: ['regression'] },
    async () => {
      const db = fresh()
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
      const store = createStore(db)
      const accountId = newId()
      await store.put('accounts', {
        id: accountId,
        deleted: false,
        name: 'Alt',
        kind: 'bank',
        include: true,
        order: 0,
      })
      // Gerät A löscht das Konto, Gerät B hat gleichzeitig einen Stand erfasst: nach dem Sync bleibt der Stand übrig.
      await store.remove('accounts', accountId)
      await store.put('accountBalances', {
        id: newId(),
        deleted: false,
        accountId,
        month: '2026-10',
        amountCents: 500,
      })
      const result = parse(await exportBackup(db))
      expect(errorOf(result)).toBe('')
      expect(result.ok && result.counts.accountBalances).toBe(0)
    },
  )
})
