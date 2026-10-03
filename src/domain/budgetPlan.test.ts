import { describe, expect, it } from 'vitest'
import { budgetDraftFor, moveWithin, summarizeBudget } from './budgetPlan'
import type { Budget, Category } from './types'

const cat = (id: string, type: Category['type'], over: Partial<Category> = {}): Category => ({
  id,
  areaId: 'a',
  name: id,
  type,
  fix: false,
  rolloverFrom: null,
  hidden: false,
  order: 0,
  deleted: false,
  updatedAt: '',
  ...over,
})
const bud = (id: string, categoryId: string, validFrom: string, amountCents: number): Budget => ({
  id,
  categoryId,
  validFrom,
  amountCents,
  deleted: false,
  updatedAt: id,
})

describe('summarizeBudget', () => {
  const cats = [
    cat('lohn', 'einnahme'),
    cat('miete', 'ausgabe'),
    cat('essen', 'ausgabe'),
    cat('etf', 'sparen'),
    cat('alt', 'ausgabe', { hidden: true }),
  ]
  const budgets = [
    bud('1', 'lohn', '2026-01', 200000),
    bud('2', 'miete', '2026-01', 80000),
    bud('3', 'miete', '2026-10', 90000),
    bud('4', 'essen', '2026-01', 40000),
    bud('5', 'etf', '2026-01', 10000),
    bud('6', 'alt', '2026-01', 99999),
  ]
  it('summiert pro Art mit dem im Monat gültigen Budget, ohne ausgeblendete', () => {
    expect(summarizeBudget(cats, budgets, '2026-09')).toEqual({
      einnahmen: 200000,
      ausgaben: 120000,
      sparen: 10000,
      saldo: 70000,
    })
    expect(summarizeBudget(cats, budgets, '2026-10')).toMatchObject({
      ausgaben: 130000,
      saldo: 60000,
    })
  })
  it('vor dem ersten Eintrag ist alles 0', () => {
    expect(summarizeBudget(cats, budgets, '2025-12')).toEqual({
      einnahmen: 0,
      ausgaben: 0,
      sparen: 0,
      saldo: 0,
    })
  })
})

describe('budgetDraftFor', () => {
  const budgets = [bud('b1', 'miete', '2026-10', 80000)]
  const ids = () => 'neu'
  it('überschreibt den Eintrag desselben Monats', () => {
    expect(budgetDraftFor(budgets, 'miete', '2026-10', 90000, ids)).toMatchObject({
      id: 'b1',
      amountCents: 90000,
    })
  })
  it('legt für einen anderen Monat einen neuen Eintrag an', () => {
    expect(budgetDraftFor(budgets, 'miete', '2026-11', 90000, ids)).toMatchObject({
      id: 'neu',
      validFrom: '2026-11',
    })
    expect(budgetDraftFor(budgets, 'essen', '2026-10', 100, ids).id).toBe('neu')
  })
})

describe('moveWithin', () => {
  const items = [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
  ]
  it('tauscht mit dem Nachbarn und liefert nur die zwei geänderten', () => {
    const r = moveWithin(items, 'b', -1)
    expect(r).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ])
  })
  it('am Rand passiert nichts', () => {
    expect(moveWithin(items, 'a', -1)).toEqual([])
    expect(moveWithin(items, 'c', 1)).toEqual([])
    expect(moveWithin(items, 'x', 1)).toEqual([])
  })
})
