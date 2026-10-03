import { parseAmount } from './money'
import type { Settlement, Transaction } from './types'

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
 */
export function balances(txs: Transaction[], settlements: Settlement[]): Map<string, number> {
  const bal = new Map<string, number>()
  const add = (e: Effect) => bal.set(e.personId, (bal.get(e.personId) ?? 0) + e.cents)
  for (const t of txs) effectsOf(t).forEach(add)
  for (const s of settlements) if (!s.deleted) add(settlementEffect(s))
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
