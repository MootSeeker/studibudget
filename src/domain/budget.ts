import { addMonths, monthOf, monthRange, type MonthKey } from './period'
import type { Budget, Category, Transaction } from './types'

/** Massgebendes Monatsbudget: neuester Eintrag mit validFrom <= Monat, sonst 0. */
export function budgetForMonth(budgets: Budget[], categoryId: string, month: MonthKey): number {
  let best: Budget | undefined
  for (const b of budgets) {
    if (b.deleted || b.categoryId !== categoryId || b.validFrom > month) continue
    if (
      !best ||
      b.validFrom > best.validFrom ||
      (b.validFrom === best.validFrom && b.updatedAt > best.updatedAt)
    )
      best = b
  }
  return best?.amountCents ?? 0
}

/** Ist-Betrag einer Kategorie im Monat (Eigenanteil; Entnahmen aus Sparzielen zählen negativ). */
export function actualForMonth(txs: Transaction[], categoryId: string, month: MonthKey): number {
  let sum = 0
  for (const t of txs) {
    if (t.deleted || t.categoryId !== categoryId || monthOf(t.date) !== month) continue
    sum += t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents
  }
  return sum
}

/** Übertrag: Summe (Budget − Ist) von rolloverFrom bis zum Vormonat; 0 ohne Übertrag. */
export function rolloverCents(
  cat: Pick<Category, 'id' | 'rolloverFrom'>,
  month: MonthKey,
  budgets: Budget[],
  txs: Transaction[],
): number {
  if (!cat.rolloverFrom || cat.rolloverFrom >= month) return 0
  return monthRange(cat.rolloverFrom, addMonths(month, -1)).reduce(
    (acc, m) => acc + budgetForMonth(budgets, cat.id, m) - actualForMonth(txs, cat.id, m),
    0,
  )
}
