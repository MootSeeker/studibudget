import { budgetForMonth } from './budget'
import { monthRange, type MonthKey } from './period'
import {
  expensesByCategory,
  keyFigures,
  totalsByMonth,
  type KeyFigures,
  type MonthTotals,
} from './stats'
import type { Area, Budget, Category, Transaction } from './types'

export const MAX_STAT_MONTHS = 36

export interface StatsInput {
  from: MonthKey
  to: MonthKey
  categories: Category[]
  areas: Area[]
  budgets: Budget[]
  txs: Transaction[]
}

export interface ExpenseCategory {
  category: Category
  total: number
}

export interface ExpenseArea {
  area: Area
  total: number
  /** Anteil an allen Ausgaben im Zeitraum, 0–100 */
  sharePct: number
  categories: ExpenseCategory[]
}

export interface PlanRow {
  category: Category
  plan: number
  actual: number
  /** actual − plan */
  diff: number
}

export interface PlanArea {
  area: Area
  plan: number
  actual: number
  diff: number
  rows: PlanRow[]
}

export interface StatsView {
  months: MonthTotals[]
  totals: { einnahmen: number; ausgaben: number; sparen: number; saldo: number }
  key: KeyFigures
  expensesByArea: ExpenseArea[]
  planVsActual: PlanArea[]
}

/** Alle Auswertungen der Statistik-Seite für einen Zeitraum (von/bis inklusive). */
export function buildStats(input: StatsInput): StatsView {
  const { from, to, categories, areas, budgets } = input
  const txs = input.txs.filter((t) => !t.deleted)
  const months = totalsByMonth(txs, categories, from, to)
  const sum = (f: (m: MonthTotals) => number) => months.reduce((s, m) => s + f(m), 0)
  const totals = {
    einnahmen: sum((m) => m.einnahmen),
    ausgaben: sum((m) => m.ausgaben),
    sparen: sum((m) => m.sparen),
    saldo: sum((m) => m.saldo),
  }

  const sortedAreas = [...areas].sort((a, b) => a.order - b.order)

  // Ausgaben nach Bereich › Kategorie (nur Eigenanteil), grösste zuerst
  const spent = expensesByCategory(txs, categories, from, to)
  const expensesByArea: ExpenseArea[] = sortedAreas
    .map((area) => {
      const cats = categories
        .filter((c) => c.areaId === area.id && (spent.get(c.id) ?? 0) !== 0)
        .map((category) => ({ category, total: spent.get(category.id)! }))
        .sort((a, b) => b.total - a.total)
      const total = cats.reduce((s, c) => s + c.total, 0)
      return {
        area,
        total,
        sharePct: totals.ausgaben > 0 ? (total / totals.ausgaben) * 100 : 0,
        categories: cats,
      }
    })
    .filter((a) => a.categories.length > 0)
    .sort((a, b) => b.total - a.total)

  // Plan vs. Ist: Plan = Summe der Monatsbudgets im Zeitraum
  const periodMonths = monthRange(from, to)
  const actualBy = new Map<string, number>()
  for (const t of txs) {
    const m = t.date.slice(0, 7)
    if (m < from || m > to) continue
    actualBy.set(
      t.categoryId,
      (actualBy.get(t.categoryId) ?? 0) +
        (t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents),
    )
  }
  const planVsActual: PlanArea[] = sortedAreas
    .map((area) => {
      const rows = categories
        .filter((c) => c.areaId === area.id)
        .sort((a, b) => a.order - b.order)
        .map<PlanRow>((category) => {
          const plan = category.hidden
            ? 0
            : periodMonths.reduce((s, m) => s + budgetForMonth(budgets, category.id, m), 0)
          const actual = actualBy.get(category.id) ?? 0
          return { category, plan, actual, diff: actual - plan }
        })
        .filter((r) => r.plan !== 0 || r.actual !== 0)
      const plan = rows.reduce((s, r) => s + r.plan, 0)
      const actual = rows.reduce((s, r) => s + r.actual, 0)
      return { area, plan, actual, diff: actual - plan, rows }
    })
    .filter((a) => a.rows.length > 0)

  return { months, totals, key: keyFigures(months, txs, categories), expensesByArea, planVsActual }
}
