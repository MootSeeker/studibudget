import { describe, expect, it } from 'vitest'
import { actualForMonth, budgetForMonth, rolloverCents } from './budget'
import { goalBalance, neededPerMonth } from './goals'
import { formatMoney, parseAmount } from './money'
import { ampel, averageOfMonths, forecastExpenses } from './month'
import {
  addMonths,
  daysInMonth,
  defaultSemesters,
  monthRange,
  resolvePeriod,
  semesterOf,
} from './period'
import { balances } from './settlement'
import { buildSharedEqual, buildSharedPartner, myShare, splitByPercent, splitEqual } from './split'
import { keyFigures, totalsByMonth } from './stats'
import type { Budget, Category, Goal, Settlement, Transaction } from './types'

const base = { updatedAt: '2026-01-01T00:00:00Z', deleted: false }
const tx = (
  p: Partial<Transaction> & { id: string; date: string; categoryId: string; myAmountCents: number },
): Transaction => ({
  ...base,
  amountCents: p.myAmountCents,
  note: '',
  ...p,
})
const cat = (
  id: string,
  type: Category['type'],
  fix = false,
  rolloverFrom: string | null = null,
): Category => ({
  ...base,
  id,
  areaId: 'a',
  name: id,
  type,
  fix,
  rolloverFrom,
  hidden: false,
  order: 0,
})
const bud = (id: string, categoryId: string, validFrom: string, amountCents: number): Budget => ({
  ...base,
  id,
  categoryId,
  validFrom,
  amountCents,
})

describe('money', () => {
  it('formatiert nach Land', () => {
    const norm = (s: string) => s.replace(/\s/g, ' ').replace('’', "'")
    expect(norm(formatMoney(123450, 'CH'))).toBe("CHF 1'234.50")
    expect(norm(formatMoney(123450, 'DE'))).toBe('1.234,50 €')
  })
  it.each([
    ['23.50', 2350],
    ['23,5', 2350],
    ["1'234.50", 123450],
    ['1.234,50', 123450],
    ['1,234.50', 123450],
    ['1.234', 123400],
    ['12', 1200],
    ['0.05', 5],
    ['CHF 5', 500],
  ])('liest «%s» als %i Cent', (input, cents) => {
    expect(parseAmount(input)).toBe(cents)
  })
  it.each(['', 'abc', '1.2.3,4,5x', '12.345,678'])('lehnt «%s» ab', (input) => {
    expect(parseAmount(input)).toBeNull()
  })
})

describe('split', () => {
  it('teilt 90.00 durch 3', () => expect(splitEqual(9000, 3)).toEqual([3000, 3000, 3000]))
  it('Rundungsrest geht an die ersten, Summe stimmt', () => {
    const parts = splitEqual(1000, 3)
    expect(parts).toEqual([334, 333, 333])
    expect(parts.reduce((a, b) => a + b)).toBe(1000)
  })
  it('Partner 60/40 von 100.01', () => {
    const [a, b] = splitByPercent(10001, [60, 40])
    expect(a + b).toBe(10001)
    expect(a).toBe(6001)
  })
  it('WG mit 3 Personen, von mir bezahlt: Eigenanteil 30.00', () => {
    const s = buildSharedEqual(9000, 'me', ['me', 'anna', 'ben'])
    expect(myShare(9000, s)).toBe(3000)
  })
  it('Partner 50/50', () => {
    const s = buildSharedPartner(8000, 'me', 'p1', 50)
    expect(myShare(8000, s)).toBe(4000)
  })
  it('ungeteilt: voller Betrag', () => expect(myShare(1234)).toBe(1234))
})

describe('period', () => {
  it('addMonths über Jahreswechsel', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
  it('monthRange und daysInMonth', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
  })
  it('CH-Herbstsemester läuft über den Jahreswechsel', () => {
    const sem = defaultSemesters('CH')
    expect(semesterOf('2026-10', sem)).toMatchObject({ from: '2026-08', to: '2027-01' })
    expect(semesterOf('2027-01', sem)).toMatchObject({ from: '2026-08', to: '2027-01' })
    expect(semesterOf('2027-03', sem)).toMatchObject({ from: '2027-02', to: '2027-07' })
  })
  it('DE-Wintersemester Okt–Mär', () => {
    expect(semesterOf('2027-02', defaultSemesters('DE'))).toMatchObject({
      from: '2026-10',
      to: '2027-03',
    })
  })
  it('weitere Zeiträume', () => {
    const sem = defaultSemesters('CH')
    expect(resolvePeriod('halbjahr', '2026-08', sem)).toMatchObject({
      from: '2026-07',
      to: '2026-12',
    })
    expect(resolvePeriod('jahr', '2026-08', sem)).toMatchObject({ from: '2026-01', to: '2026-12' })
    expect(resolvePeriod('letzte6', '2026-10', sem)).toMatchObject({
      from: '2026-05',
      to: '2026-10',
    })
    expect(resolvePeriod('letzte12', '2026-10', sem)).toMatchObject({
      from: '2025-11',
      to: '2026-10',
    })
    expect(resolvePeriod('studienjahr', '2027-03', sem)).toMatchObject({
      from: '2026-08',
      to: '2027-07',
    })
    expect(resolvePeriod('studienjahr', '2026-10', sem)).toMatchObject({
      from: '2026-08',
      to: '2027-07',
    })
    expect(resolvePeriod('frei', '2026-10', sem, { from: '2026-03', to: '2026-05' })).toMatchObject(
      { from: '2026-03', to: '2026-05' },
    )
  })
})

describe('budget', () => {
  const budgets = [bud('1', 'c', '2026-01', 30000), bud('2', 'c', '2026-06', 40000)]
  it('nimmt den neuesten Eintrag bis zum Monat', () => {
    expect(budgetForMonth(budgets, 'c', '2026-03')).toBe(30000)
    expect(budgetForMonth(budgets, 'c', '2026-06')).toBe(40000)
    expect(budgetForMonth(budgets, 'c', '2025-12')).toBe(0)
  })
  it('Übertrag: Rest wird addiert, Überschreitung abgezogen', () => {
    const txs = [
      tx({ id: 't1', date: '2026-01-10', categoryId: 'c', myAmountCents: 20000 }), // Rest +100
      tx({ id: 't2', date: '2026-02-10', categoryId: 'c', myAmountCents: 35000 }), // -50
    ]
    const c = { id: 'c', rolloverFrom: '2026-01' }
    expect(rolloverCents(c, '2026-02', budgets, txs)).toBe(10000)
    expect(rolloverCents(c, '2026-03', budgets, txs)).toBe(5000)
    expect(rolloverCents({ id: 'c', rolloverFrom: null }, '2026-03', budgets, txs)).toBe(0)
  })
  it('Ist ignoriert gelöschte Buchungen', () => {
    const txs = [
      tx({ id: 't', date: '2026-01-10', categoryId: 'c', myAmountCents: 500, deleted: true }),
    ]
    expect(actualForMonth(txs, 'c', '2026-01')).toBe(0)
  })
})

describe('month', () => {
  it('Ampel-Schwellen', () => {
    expect(ampel(7900, 10000, 80, 100).status).toBe('gruen')
    expect(ampel(8000, 10000, 80, 100).status).toBe('gelb')
    expect(ampel(10000, 10000, 80, 100).status).toBe('rot')
  })
  it('ohne Budget: rot nur bei Ausgaben', () => {
    expect(ampel(500, 0, 80, 100)).toMatchObject({ status: 'rot', noBudget: true })
    expect(ampel(0, 0, 80, 100)).toMatchObject({ status: 'gruen', noBudget: true })
  })
  it('Hochrechnung: Tag 10 von 30, 300.00 variabel → 900.00 + Fixkosten', () => {
    expect(
      forecastExpenses({
        month: '2026-09',
        dayOfMonth: 10,
        fixBooked: 80000,
        fixOpen: 5000,
        variableSoFar: 30000,
      }),
    ).toBe(175000)
  })
  it('Durchschnitt nur über Monate mit Daten', () => {
    expect(averageOfMonths([0, 100, 0, 200, 300, 400], 3)).toBe(300)
    expect(averageOfMonths([0, 0])).toBeNull()
  })
})

describe('stats', () => {
  const cats = [
    cat('lohn', 'einnahme'),
    cat('miete', 'ausgabe', true),
    cat('essen', 'ausgabe'),
    cat('spar', 'sparen'),
  ]
  const txs = [
    tx({ id: '1', date: '2026-08-01', categoryId: 'lohn', myAmountCents: 200000 }),
    tx({ id: '2', date: '2026-08-02', categoryId: 'miete', myAmountCents: 80000 }),
    tx({ id: '3', date: '2026-08-05', categoryId: 'essen', myAmountCents: 20000 }),
    tx({ id: '4', date: '2026-08-06', categoryId: 'spar', myAmountCents: 20000 }),
    tx({ id: '5', date: '2026-09-02', categoryId: 'miete', myAmountCents: 80000 }),
    tx({ id: '6', date: '2026-12-02', categoryId: 'miete', myAmountCents: 99999 }), // ausserhalb
  ]
  const totals = totalsByMonth(txs, cats, '2026-08', '2026-09')
  it('Monatssummen und Saldo', () => {
    expect(totals[0]).toMatchObject({
      month: '2026-08',
      einnahmen: 200000,
      ausgaben: 100000,
      sparen: 20000,
      saldo: 80000,
    })
    expect(totals[1]).toMatchObject({ ausgaben: 80000, saldo: -80000 })
  })
  it('Kennzahlen', () => {
    const k = keyFigures(totals, txs, cats)
    expect(k.avgExpensesPerMonth).toBe(90000)
    expect(k.savingsRatePct).toBe(10)
    expect(k.fixSharePct).toBeCloseTo((160000 / 180000) * 100)
    expect(k.mostExpensiveMonth).toBe('2026-08')
  })
})

describe('settlement', () => {
  it('WG: ich bezahle 90.00, Anna und Ben schulden je 30.00', () => {
    const t = tx({
      id: 'a',
      date: '2026-10-01',
      categoryId: 'x',
      amountCents: 9000,
      myAmountCents: 3000,
      shared: buildSharedEqual(9000, 'me', ['me', 'anna', 'ben']),
    })
    const b = balances([t], [])
    expect(b.get('anna')).toBe(3000)
    expect(b.get('ben')).toBe(3000)
  })
  it('Anna bezahlt 60.00 für mich und sie: ich schulde 30.00', () => {
    const t = tx({
      id: 'b',
      date: '2026-10-01',
      categoryId: 'x',
      amountCents: 6000,
      myAmountCents: 3000,
      shared: buildSharedEqual(6000, 'anna', ['me', 'anna']),
    })
    expect(balances([t], []).get('anna')).toBe(-3000)
  })
  it('Ausgleichszahlung bringt den Saldo auf null', () => {
    const t = tx({
      id: 'b',
      date: '2026-10-01',
      categoryId: 'x',
      amountCents: 6000,
      myAmountCents: 3000,
      shared: buildSharedEqual(6000, 'anna', ['me', 'anna']),
    })
    const s: Settlement = {
      ...base,
      id: 's',
      date: '2026-10-05',
      personId: 'anna',
      direction: 'ich_zahle',
      amountCents: 3000,
      note: '',
    }
    expect(balances([t], [s]).get('anna')).toBe(0)
  })
})

describe('goals', () => {
  const goal: Goal = {
    ...base,
    id: 'g',
    name: 'Ferien',
    targetCents: 100000,
    targetDate: '2027-01-31',
    startCents: 10000,
    archived: false,
  }
  const txs = [
    tx({
      id: '1',
      date: '2026-09-01',
      categoryId: 's',
      myAmountCents: 30000,
      goalId: 'g',
      goalDirection: 'einzahlung',
    }),
    tx({
      id: '2',
      date: '2026-09-15',
      categoryId: 's',
      myAmountCents: 5000,
      goalId: 'g',
      goalDirection: 'entnahme',
    }),
  ]
  it('Stand = Start + Einzahlungen − Entnahmen', () => expect(goalBalance(goal, txs)).toBe(35000))
  it('nötige Monatsrate bis Zielmonat (Okt–Jan = 4 Monate)', () => {
    expect(neededPerMonth(goal, 35000, '2026-10')).toBe(16250)
    expect(neededPerMonth(goal, 100000, '2026-10')).toBe(0)
    expect(neededPerMonth({ ...goal, targetDate: null }, 0, '2026-10')).toBeNull()
  })
})
