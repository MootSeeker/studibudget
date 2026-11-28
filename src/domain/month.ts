import { daysInMonth } from './period'
import type { MonthKey } from './period'

/** `neutral`: ohne Budget; `plan`: Fixkosten wie geplant. */
export type Ampel = 'gruen' | 'gelb' | 'rot' | 'neutral' | 'plan'

export interface AmpelResult {
  status: Ampel
  /** Ausschöpfung in Prozent; null, wenn kein Budget vorhanden ist. */
  pct: number | null
  noBudget: boolean
}

/**
 * Ampel für eine Ausgaben-Kategorie. `available` = Monatsbudget + Übertrag.
 * - Ohne Budget: `neutral` (#166), die Schwellen gelten nur mit Budget.
 * - `planned` (fixe Kategorie oder nur Vorlagen-Buchungen): ab der gelben Schwelle bis genau zum
 *   Budget `plan` («Wie geplant», #179); überschritten bleibt `rot`.
 */
export function ampel(
  actual: number,
  available: number,
  yellowPct: number,
  redPct: number,
  opts: { planned?: boolean } = {},
): AmpelResult {
  if (available <= 0) return { status: 'neutral', pct: null, noBudget: true }
  const pct = (actual / available) * 100
  if (opts.planned && pct >= yellowPct && actual <= available)
    return { status: 'plan', pct, noBudget: false }
  const status: Ampel = pct >= redPct ? 'rot' : pct >= yellowPct ? 'gelb' : 'gruen'
  return { status, pct, noBudget: false }
}

/**
 * Hochrechnung Monatsende (Ausgaben): gebuchte Fixkosten + offene Vorlagen
 * + variable Ausgaben hochgerechnet auf den ganzen Monat.
 */
export function forecastExpenses(p: {
  month: MonthKey
  dayOfMonth: number
  fixBooked: number
  fixOpen: number
  variableSoFar: number
}): number {
  const day = Math.max(1, Math.min(p.dayOfMonth, daysInMonth(p.month)))
  const variable = Math.round((p.variableSoFar / day) * daysInMonth(p.month))
  return p.fixBooked + p.fixOpen + variable
}

/** Durchschnitt der letzten n Monate, in denen es Werte ungleich 0 gab; null ohne Daten. */
export function averageOfMonths(values: number[], n = 3): number | null {
  const withData = values.filter((v) => v !== 0).slice(-n)
  if (withData.length === 0) return null
  return Math.round(withData.reduce((a, b) => a + b, 0) / withData.length)
}
