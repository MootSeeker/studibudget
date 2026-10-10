import { monthOf, monthRange, type MonthKey } from './period'
import type { Category, Transaction } from './types'

export interface MonthTotals {
  month: MonthKey
  einnahmen: number
  ausgaben: number
  sparen: number
  /** Einnahmen − Ausgaben − Sparen */
  saldo: number
}

function signed(t: Transaction): number {
  return t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents
}

export function totalsByMonth(
  txs: Transaction[],
  cats: Category[],
  from: MonthKey,
  to: MonthKey,
): MonthTotals[] {
  const type = new Map(cats.map((c) => [c.id, c.type]))
  const rows = new Map<MonthKey, MonthTotals>(
    monthRange(from, to).map((month) => [
      month,
      { month, einnahmen: 0, ausgaben: 0, sparen: 0, saldo: 0 },
    ]),
  )
  for (const t of txs) {
    const row = rows.get(monthOf(t.date))
    const ty = type.get(t.categoryId)
    if (t.deleted || !row || !ty) continue
    if (ty === 'einnahme') row.einnahmen += signed(t)
    else if (ty === 'ausgabe') row.ausgaben += signed(t)
    else row.sparen += signed(t)
  }
  for (const r of rows.values()) r.saldo = r.einnahmen - r.ausgaben - r.sparen
  return [...rows.values()]
}

/** Ausgaben im Zeitraum pro Kategorie (nur Eigenanteil). */
export function expensesByCategory(
  txs: Transaction[],
  cats: Category[],
  from: MonthKey,
  to: MonthKey,
): Map<string, number> {
  const isExpense = new Set(cats.filter((c) => c.type === 'ausgabe').map((c) => c.id))
  const out = new Map<string, number>()
  for (const t of txs) {
    const m = monthOf(t.date)
    if (t.deleted || m < from || m > to || !isExpense.has(t.categoryId)) continue
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + t.myAmountCents)
  }
  return out
}

export interface KeyFigures {
  avgExpensesPerMonth: number
  savingsRatePct: number | null
  fixSharePct: number | null
  mostExpensiveMonth: MonthKey | null
}

export function keyFigures(
  totals: MonthTotals[],
  txs: Transaction[],
  cats: Category[],
  /** Letzter Monat, der zählt (der laufende); spätere Monate fliessen nicht in den Durchschnitt. */
  today?: MonthKey,
): KeyFigures {
  const sum = (f: (t: MonthTotals) => number) => totals.reduce((a, t) => a + f(t), 0)
  const expenses = sum((t) => t.ausgaben)
  const income = sum((t) => t.einnahmen)
  const from = totals[0]?.month ?? ''
  const to = totals[totals.length - 1]?.month ?? ''
  const fixIds = new Set(cats.filter((c) => c.type === 'ausgabe' && c.fix).map((c) => c.id))
  let fix = 0
  for (const [id, cents] of expensesByCategory(txs, cats, from, to))
    if (fixIds.has(id)) fix += cents
  const worst = totals.reduce<MonthTotals | null>(
    (b, t) => (t.ausgaben > (b?.ausgaben ?? 0) ? t : b),
    null,
  )
  // Durchschnitt über die Monate, die schon begonnen haben (leere Monate davor zählen mit).
  const elapsed = today ? totals.filter((t) => t.month <= today) : totals
  const elapsedExpenses = elapsed.reduce((a, t) => a + t.ausgaben, 0)
  return {
    avgExpensesPerMonth: elapsed.length ? Math.round(elapsedExpenses / elapsed.length) : 0,
    savingsRatePct: income > 0 ? (sum((t) => t.sparen) / income) * 100 : null,
    fixSharePct: expenses > 0 ? (fix / expenses) * 100 : null,
    mostExpensiveMonth: worst?.month ?? null,
  }
}
