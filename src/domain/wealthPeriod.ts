import {
  addMonths,
  monthRange,
  resolvePeriod,
  semesterOf,
  type MonthKey,
  type Period,
} from './period'
import type { AccountBalance, Semester } from './types'

export type WealthPeriodKind = 'semester' | 'halbjahr' | 'ytd' | 'jahr' | 'fuenfjahre' | 'max'

/** Einträge der Auswahl «Zeitraum» auf «Konten & Sparziele», in dieser Reihenfolge (Issue #112). */
export const WEALTH_PERIODS: { value: WealthPeriodKind; label: string }[] = [
  { value: 'semester', label: 'Semester' },
  { value: 'halbjahr', label: 'Halbjahr' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'jahr', label: 'Jahr' },
  { value: 'fuenfjahre', label: '5 Jahre' },
  { value: 'max', label: 'Max. Aufnahme' },
]

/** Frühester Monat mit einem nicht gelöschten Kontostand; null ohne Stand. */
export function firstBalanceMonth(balances: AccountBalance[]): MonthKey | null {
  let first: MonthKey | null = null
  for (const b of balances) {
    if (!b.deleted && (first === null || b.month < first)) first = b.month
  }
  return first
}

/** Fester Block (Semester, Kalenderhalbjahr, Kalenderjahr), der den Monat enthält. */
function blockOf(
  kind: 'semester' | 'halbjahr' | 'jahr',
  m: MonthKey,
  semesters: Semester[],
): Period {
  if (kind === 'semester') return semesterOf(m, semesters) ?? { from: m, to: m, label: m }
  return resolvePeriod(kind, m, semesters)
}

/**
 * Monate der Auswahl `kind` für «Konten & Sparziele». `step` 0 ist der Zeitraum um den aktuellen Monat `now`;
 * jeder Schritt verschiebt um die Länge des Zeitraums, lückenlos und ohne Überschneidung (Issue #112).
 * Semester, Halbjahr und Jahr springen zum angrenzenden Block; Year to date, 5 Jahre und Max. Aufnahme um ihre
 * Anzahl Monate. `firstMonth` ist der früheste erfasste Stand (für Max. Aufnahme).
 */
export function wealthPeriod(
  kind: WealthPeriodKind,
  now: MonthKey,
  step: number,
  semesters: Semester[],
  firstMonth: MonthKey | null,
): Period {
  if (kind === 'semester' || kind === 'halbjahr' || kind === 'jahr') {
    let p = blockOf(kind, now, semesters)
    for (let i = 0; i < step; i++) p = blockOf(kind, addMonths(p.to, 1), semesters)
    for (let i = 0; i > step; i--) p = blockOf(kind, addMonths(p.from, -1), semesters)
    return p
  }
  const base: Period =
    kind === 'ytd'
      ? { from: `${now.slice(0, 4)}-01`, to: now, label: 'Year to date' }
      : kind === 'fuenfjahre'
        ? { from: addMonths(now, -59), to: now, label: '5 Jahre' }
        : {
            from: firstMonth !== null && firstMonth < now ? firstMonth : now,
            to: now,
            label: 'Max. Aufnahme',
          }
  const shift = step * monthRange(base.from, base.to).length
  return { from: addMonths(base.from, shift), to: addMonths(base.to, shift), label: base.label }
}
