import { addMonths, monthOf, type MonthKey } from './period'
import type { Goal, Transaction } from './types'

/** Stand = Startbetrag + Einzahlungen − Entnahmen. */
export function goalBalance(goal: Goal, txs: Transaction[]): number {
  let sum = goal.startCents
  for (const t of txs) {
    if (t.deleted || t.goalId !== goal.id) continue
    sum += t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents
  }
  return sum
}

/** Nötige Monatsrate bis zum Zieldatum; null ohne Datum, 0 wenn erreicht oder Datum vorbei. */
export function neededPerMonth(goal: Goal, balance: number, today: MonthKey): number | null {
  if (!goal.targetDate) return null
  const left = goal.targetCents - balance
  if (left <= 0) return 0
  let months = 0
  for (let m = today; m <= monthOf(goal.targetDate); m = addMonths(m, 1)) months++
  return months === 0 ? 0 : Math.ceil(left / months)
}
