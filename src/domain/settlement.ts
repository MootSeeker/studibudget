import { parseAmount } from './money'
import type { Category, Settlement, Transaction } from './types'

export interface Effect {
  personId: string
  /** Positiv: die Person schuldet mir mehr. Negativ: ich schulde ihr mehr. */
  cents: number
}

/** Wie eine gemeinsame Buchung die Salden verschiebt (leer, wenn sie nicht geteilt oder gelöscht ist). */
export function effectsOf(t: Transaction): Effect[] {
  if (t.deleted || !t.shared) return []
  if (t.shared.paidBy === 'me') {
    return t.shared.parts
      .filter((p) => p.who !== 'me' && p.cents !== 0)
      .map((p) => ({ personId: p.who, cents: p.cents }))
  }
  const mine = t.shared.parts.find((p) => p.who === 'me')?.cents ?? 0
  return mine === 0 ? [] : [{ personId: t.shared.paidBy, cents: -mine }]
}

/** Wirkung einer Ausgleichszahlung: «Ich zahle» verringert meine Schuld bzw. erhöht die Forderung. */
export function settlementEffect(s: Settlement): Effect {
  return {
    personId: s.personId,
    cents: s.direction === 'ich_zahle' ? s.amountCents : -s.amountCents,
  }
}

/**
 * Saldo pro Person aus meiner Sicht, in Cent.
 * Positiv: die Person schuldet mir. Negativ: ich schulde der Person.
 * Mit `upToMonth` (`YYYY-MM`) zählt nur, was bis Ende dieses Monats gebucht wurde.
 */
export function balances(
  txs: Transaction[],
  settlements: Settlement[],
  upToMonth?: string,
): Map<string, number> {
  const upTo = <T extends { date: string }>(x: T) => !upToMonth || x.date.slice(0, 7) <= upToMonth
  const bal = new Map<string, number>()
  const add = (e: Effect) => bal.set(e.personId, (bal.get(e.personId) ?? 0) + e.cents)
  for (const t of txs.filter(upTo)) effectsOf(t).forEach(add)
  for (const s of settlements.filter(upTo)) if (!s.deleted) add(settlementEffect(s))
  return bal
}

export interface SettlementInput {
  id: string
  personId: string
  direction: Settlement['direction']
  amount: string
  date: string
  note: string
}

export type SettlementResult =
  { ok: true; draft: Omit<Settlement, 'updatedAt'> } | { ok: false; error: string }

const fail = (error: string): SettlementResult => ({ ok: false, error })

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Prüft die Eingaben für eine Ausgleichszahlung. */
export function buildSettlement(input: SettlementInput): SettlementResult {
  if (!input.personId) return fail('Bitte wähle eine Person.')
  const cents = parseAmount(input.amount)
  if (cents === null) return fail('Bitte gib einen gültigen Betrag ein.')
  if (cents <= 0) return fail('Der Betrag muss grösser als 0 sein.')
  if (cents > 100_000_000_00) return fail('Der Betrag ist zu gross.')
  if (!validDate(input.date)) return fail('Bitte gib ein gültiges Datum ein.')
  if (input.note.length > 200) return fail('Die Notiz darf höchstens 200 Zeichen lang sein.')
  return {
    ok: true,
    draft: {
      id: input.id,
      deleted: false,
      date: input.date,
      personId: input.personId,
      direction: input.direction,
      amountCents: cents,
      note: input.note.trim(),
    },
  }
}

/** Welche Zahlung gleicht den Saldo aus? Schuldet die Person mir etwas, erhalte ich Geld, sonst zahle ich. */
export function suggestSettlement(
  balance: number,
): { direction: Settlement['direction']; cents: number } | null {
  if (balance === 0) return null
  return { direction: balance > 0 ? 'ich_erhalte' : 'ich_zahle', cents: Math.abs(balance) }
}

export interface MonthSettlement {
  /** Im Monat von Partner/in oder Mitbewohner/innen erhalten (Zahlungen «ich erhalte»). */
  received: number
  /** Im Monat an andere bezahlt (Zahlungen «ich zahle»). */
  paid: number
  /** Aus den gemeinsamen Buchungen des Monats: positiv = andere schulden mir, negativ = ich schulde. */
  sharedNet: number
  /** Bar bezahlte Ausgaben: nicht geteilt voll, geteilt nur wenn ich bezahlt habe (dann der ganze Betrag). */
  outOfPocket: number
  income: number
  /** Echtes Defizit: bar bezahlt + gezahlt − Einnahmen − erhalten. Negativ = Überschuss. */
  deficit: number
}

/**
 * Kassensicht eines Monats: Was ist tatsächlich aus der Tasche gegangen und reingekommen?
 * Anders als der Eigenanteil (Budget) zählt hier der ganze Betrag, den ich bezahlt habe, und Ausgleichszahlungen
 * wirken im Monat, in dem sie fliessen. Sparen bleibt aussen vor.
 */
export function monthSettlement(
  txs: Transaction[],
  settlements: Settlement[],
  categories: Pick<Category, 'id' | 'type'>[],
  month: string,
): MonthSettlement {
  const type = new Map(categories.map((c) => [c.id, c.type]))
  let outOfPocket = 0
  let income = 0
  let sharedNet = 0
  for (const t of txs) {
    if (t.deleted || !t.date.startsWith(month)) continue
    const kind = type.get(t.categoryId)
    if (kind === 'ausgabe') {
      outOfPocket += t.shared ? (t.shared.paidBy === 'me' ? t.amountCents : 0) : t.amountCents
    } else if (kind === 'einnahme') {
      income += t.amountCents
    }
    sharedNet += effectsOf(t).reduce((s, e) => s + e.cents, 0)
  }
  let received = 0
  let paid = 0
  for (const s of settlements) {
    if (s.deleted || !s.date.startsWith(month)) continue
    if (s.direction === 'ich_erhalte') received += s.amountCents
    else paid += s.amountCents
  }
  return {
    received,
    paid,
    sharedNet,
    outOfPocket,
    income,
    deficit: outOfPocket + paid - income - received,
  }
}

export interface PersonMonthSettlement {
  month: string
  personId: string
  /** Von der Person erhalten (Zahlungen «ich erhalte»). */
  received: number
  /** An die Person bezahlt (Zahlungen «ich zahle»). */
  paid: number
}

/** Ausgleichszahlungen pro Monat und Person. Nur Monate der Liste, nur Personen mit Zahlungen im Zeitraum. */
export function settlementsByMonth(
  settlements: Settlement[],
  months: string[],
): { persons: string[]; rows: PersonMonthSettlement[] } {
  const inRange = new Set(months)
  const sums = new Map<string, PersonMonthSettlement>()
  const persons: string[] = []
  for (const s of settlements) {
    const month = s.date.slice(0, 7)
    if (s.deleted || !inRange.has(month)) continue
    if (!persons.includes(s.personId)) persons.push(s.personId)
    const key = `${month}|${s.personId}`
    const row = sums.get(key) ?? { month, personId: s.personId, received: 0, paid: 0 }
    if (s.direction === 'ich_erhalte') row.received += s.amountCents
    else row.paid += s.amountCents
    sums.set(key, row)
  }
  const rows = months.flatMap((m) =>
    persons.map((p) => sums.get(`${m}|${p}`) ?? { month: m, personId: p, received: 0, paid: 0 }),
  )
  return { persons, rows }
}
