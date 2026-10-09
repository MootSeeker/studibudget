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

export interface AccountSeries {
  accountId: string
  name: string
  /** Zählt das Konto zum Gesamtvermögen (`Account.include`)? */
  include: boolean
  /** Stand am Monatsende je Monat in der Reihenfolge von `months`; null heisst «keine Angabe» (Lücke, nicht 0). */
  values: (number | null)[]
}

/**
 * Verlauf pro Konto für den Vermögenschart: ein Eintrag je nicht gelöschtem Konto mit mindestens einem Stand in
 * `months`, in der Reihenfolge von `accounts`. Nicht gezählte Konten sind dabei und über `include` erkennbar.
 */
export function accountSeries(
  accounts: Account[],
  balances: AccountBalance[],
  months: MonthKey[],
): AccountSeries[] {
  const live = balances.filter((b) => !b.deleted)
  return accounts
    .filter((a) => !a.deleted)
    .map((a) => ({
      accountId: a.id,
      name: a.name,
      include: a.include,
      values: months.map(
        (month) => live.find((b) => b.accountId === a.id && b.month === month)?.amountCents ?? null,
      ),
    }))
    .filter((s) => s.values.some((v) => v !== null))
}
