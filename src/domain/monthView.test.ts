import { describe, expect, it } from 'vitest'
import { buildMonthView, type MonthViewInput } from './monthView'
import type { Area, Budget, Category, Template, Transaction } from './types'

const base = { deleted: false, updatedAt: '' }
const area = (id: string, order: number): Area => ({ ...base, id, name: id, order, hidden: false })
const cat = (
  id: string,
  areaId: string,
  type: Category['type'],
  over: Partial<Category> = {},
): Category => ({
  ...base,
  id,
  areaId,
  name: id,
  type,
  fix: false,
  rolloverFrom: null,
  hidden: false,
  order: 0,
  ...over,
})
const bud = (categoryId: string, validFrom: string, amountCents: number): Budget => ({
  ...base,
  id: `${categoryId}-${validFrom}`,
  categoryId,
  validFrom,
  amountCents,
})
let n = 0
const tx = (
  date: string,
  categoryId: string,
  cents: number,
  over: Partial<Transaction> = {},
): Transaction => ({
  ...base,
  id: `t${++n}`,
  date,
  categoryId,
  amountCents: cents,
  myAmountCents: cents,
  note: '',
  ...over,
})

const categories = [
  cat('lohn', 'e', 'einnahme'),
  cat('miete', 'w', 'ausgabe', { fix: true }),
  cat('essen', 'w', 'ausgabe', { order: 1 }),
  cat('spass', 'f', 'ausgabe'),
  cat('etf', 's', 'sparen'),
  cat('alt', 'f', 'ausgabe', { hidden: true, order: 5 }),
]
const areas = [area('e', 0), area('w', 1), area('f', 2), area('s', 3)]
const budgets = [
  bud('lohn', '2026-01', 200000),
  bud('miete', '2026-01', 80000),
  bud('essen', '2026-01', 40000),
  bud('spass', '2026-01', 10000),
  bud('etf', '2026-01', 20000),
]

const input = (over: Partial<MonthViewInput> = {}): MonthViewInput => ({
  month: '2026-10',
  today: { month: '2026-10', day: 10 },
  categories,
  areas,
  budgets,
  txs: [],
  templates: [],
  ampel: { yellowPct: 80, redPct: 100 },
  ...over,
})

describe('Restbudget und Ampel', () => {
  const txs = [
    tx('2026-10-01', 'lohn', 200000),
    tx('2026-10-01', 'miete', 80000),
    tx('2026-10-05', 'essen', 33000), // 82.5 % → gelb
    tx('2026-10-06', 'spass', 12000), // 120 % → rot
    tx('2026-10-07', 'etf', 20000),
    tx('2026-10-08', 'alt', 500), // ausgeblendet, aber mit Buchung
  ]
  const v = buildMonthView(input({ txs }))
  const row = (id: string) => v.areas.flatMap((a) => a.rows).find((r) => r.category.id === id)!

  it('Ampel pro Ausgabe-Kategorie, Rest als Differenz', () => {
    expect(row('miete')).toMatchObject({ actual: 80000, remaining: 0, ampel: { status: 'rot' } }) // 100 % = rot
    expect(row('essen')).toMatchObject({ remaining: 7000, ampel: { status: 'gelb' } })
    expect(row('spass')).toMatchObject({ remaining: -2000, ampel: { status: 'rot' } })
  })
  it('Einnahmen und Sparen haben keine Ampel, aber einen Fortschritt', () => {
    expect(row('lohn')).toMatchObject({ ampel: null, pct: 100 })
    expect(row('etf')).toMatchObject({ ampel: null, pct: 100 })
  })
  it('ausgeblendete Kategorien erscheinen nur mit Buchungen im Monat', () => {
    expect(row('alt')).toMatchObject({ actual: 500, ampel: { noBudget: true, status: 'rot' } })
    expect(
      buildMonthView(input())
        .areas.flatMap((a) => a.rows)
        .some((r) => r.category.id === 'alt'),
    ).toBe(false)
  })
  it('Bereiche und Zeilen sind sortiert, leere Bereiche entfallen', () => {
    expect(v.areas.map((a) => a.area.id)).toEqual(['e', 'w', 'f', 's'])
    expect(v.areas[1].rows.map((r) => r.category.id)).toEqual(['miete', 'essen'])
    expect(
      buildMonthView(input({ categories: categories.filter((c) => c.id !== 'etf') })).areas.map(
        (a) => a.area.id,
      ),
    ).not.toContain('s')
  })
  it('Kategorien ohne Budget und Buchung werden nicht gezeigt', () => {
    const none = buildMonthView(input({ budgets: [], txs: [] }))
    expect(none.areas).toEqual([])
  })
})

describe('Plan, Ist, Prognose', () => {
  it('Plan aus Budgets, Ist aus Buchungen, Saldo = Einnahmen − Ausgaben − Sparen', () => {
    const v = buildMonthView(
      input({
        txs: [
          tx('2026-10-01', 'lohn', 200000),
          tx('2026-10-02', 'miete', 80000),
          tx('2026-10-03', 'etf', 20000),
        ],
      }),
    )
    expect(v.einnahmen).toMatchObject({ plan: 200000, actual: 200000 })
    expect(v.ausgaben).toMatchObject({ plan: 130000, actual: 80000 })
    expect(v.saldo).toMatchObject({ plan: 50000, actual: 100000 })
  })
  it('laufender Monat: Hochrechnung = gebuchte Fixkosten + offene Vorlagen + variable Ausgaben hochgerechnet', () => {
    const template: Template = {
      ...base,
      id: 'tp',
      categoryId: 'miete',
      amountCents: 80000,
      note: '',
      months: [10],
      active: true,
    }
    const noRent = buildMonthView(
      input({
        today: { month: '2026-10', day: 10 },
        txs: [tx('2026-10-05', 'essen', 31000)],
        templates: [template],
      }),
    )
    // variabel: 31000 / 10 Tage × 31 Tage = 96100; offene Miete 80000
    expect(noRent.ausgaben.forecast).toBe(96100 + 80000)
    const booked = buildMonthView(
      input({
        today: { month: '2026-10', day: 10 },
        txs: [tx('2026-10-01', 'miete', 80000, { templateId: 'tp', templateMonth: '2026-10' })],
        templates: [template],
      }),
    )
    expect(booked.ausgaben.forecast).toBe(80000) // Fixkosten bereits gebucht, nichts offen, nichts variabel
  })
  it('laufender Monat: offene Einnahmen-Vorlage zählt in die Einnahmen-Prognose', () => {
    const lohn: Template = {
      ...base,
      id: 'l',
      categoryId: 'lohn',
      amountCents: 200000,
      note: '',
      months: [10],
      active: true,
    }
    const v = buildMonthView(input({ templates: [lohn] }))
    expect(v.einnahmen).toMatchObject({ actual: 0, forecast: 200000 })
    expect(v.saldo.forecast).toBe(200000)
  })
  it('geteilte offene Vorlage zählt nur mit dem Eigenanteil', () => {
    const shared: Template = {
      ...base,
      id: 'm',
      categoryId: 'miete',
      amountCents: 160000,
      note: '',
      months: [10],
      active: true,
      shared: {
        paidBy: 'me',
        parts: [
          { who: 'me', cents: 80000 },
          { who: 'p', cents: 80000 },
        ],
      },
    }
    expect(buildMonthView(input({ templates: [shared] })).ausgaben.forecast).toBe(80000)
  })
  it('vergangener Monat: Prognose = Ist; künftiger Monat: keine Prognose', () => {
    const txs = [tx('2026-09-02', 'miete', 80000)]
    const past = buildMonthView(input({ month: '2026-09', txs }))
    expect(past.phase).toBe('past')
    expect(past.ausgaben.forecast).toBe(80000)
    const future = buildMonthView(input({ month: '2026-12', txs }))
    expect(future.phase).toBe('future')
    expect(future.ausgaben.forecast).toBeNull()
    expect(future.ausgaben.plan).toBe(130000)
  })
})

describe('Vergleich', () => {
  it('Vormonat und Durchschnitt der letzten 3 Monate mit Buchungen (Lücken zählen nicht)', () => {
    const txs = [
      tx('2026-06-05', 'essen', 10000),
      tx('2026-07-05', 'essen', 20000),
      // August ohne Buchungen
      tx('2026-09-05', 'essen', 30000),
      tx('2026-10-05', 'essen', 50000),
    ]
    const c = buildMonthView(input({ txs })).compare.ausgaben
    expect(c).toEqual({ current: 50000, prev: 30000, avg3: 20000 })
  })
  it('ohne frühere Daten gibt es keine Vergleichswerte', () => {
    expect(
      buildMonthView(input({ txs: [tx('2026-10-05', 'essen', 100)] })).compare.ausgaben,
    ).toEqual({ current: 100, prev: null, avg3: null })
  })
  it('Vormonat ohne Buchungen ist «keine Daten», der Durchschnitt nutzt ältere Monate', () => {
    const c = buildMonthView(
      input({ txs: [tx('2026-07-05', 'essen', 9000), tx('2026-10-05', 'essen', 100)] }),
    ).compare.ausgaben
    expect(c).toMatchObject({ prev: null, avg3: 9000 })
  })
})

describe('Top-Ausgaben', () => {
  it('die fünf grössten Ausgaben des Monats, nur Ausgaben, Eigenanteil', () => {
    const txs = [
      tx('2026-10-01', 'lohn', 999999),
      tx('2026-10-02', 'miete', 80000),
      tx('2026-10-03', 'essen', 100),
      tx('2026-10-04', 'essen', 200),
      tx('2026-10-05', 'essen', 300),
      tx('2026-10-06', 'essen', 400),
      tx('2026-10-07', 'essen', 500),
      tx('2026-09-30', 'essen', 777777),
      tx('2026-10-08', 'essen', 5000, { amountCents: 10000 }), // geteilt: Eigenanteil 50.00
    ]
    const top = buildMonthView(input({ txs })).top
    expect(top.map((t) => t.myAmountCents)).toEqual([80000, 5000, 500, 400, 300])
  })
})
