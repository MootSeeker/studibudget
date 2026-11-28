import { describe, expect, it } from 'vitest'
import {
  detectInterval,
  groupTemplates,
  monthsForInterval,
  nextDueMonth,
  openTemplates,
  reservePlan,
  withSkipped,
} from './templates'
import type { Area, Category, Template } from './types'

const cat = (id: string, type: Category['type'] = 'ausgabe'): Category => ({
  id,
  updatedAt: '',
  deleted: false,
  areaId: 'a',
  name: id,
  type,
  fix: true,
  rolloverFrom: null,
  hidden: false,
  order: 0,
})
const tpl = (id: string, categoryId: string, cents: number, months: number[]): Template => ({
  id,
  updatedAt: '',
  deleted: false,
  categoryId,
  amountCents: cents,
  note: '',
  months,
  active: true,
})

describe('monthsForInterval / detectInterval', () => {
  it('alle 3 Monate ab Februar', () => {
    expect(monthsForInterval(3, 2)).toEqual([2, 5, 8, 11])
  })
  it('jährlich und monatlich', () => {
    expect(monthsForInterval(12, 8)).toEqual([8])
    expect(monthsForInterval(1, 1)).toHaveLength(12)
  })
  it('erkennt Intervalle und eigene Auswahl', () => {
    expect(detectInterval([1, 4, 7, 10])).toEqual({ every: 3, startMonth: 1 })
    expect(detectInterval([2, 8])).toEqual({ every: 6, startMonth: 2 })
    expect(detectInterval([3])).toEqual({ every: 12, startMonth: 3 })
    expect(detectInterval([1, 2, 5])).toBeNull()
  })
})

describe('reservePlan', () => {
  const cats = [cat('vers'), cat('sem'), cat('miete'), cat('lohn', 'einnahme')]
  it('Jahresbeitrag 600 + halbjährlich 750 = 175 pro Monat', () => {
    const plan = reservePlan(
      [
        tpl('t1', 'vers', 60000, [10]),
        tpl('t2', 'sem', 75000, [2, 8]),
        tpl('t3', 'miete', 90000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        tpl('t4', 'lohn', 100000, [3]),
      ],
      cats,
      '2026-10',
    )
    expect(plan.totalCents).toBe(17500)
    expect(plan.items.map((i) => [i.templateId, i.perMonthCents, i.nextMonth])).toEqual([
      ['t1', 5000, 10],
      ['t2', 12500, 2],
    ])
  })
  it('ohne Rückstellung, pausiert oder gelöscht zählt nicht', () => {
    const base = tpl('t1', 'vers', 60000, [10])
    expect(reservePlan([{ ...base, noReserve: true }], cats, '2026-10').items).toHaveLength(0)
    expect(reservePlan([{ ...base, active: false }], cats, '2026-10').items).toHaveLength(0)
    expect(reservePlan([{ ...base, deleted: true }], cats, '2026-10').items).toHaveLength(0)
  })
  it('geteilt zählt der Eigenanteil', () => {
    const t = {
      ...tpl('t1', 'vers', 60000, [10]),
      shared: {
        paidBy: 'me',
        parts: [
          { who: 'me', cents: 30000 },
          { who: 'p', cents: 30000 },
        ],
      },
    }
    expect(reservePlan([t], cats, '2026-10').totalCents).toBe(2500)
  })
})

describe('übersprungene Monate', () => {
  const t = { ...tpl('t1', 'miete', 80000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) }
  it('openTemplates lässt übersprungene Monate aus, andere bleiben offen', () => {
    const skipped = { ...t, skipMonths: ['2026-11'] }
    expect(openTemplates([skipped], [], '2026-11')).toHaveLength(0)
    expect(openTemplates([skipped], [], '2026-12')).toHaveLength(1)
  })
  it('withSkipped sortiert und vermeidet Doppelte', () => {
    expect(withSkipped(['2026-12'], ['2026-11', '2026-12'])).toEqual(['2026-11', '2026-12'])
    expect(withSkipped(undefined, ['2027-01'])).toEqual(['2027-01'])
  })
})

describe('Liste der Vorlagen (#181)', () => {
  const area = (id: string, order: number): Area => ({
    id,
    updatedAt: '',
    deleted: false,
    name: id,
    order,
    hidden: false,
  })
  const c = (id: string, areaId: string, order: number, type: Category['type'] = 'ausgabe') => ({
    ...cat(id, type),
    areaId,
    order,
  })
  const areas = [area('wohnen', 1), area('einnahmen', 0), area('mobil', 2)]
  const cats = [
    c('strom', 'wohnen', 1),
    c('miete', 'wohnen', 0),
    c('parkplatz', 'mobil', 0),
    c('lohn', 'einnahmen', 0, 'einnahme'),
    c('etf', 'mobil', 5, 'sparen'),
  ]
  it('AK-1: nach Bereich und Kategorie sortiert, Einnahmen und Sparen getrennt', () => {
    const ts = ['parkplatz', 'etf', 'strom', 'lohn', 'miete'].map((id) => tpl(id, id, 100, [1]))
    const groups = groupTemplates(ts, cats, areas)
    expect(groups.map((g) => [g.type, g.templates.map((t) => t.id)])).toEqual([
      ['ausgabe', ['miete', 'strom', 'parkplatz']],
      ['einnahme', ['lohn']],
      ['sparen', ['etf']],
    ])
  })
  it('leere Gruppen entfallen, unbekannte Kategorien kommen ans Ende der Ausgaben', () => {
    const groups = groupTemplates([tpl('x', 'weg', 1, [1]), tpl('m', 'miete', 1, [1])], cats, areas)
    expect(groups.map((g) => [g.type, g.templates.map((t) => t.id)])).toEqual([
      ['ausgabe', ['m', 'x']],
    ])
  })
  it('AK-3: nächster Fälligkeitsmonat ab dem aktuellen Monat, übersprungene Monate zählen nicht', () => {
    const t = tpl('s', 'strom', 100, [3, 6, 9, 12])
    expect(nextDueMonth(t, '2026-11')).toBe('2026-12')
    expect(nextDueMonth(t, '2026-12')).toBe('2026-12')
    expect(nextDueMonth({ ...t, skipMonths: ['2026-12'] }, '2026-12')).toBe('2027-03')
    expect(nextDueMonth({ ...t, active: false }, '2026-11')).toBeNull()
    expect(nextDueMonth({ ...t, months: [] }, '2026-11')).toBeNull()
  })
})
