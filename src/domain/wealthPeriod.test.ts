import { describe, expect, it } from 'vitest'
import { addMonths, defaultSemesters, monthRange } from './period'
import type { AccountBalance } from './types'
import { firstBalanceMonth, WEALTH_PERIODS, wealthPeriod } from './wealthPeriod'

const CH = defaultSemesters('CH')
const DE = defaultSemesters('DE')
const range = (p: { from: string; to: string }) => [p.from, p.to]
const bal = (month: string, deleted = false): AccountBalance => ({
  id: month,
  updatedAt: '',
  deleted,
  accountId: 'a',
  month,
  amountCents: 100,
})

describe('wealthPeriod (Issue #112)', () => {
  it('AK-1: die Auswahl hat genau sechs Einträge in fester Reihenfolge', () => {
    expect(WEALTH_PERIODS.map((p) => p.label)).toEqual([
      'Semester',
      'Halbjahr',
      'Year to date',
      'Jahr',
      '5 Jahre',
      'Max. Aufnahme',
    ])
    expect(WEALTH_PERIODS.map((p) => p.value)).toEqual([
      'semester',
      'halbjahr',
      'ytd',
      'jahr',
      'fuenfjahre',
      'max',
    ])
  })

  it('AK-2: Semester ist das Semester um den aktuellen Monat, auch über den Jahreswechsel', () => {
    expect(wealthPeriod('semester', '2026-10', 0, CH, null)).toEqual({
      from: '2026-08',
      to: '2027-01',
      label: 'Herbstsemester 2026/27',
    })
    expect(wealthPeriod('semester', '2027-01', 0, CH, null)).toEqual({
      from: '2026-08',
      to: '2027-01',
      label: 'Herbstsemester 2026/27',
    })
    expect(wealthPeriod('semester', '2026-04', 0, CH, null)).toEqual({
      from: '2026-02',
      to: '2026-07',
      label: 'Frühjahrssemester 2026',
    })
    expect(wealthPeriod('semester', '2027-01', 0, DE, null)).toEqual({
      from: '2026-10',
      to: '2027-03',
      label: 'Wintersemester 2026/27',
    })
  })

  it('AK-2: Halbjahr und Jahr sind Kalenderhalbjahr und Kalenderjahr des aktuellen Monats', () => {
    expect(wealthPeriod('halbjahr', '2026-10', 0, CH, null)).toEqual({
      from: '2026-07',
      to: '2026-12',
      label: '2. Halbjahr 2026',
    })
    expect(wealthPeriod('halbjahr', '2026-03', 0, CH, null)).toEqual({
      from: '2026-01',
      to: '2026-06',
      label: '1. Halbjahr 2026',
    })
    expect(wealthPeriod('jahr', '2026-10', 0, CH, null)).toEqual({
      from: '2026-01',
      to: '2026-12',
      label: '2026',
    })
  })

  it('AK-2: Year to date läuft vom Januar bis zum aktuellen Monat', () => {
    expect(wealthPeriod('ytd', '2026-10', 0, CH, null)).toEqual({
      from: '2026-01',
      to: '2026-10',
      label: 'Year to date',
    })
  })

  it('AK-2: 5 Jahre umfasst 60 Monate bis zum aktuellen Monat', () => {
    const p = wealthPeriod('fuenfjahre', '2026-10', 0, CH, null)
    expect(p).toEqual({ from: '2021-11', to: '2026-10', label: '5 Jahre' })
    expect(monthRange(p.from, p.to)).toHaveLength(60)
  })

  it('AK-2: Max. Aufnahme beginnt beim ersten erfassten Stand', () => {
    expect(wealthPeriod('max', '2026-10', 0, CH, '2024-03')).toEqual({
      from: '2024-03',
      to: '2026-10',
      label: 'Max. Aufnahme',
    })
    expect(range(wealthPeriod('max', '2026-10', 0, CH, null))).toEqual(['2026-10', '2026-10'])
    expect(range(wealthPeriod('max', '2026-10', 0, CH, '2027-02'))).toEqual(['2026-10', '2026-10'])
  })

  it('AK-2: firstBalanceMonth liefert den frühesten nicht gelöschten Stand', () => {
    expect(firstBalanceMonth([])).toBeNull()
    expect(firstBalanceMonth([bal('2025-05'), bal('2024-03'), bal('2026-01')])).toBe('2024-03')
    expect(firstBalanceMonth([bal('2025-05'), bal('2023-01', true)])).toBe('2025-05')
    expect(firstBalanceMonth([bal('2023-01', true)])).toBeNull()
  })

  it('AK-3: jeder Schritt verschiebt um die Länge des Zeitraums, lückenlos und ohne Überschneidung', () => {
    for (const now of ['2026-10', '2027-01']) {
      for (const { value } of WEALTH_PERIODS) {
        for (let step = -3; step < 3; step++) {
          const a = wealthPeriod(value, now, step, CH, '2024-03')
          const b = wealthPeriod(value, now, step + 1, CH, '2024-03')
          const where = `${value} ${now} Schritt ${step}`
          expect(b.from, where).toBe(addMonths(a.to, 1))
          expect(monthRange(b.from, b.to).length, where).toBe(monthRange(a.from, a.to).length)
        }
      }
    }
  })

  it('AK-3: Year to date, 5 Jahre und Max. Aufnahme springen um ihre Länge', () => {
    expect(range(wealthPeriod('ytd', '2026-10', -1, CH, null))).toEqual(['2025-03', '2025-12'])
    expect(range(wealthPeriod('ytd', '2026-10', 1, CH, null))).toEqual(['2026-11', '2027-08'])
    expect(range(wealthPeriod('fuenfjahre', '2026-10', -1, CH, null))).toEqual([
      '2016-11',
      '2021-10',
    ])
    expect(range(wealthPeriod('max', '2026-10', -1, CH, '2024-03'))).toEqual(['2021-07', '2024-02'])
  })

  it('AK-4: Semester über den Jahreswechsel, vor und zurück', () => {
    expect(wealthPeriod('semester', '2026-10', -1, CH, null)).toEqual({
      from: '2026-02',
      to: '2026-07',
      label: 'Frühjahrssemester 2026',
    })
    expect(wealthPeriod('semester', '2026-10', -2, CH, null)).toEqual({
      from: '2025-08',
      to: '2026-01',
      label: 'Herbstsemester 2025/26',
    })
    expect(wealthPeriod('semester', '2026-10', 1, CH, null)).toEqual({
      from: '2027-02',
      to: '2027-07',
      label: 'Frühjahrssemester 2027',
    })
    expect(wealthPeriod('semester', '2026-10', 2, CH, null)).toEqual({
      from: '2027-08',
      to: '2028-01',
      label: 'Herbstsemester 2027/28',
    })
    expect(wealthPeriod('semester', '2027-01', 1, DE, null)).toEqual({
      from: '2027-04',
      to: '2027-09',
      label: 'Sommersemester 2027',
    })
  })

  it('AK-4: ohne passendes Semester steht jeder Monat für sich', () => {
    expect(wealthPeriod('semester', '2026-10', 0, [], null)).toEqual({
      from: '2026-10',
      to: '2026-10',
      label: '2026-10',
    })
    expect(range(wealthPeriod('semester', '2026-10', -1, [], null))).toEqual(['2026-09', '2026-09'])
  })

  it('AK-4: Monate je Eintrag im Januar (Jahreswechsel)', () => {
    const now = '2027-01'
    const first = '2026-11'
    expect(range(wealthPeriod('semester', now, 0, CH, first))).toEqual(['2026-08', '2027-01'])
    expect(range(wealthPeriod('halbjahr', now, 0, CH, first))).toEqual(['2027-01', '2027-06'])
    expect(range(wealthPeriod('halbjahr', now, -1, CH, first))).toEqual(['2026-07', '2026-12'])
    expect(range(wealthPeriod('ytd', now, 0, CH, first))).toEqual(['2027-01', '2027-01'])
    expect(range(wealthPeriod('ytd', now, -1, CH, first))).toEqual(['2026-12', '2026-12'])
    expect(range(wealthPeriod('jahr', now, 0, CH, first))).toEqual(['2027-01', '2027-12'])
    expect(range(wealthPeriod('jahr', now, -1, CH, first))).toEqual(['2026-01', '2026-12'])
    expect(range(wealthPeriod('fuenfjahre', now, 0, CH, first))).toEqual(['2022-02', '2027-01'])
    expect(range(wealthPeriod('max', now, 0, CH, first))).toEqual(['2026-11', '2027-01'])
  })
})
