import { addMonths, monthOf, type MonthKey } from './period'
import type { Goal, Transaction } from './types'

const signed = (t: Transaction) =>
  t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents

/**
 * Stand = Startbetrag + Einzahlungen − Entnahmen. Mit `upTo` (YYYY-MM-DD) zählen nur Buchungen bis und mit diesem
 * Tag (#178): spätere sind geplant, siehe `goalPlanned`.
 */
export function goalBalance(goal: Goal, txs: Transaction[], upTo?: string): number {
  let sum = goal.startCents
  for (const t of txs) {
    if (t.deleted || t.goalId !== goal.id || (upTo !== undefined && t.date > upTo)) continue
    sum += signed(t)
  }
  return sum
}

/** Geplante Einzahlungen (− Entnahmen) mit Datum nach `after` (YYYY-MM-DD). */
export function goalPlanned(goal: Goal, txs: Transaction[], after: string): number {
  let sum = 0
  for (const t of txs) if (!t.deleted && t.goalId === goal.id && t.date > after) sum += signed(t)
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
