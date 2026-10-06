import { isValidSwissIban, normalizeIban } from './iban'
import type { BankDetails } from './types'

/** Eingabe aus dem Formular: reiner Text, nichts ist geprüft. */
export interface BankInput {
  holder: string
  street: string
  zip: string
  town: string
  country: 'CH' | 'LI'
  iban: string
}

export type BankResult = { ok: true; bank: BankDetails | undefined } | { ok: false; error: string }

/** Längengrenzen nach den Schweizer Zahlungsstandards (QR-Rechnung), damit der QR-Code später nie zu lange Felder trägt. */
const LIMITS = { holder: 70, street: 70, zip: 16, town: 35 } as const
const LABELS = { holder: 'Name', street: 'Strasse', zip: 'PLZ', town: 'Ort' } as const

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * Prüft die Eingabe und liefert die Bankverbindung zum Speichern.
 * Sind alle Textfelder leer, gibt es keine Bankverbindung (`undefined`: die Angabe wird entfernt).
 */
export function buildBank(input: BankInput): BankResult {
  const bank: BankDetails = {
    holder: clean(input.holder),
    street: clean(input.street),
    zip: clean(input.zip),
    town: clean(input.town),
    country: input.country,
    iban: normalizeIban(input.iban),
  }
  if (!bank.holder && !bank.street && !bank.zip && !bank.town && !bank.iban)
    return { ok: true, bank: undefined }

  for (const key of ['holder', 'street', 'zip', 'town'] as const) {
    if (bank[key].length > LIMITS[key])
      return { ok: false, error: `${LABELS[key]}: höchstens ${LIMITS[key]} Zeichen.` }
  }
  if (bank.iban && !isValidSwissIban(bank.iban))
    return {
      ok: false,
      error:
        'Die IBAN ist ungültig. Es gelten nur Schweizer und Liechtensteiner IBAN mit 21 Zeichen.',
    }
  return { ok: true, bank }
}
