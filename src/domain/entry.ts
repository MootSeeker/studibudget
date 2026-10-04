import { parseAmount } from './money'
import { buildSharedEqual, buildSharedPartner, myShare } from './split'
import type { CategoryType, SharedInfo, Transaction, Who } from './types'

export const MAX_AMOUNT_CENTS = 100_000_000_00
export const MAX_NOTE_LENGTH = 200

export interface EntryInput {
  id: string
  type: CategoryType
  categoryId: string
  amount: string
  date: string
  note: string
  /** Nur für Ausgaben bei WG oder Partner/in. */
  shared: null | {
    paidBy: Who
    mode: 'equal' | 'percent'
    /** Beteiligte (immer inkl. 'me', wenn ich mitzahle). */
    participants: Who[]
    /** Nur bei 'percent': die andere Person und mein Anteil in Prozent. */
    partnerId?: string
    myPct?: number
  }
  /** Nur für Sparen. */
  goal: null | { id: string; direction: 'einzahlung' | 'entnahme' }
  carId?: string | null
  /** Beim Bearbeiten: Herkunft aus einer Vorlage bleibt erhalten. */
  existing?: Pick<Transaction, 'templateId' | 'templateMonth'>
}

export type EntryDraft = Omit<Transaction, 'updatedAt'>
export type EntryResult = { ok: true; draft: EntryDraft } | { ok: false; error: string }

const fail = (error: string): EntryResult => ({ ok: false, error })

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Prüft die Eingaben des Formulars und baut daraus die Buchung. */
export function buildEntry(input: EntryInput): EntryResult {
  const cents = parseAmount(input.amount)
  if (cents === null) return fail('Bitte gib einen gültigen Betrag ein.')
  if (cents <= 0) return fail('Der Betrag muss grösser als 0 sein.')
  if (cents > MAX_AMOUNT_CENTS) return fail('Der Betrag ist zu gross.')
  if (!input.categoryId) return fail('Bitte wähle eine Kategorie.')
  if (!validDate(input.date)) return fail('Bitte gib ein gültiges Datum ein.')
  if (input.note.length > MAX_NOTE_LENGTH)
    return fail(`Die Notiz darf höchstens ${MAX_NOTE_LENGTH} Zeichen lang sein.`)
  if (input.goal && input.type !== 'sparen') return fail('Ein Sparziel gibt es nur bei Sparen.')
  if (input.shared && input.type !== 'ausgabe') return fail('Nur Ausgaben lassen sich teilen.')

  let shared: SharedInfo | undefined
  if (input.shared) {
    const s = input.shared
    if (s.participants.length === 0) return fail('Wähle mindestens eine beteiligte Person.')
    if (s.mode === 'percent') {
      const pct = s.myPct
      if (!s.partnerId || pct === undefined || !Number.isFinite(pct) || pct < 0 || pct > 100)
        return fail('Dein Anteil muss zwischen 0 und 100 Prozent liegen.')
      shared = buildSharedPartner(cents, s.paidBy, s.partnerId, pct)
    } else {
      shared = buildSharedEqual(cents, s.paidBy, s.participants)
    }
  }

  const draft: EntryDraft = {
    id: input.id,
    deleted: false,
    date: input.date,
    categoryId: input.categoryId,
    amountCents: cents,
    myAmountCents: myShare(cents, shared),
    note: input.note.trim(),
  }
  if (shared) draft.shared = shared
  if (input.carId) draft.carId = input.carId
  if (input.goal) {
    draft.goalId = input.goal.id
    draft.goalDirection = input.goal.direction
  }
  if (input.existing?.templateId) {
    draft.templateId = input.existing.templateId
    draft.templateMonth = input.existing.templateMonth
  }
  return { ok: true, draft }
}
