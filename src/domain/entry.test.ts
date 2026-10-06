import { describe, expect, it } from 'vitest'
import { buildEntry, MAX_NOTE_LENGTH, type EntryInput } from './entry'
import { groupMonth } from './ledger'
import { rescaleShared, splitByWeights } from './split'
import { openTemplates, templateToDraft } from './templates'
import type { Area, Category, Template, Transaction } from './types'

const base: EntryInput = {
  id: 't1',
  type: 'ausgabe',
  categoryId: 'c1',
  amount: '23.50',
  date: '2026-10-03',
  note: ' Migros ',
  shared: null,
  goal: null,
}
const ok = (i: Partial<EntryInput>) => {
  const r = buildEntry({ ...base, ...i })
  if (!r.ok) throw new Error(r.error)
  return r.draft
}
const err = (i: Partial<EntryInput>) => {
  const r = buildEntry({ ...base, ...i })
  return r.ok ? null : r.error
}

describe('buildEntry', () => {
  it('einfache Ausgabe: Cent, bereinigte Notiz, voller Eigenanteil', () => {
    expect(ok({})).toEqual({
      id: 't1',
      deleted: false,
      date: '2026-10-03',
      categoryId: 'c1',
      amountCents: 2350,
      myAmountCents: 2350,
      note: 'Migros',
    })
  })
  it('akzeptiert Komma und Tausenderzeichen', () => {
    expect(ok({ amount: "1'234,5" }).amountCents).toBe(123450)
    expect(ok({ amount: '3500*60%' }).amountCents).toBe(210000) // Rechnen im Betragsfeld, #88
    expect(err({ amount: '5/0' })).toMatch(/gültigen Betrag/)
  })
  it.each([
    [{ amount: '' }, 'gültigen Betrag'],
    [{ amount: 'abc' }, 'gültigen Betrag'],
    [{ amount: '0' }, 'grösser als 0'],
    [{ amount: '-5' }, 'grösser als 0'],
    [{ amount: '999999999999' }, 'zu gross'],
    [{ categoryId: '' }, 'Kategorie'],
    [{ date: '2026-02-30' }, 'Datum'],
    [{ date: '03.10.2026' }, 'Datum'],
    [{ note: 'x'.repeat(MAX_NOTE_LENGTH + 1) }, 'Notiz'],
  ] as [Partial<EntryInput>, string][])('lehnt %j ab', (input, msg) => {
    expect(err(input)).toContain(msg)
  })

  it('WG: 90.00 von mir bezahlt, drei Beteiligte → Eigenanteil 30.00', () => {
    const d = ok({
      amount: '90',
      shared: { paidBy: 'me', mode: 'equal', participants: ['me', 'anna', 'ben'] },
    })
    expect(d.amountCents).toBe(9000)
    expect(d.myAmountCents).toBe(3000)
    expect(d.shared!.parts.map((p) => p.cents)).toEqual([3000, 3000, 3000])
  })
  it('WG: Rundungsrest geht auf, Summe der Anteile = Betrag', () => {
    const d = ok({
      amount: '10',
      shared: { paidBy: 'anna', mode: 'equal', participants: ['me', 'anna', 'ben'] },
    })
    expect(d.shared!.parts.reduce((s, p) => s + p.cents, 0)).toBe(1000)
    expect(d.shared!.paidBy).toBe('anna')
  })
  it('Partner 60/40 von 100.01', () => {
    const d = ok({
      amount: '100.01',
      shared: {
        paidBy: 'me',
        mode: 'percent',
        participants: ['me', 'p'],
        partnerId: 'p',
        myPct: 60,
      },
    })
    expect(d.myAmountCents).toBe(6001)
    expect(d.shared!.parts.reduce((s, p) => s + p.cents, 0)).toBe(10001)
  })
  it('prüft Teilen: nur Ausgaben, Beteiligte, Prozent', () => {
    const shared = { paidBy: 'me', mode: 'equal' as const, participants: ['me', 'a'] }
    expect(err({ type: 'einnahme', shared })).toContain('Nur Ausgaben')
    expect(err({ shared: { ...shared, participants: [] } })).toContain('beteiligte')
    expect(
      err({
        shared: { paidBy: 'me', mode: 'percent', participants: ['me'], partnerId: 'p', myPct: 101 },
      }),
    ).toContain('0 und 100')
    expect(
      err({ shared: { paidBy: 'me', mode: 'percent', participants: ['me'], myPct: 50 } }),
    ).toContain('0 und 100')
  })
  it('Sparziel nur bei Sparen; Entnahme wird festgehalten', () => {
    expect(err({ goal: { id: 'g', direction: 'einzahlung' } })).toContain('Sparziel')
    const d = ok({ type: 'sparen', goal: { id: 'g', direction: 'entnahme' } })
    expect(d).toMatchObject({ goalId: 'g', goalDirection: 'entnahme' })
  })
  it('Herkunft aus einer Vorlage bleibt beim Bearbeiten erhalten', () => {
    expect(ok({ existing: { templateId: 'tp', templateMonth: '2026-10' } })).toMatchObject({
      templateId: 'tp',
      templateMonth: '2026-10',
    })
  })
})

describe('split by weights', () => {
  it('Summe stimmt, grösster Rest zuerst', () => {
    expect(splitByWeights(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(splitByWeights(1001, [3000, 3000, 3000]).reduce((a, b) => a + b)).toBe(1001)
    expect(splitByWeights(500, [0, 0])).toEqual([250, 250])
  })
  it('Aufteilung wird auf neuen Betrag übertragen', () => {
    const s = rescaleShared(
      {
        paidBy: 'me',
        parts: [
          { who: 'me', cents: 40000 },
          { who: 'p', cents: 40000 },
        ],
      },
      90000,
    )
    expect(s.parts.map((p) => p.cents)).toEqual([45000, 45000])
  })
})

const area = (id: string, name: string, order: number): Area => ({
  id,
  name,
  order,
  hidden: false,
  deleted: false,
  updatedAt: '',
})
const cat = (id: string, areaId: string, order: number): Category => ({
  id,
  areaId,
  name: id,
  order,
  type: 'ausgabe',
  fix: false,
  rolloverFrom: null,
  hidden: false,
  deleted: false,
  updatedAt: '',
})
const tx = (
  id: string,
  date: string,
  categoryId: string,
  my: number,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id,
  date,
  categoryId,
  amountCents: my,
  myAmountCents: my,
  note: '',
  deleted: false,
  updatedAt: id,
  ...extra,
})

describe('groupMonth', () => {
  const areas = [area('b', 'Zweiter', 1), area('a', 'Erster', 0), area('e', 'Leer', 2)]
  const cats = [cat('c2', 'b', 0), cat('c1', 'a', 1), cat('c0', 'a', 0)]
  it('sortiert nach Bereich/Kategorie, summiert, ignoriert andere Monate und Gelöschte', () => {
    const g = groupMonth(
      [
        tx('1', '2026-10-02', 'c1', 1000),
        tx('2', '2026-10-05', 'c1', 500),
        tx('3', '2026-10-01', 'c0', 200),
        tx('4', '2026-10-09', 'c2', 700),
        tx('5', '2026-09-30', 'c2', 9999),
        tx('6', '2026-10-09', 'c2', 9999, { deleted: true }),
        tx('7', '2026-10-09', 'unbekannt', 9999),
      ],
      cats,
      areas,
      '2026-10',
    )
    expect(g.map((a) => a.area.name)).toEqual(['Erster', 'Zweiter'])
    expect(g[0].categories.map((c) => c.category.id)).toEqual(['c0', 'c1'])
    expect(g[0].categories[1].txs.map((t) => t.id)).toEqual(['2', '1'])
    expect(g[0].total).toBe(1700)
    expect(g[1].total).toBe(700)
  })
  it('Entnahmen aus Sparzielen zählen negativ', () => {
    const g = groupMonth(
      [
        tx('1', '2026-10-02', 'c0', 3000),
        tx('2', '2026-10-03', 'c0', 1000, { goalDirection: 'entnahme' }),
      ],
      cats,
      areas,
      '2026-10',
    )
    expect(g[0].total).toBe(2000)
  })
})

describe('Vorlagen', () => {
  const tpl = (over: Partial<Template> = {}): Template => ({
    id: 'tp',
    deleted: false,
    updatedAt: '',
    categoryId: 'c1',
    amountCents: 160000,
    note: 'Miete',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    active: true,
    shared: {
      paidBy: 'me',
      parts: [
        { who: 'me', cents: 80000 },
        { who: 'p', cents: 80000 },
      ],
    },
    ...over,
  })
  it('offen = aktiv, im Monat fällig und noch nicht gebucht', () => {
    const t = tpl()
    expect(openTemplates([t], [], '2026-10')).toHaveLength(1)
    expect(openTemplates([tpl({ active: false })], [], '2026-10')).toHaveLength(0)
    expect(openTemplates([tpl({ months: [1] })], [], '2026-10')).toHaveLength(0)
    expect(openTemplates([tpl({ deleted: true })], [], '2026-10')).toHaveLength(0)
    const booked = tx('x', '2026-10-01', 'c1', 80000, {
      templateId: 'tp',
      templateMonth: '2026-10',
    })
    expect(openTemplates([t], [booked], '2026-10')).toHaveLength(0)
    expect(openTemplates([t], [booked], '2026-11')).toHaveLength(1) // anderer Monat
    expect(openTemplates([t], [{ ...booked, deleted: true }], '2026-10')).toHaveLength(1) // gelöschte Buchung zählt nicht
  })
  it('Buchung aus Vorlage mit angepasstem Betrag rechnet die Aufteilung mit', () => {
    const d = templateToDraft(tpl(), '2026-10', 'new', 180000)
    expect(d).toMatchObject({
      date: '2026-10-01',
      amountCents: 180000,
      myAmountCents: 90000,
      templateId: 'tp',
      templateMonth: '2026-10',
      note: 'Miete',
    })
    expect(d.shared!.parts.map((p) => p.cents)).toEqual([90000, 90000])
  })
  it('ohne Aufteilung ist der Eigenanteil der volle Betrag', () => {
    expect(templateToDraft(tpl({ shared: undefined }), '2026-10', 'n').myAmountCents).toBe(160000)
  })
})
