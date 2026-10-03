import type { MonthKey } from './period'
import type { Account, AccountBalance, AccountKind } from './types'

/**
 * Schulden (z. B. Kreditkarte) trägt man als geschuldeten Betrag ein; gespeichert wird er negativ,
 * damit er das Gesamtvermögen automatisch senkt. Bei allen anderen Konten gilt die Eingabe, wie sie ist
 * (ein überzogenes Konto darf negativ sein).
 */
export function storedBalance(kind: AccountKind, enteredCents: number): number {
  return kind === 'schuld' ? -Math.abs(enteredCents) : enteredCents
}

/** Umkehrung für die Anzeige im Eingabefeld: Schulden erscheinen als positiver Betrag. */
export function enteredBalance(kind: AccountKind, storedCents: number): number {
  return kind === 'schuld' ? -storedCents : storedCents
}

export interface WealthPoint {
  month: MonthKey
  /** Summe der erfassten Stände einbezogener Konten; null, wenn gar nichts erfasst ist. */
  total: number | null
  /** Einbezogene Konten ohne Angabe in diesem Monat (leer heisst «unbekannt», nicht 0). */
  missing: number
  /** Alle einbezogenen Konten haben einen Stand: nur dann ist die Summe aussagekräftig. */
  complete: boolean
}

/** Gesamtvermögen pro Monat aus den erfassten Monatsendständen. */
export function wealthByMonth(
  accounts: Account[],
  balances: AccountBalance[],
  months: MonthKey[],
): WealthPoint[] {
  const included = accounts.filter((a) => !a.deleted && a.include)
  const live = balances.filter((b) => !b.deleted)
  return months.map((month) => {
    let total = 0
    let have = 0
    for (const a of included) {
      const b = live.find((x) => x.accountId === a.id && x.month === month)
      if (b) {
        total += b.amountCents
        have++
      }
    }
    return {
      month,
      total: have === 0 ? null : total,
      missing: included.length - have,
      complete: included.length > 0 && have === included.length,
    }
  })
}
