import { daysInMonth } from './period'
import type { MonthKey } from './period'

export type Ampel = 'gruen' | 'gelb' | 'rot'

export interface AmpelResult {
  status: Ampel
  /** Ausschöpfung in Prozent; null, wenn kein Budget vorhanden ist. */
  pct: number | null
  noBudget: boolean
}

/** Ampel für eine Ausgaben-Kategorie. `available` = Monatsbudget + Übertrag. */
export function ampel(
  actual: number,
  available: number,
  yellowPct: number,
  redPct: number,
): AmpelResult {
  if (available <= 0) {
    return actual > 0
      ? { status: 'rot', pct: null, noBudget: true }
      : { status: 'gruen', pct: null, noBudget: true }
  }
  const pct = (actual / available) * 100
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
