import { describe, expect, it } from 'vitest'
import { buildStats } from './statsView'
import type { Area, Budget, Category, Transaction } from './types'

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
  cat('essen', 'l', 'ausgabe'),
  cat('mensa', 'l', 'ausgabe', { order: 1 }),
  cat('etf', 's', 'sparen'),
  cat('alt', 'l', 'ausgabe', { hidden: true, order: 9 }),
]
const areas = [area('e', 0), area('w', 1), area('l', 2), area('s', 3)]
const budgets = [
  bud('lohn', '2026-08', 200000),
  bud('miete', '2026-08', 80000),
  bud('essen', '2026-08', 30000),
  bud('essen', '2026-10', 40000), // ab Oktober mehr
  bud('etf', '2026-08', 10000),
  bud('alt', '2026-08', 99999),
]
const txs = [
  tx('2026-08-01', 'lohn', 200000),
  tx('2026-08-02', 'miete', 80000),
  tx('2026-08-10', 'essen', 25000),
  tx('2026-09-01', 'lohn', 200000),
  tx('2026-09-02', 'miete', 80000),
  tx('2026-09-12', 'essen', 35000),
  tx('2026-09-13', 'mensa', 5000),
  tx('2026-09-14', 'etf', 10000),
  tx('2026-10-02', 'miete', 80000),
  tx('2026-10-20', 'essen', 52000),
  tx('2026-07-31', 'essen', 999999), // ausserhalb
  tx('2026-09-15', 'essen', 999999, { deleted: true }),
]
const stats = buildStats({ from: '2026-08', to: '2026-10', categories, areas, budgets, txs })

describe('Zeitraum-Summen', () => {
  it('eine Zeile pro Monat, auch ohne Buchungen', () => {
    expect(stats.months.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(stats.months[2]).toMatchObject({ einnahmen: 0, ausgaben: 132000 })
  })
  it('Totale und Saldo', () => {
    expect(stats.totals).toEqual({
      einnahmen: 400000,
      ausgaben: 80000 * 3 + 25000 + 35000 + 5000 + 52000,
      sparen: 10000,
      saldo: 400000 - 357000 - 10000,
    })
  })
  it('Kennzahlen', () => {
    expect(stats.key.avgExpensesPerMonth).toBe(119000)
    expect(stats.key.savingsRatePct).toBeCloseTo(2.5)
    expect(stats.key.mostExpensiveMonth).toBe('2026-10')
  })
})

describe('Ausgaben nach Bereich', () => {
  it('sortiert nach Summe, mit Anteil und Kategorien (nur Eigenanteil, ohne Einnahmen und Sparen)', () => {
    expect(stats.expensesByArea.map((a) => a.area.id)).toEqual(['w', 'l'])
    const l = stats.expensesByArea[1]
    expect(l.total).toBe(117000)
    expect(l.categories.map((c) => [c.category.id, c.total])).toEqual([
      ['essen', 112000],
      ['mensa', 5000],
    ])
    expect(stats.expensesByArea.reduce((s, a) => s + a.sharePct, 0)).toBeCloseTo(100)
  })
  it('geteilte Ausgaben zählen mit dem Eigenanteil', () => {
    const s = buildStats({
      from: '2026-08',
      to: '2026-08',
      categories,
      areas,
      budgets,
      txs: [tx('2026-08-05', 'essen', 1000, { amountCents: 3000 })],
    })
    expect(s.expensesByArea[0].total).toBe(1000)
  })
  it('ohne Ausgaben ist die Liste leer und der Anteil 0', () => {
    const s = buildStats({ from: '2026-08', to: '2026-08', categories, areas, budgets, txs: [] })
    expect(s.expensesByArea).toEqual([])
    expect(s.key.avgExpensesPerMonth).toBe(0)
  })
})

describe('Plan vs. Ist', () => {
  const row = (id: string) =>
    stats.planVsActual.flatMap((a) => a.rows).find((r) => r.category.id === id)!
  it('Plan = Summe der Monatsbudgets im Zeitraum, mit Budgetwechsel mitten drin', () => {
    expect(row('essen')).toMatchObject({ plan: 30000 + 30000 + 40000, actual: 112000, diff: 12000 })
    expect(row('miete')).toMatchObject({ plan: 240000, actual: 240000, diff: 0 })
    expect(row('lohn')).toMatchObject({ plan: 600000, actual: 400000, diff: -200000 })
  })
  it('Kategorien ohne Budget zeigen ihre Ausgaben mit Plan 0', () => {
    expect(row('mensa')).toMatchObject({ plan: 0, actual: 5000, diff: 5000 })
  })
  it('ausgeblendete Kategorien zählen nicht zum Plan; leere Zeilen entfallen', () => {
    expect(stats.planVsActual.flatMap((a) => a.rows).some((r) => r.category.id === 'alt')).toBe(
      false,
    )
  })
  it('Bereichssummen', () => {
    const l = stats.planVsActual.find((a) => a.area.id === 'l')!
    expect(l).toMatchObject({ plan: 100000, actual: 117000, diff: 17000 })
  })
})
