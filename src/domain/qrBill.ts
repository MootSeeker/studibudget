import { isValidSwissIban } from './iban'
import type { BankDetails, Country } from './types'

/** Inhalt des Swiss QR Codes der QR-Rechnung (Issue #106): Datenstruktur SPC 0200, Adresstyp S, ohne Referenz. */

/** Längengrenzen des Standards für Name, Strasse, Hausnummer, PLZ und Ort. */
const MAX = { name: 70, street: 70, house: 16, zip: 16, town: 35 } as const

const REPLACEMENTS: Record<string, string> = {
  '„': '"',
  '“': '"',
  '”': '"',
  '«': '"',
  '»': '"',
  '‚': "'",
  '‘': "'",
  '’': "'",
  '–': '-',
  '—': '-',
  '−': '-',
  '€': 'EUR',
}

/** Der Standard erlaubt Latin-Zeichen (hier: Basis-Latein, Latin-1 und Latin Extended-A); alles andere wird zu «.». */
const allowed = (ch: string) => /^[\x20-\x7E -ſ]$/u.test(ch)

/** Ersetzt unerlaubte Zeichen, fasst Leerraum zusammen und kürzt auf `max` Zeichen. */
export function sanitizeQrText(input: string, max: number): string {
  let out = ''
  for (const ch of input.replace(/\s+/g, ' ').trim()) {
    out += REPLACEMENTS[ch] ?? (allowed(ch) ? ch : '.')
  }
  return out.slice(0, max)
}

/** Trennt eine angehängte Hausnummer («Obere Gasse 12a» → Strasse und «12a»). */
export function splitStreet(street: string): [string, string] {
  const m = /^(.*\S)\s+(\d[\w./-]*)$/.exec(street.trim())
  return m ? [m[1], m[2]] : [street.trim(), '']
}

const amount = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`

/** Der Text für den QR-Code. Zahlungspflichtiger bleibt leer, Referenzart `NON`. */
export function buildQrPayload(bank: BankDetails, cents: number): string {
  const [street, house] = splitStreet(bank.street)
  const empty = Array<string>(7).fill('')
  return [
    'SPC',
    '0200',
    '1',
    bank.iban,
    'S',
    sanitizeQrText(bank.holder, MAX.name),
    sanitizeQrText(street, MAX.street),
    sanitizeQrText(house, MAX.house),
    sanitizeQrText(bank.zip, MAX.zip),
    sanitizeQrText(bank.town, MAX.town),
    bank.country,
    ...empty,
    amount(cents),
    'CHF',
    ...empty,
    'NON',
    '',
    '',
    'EPD',
  ].join('\n')
}

export type QrBillStatus = { ok: true; bank: BankDetails } | { ok: false; reason: string }

/** Gibt es zu dieser Rechnung einen Zahlteil? Sonst der Grund für den Hinweis. */
export function qrBillStatus(
  country: Country,
  bank: BankDetails | undefined,
  balanceCents: number,
): QrBillStatus {
  if (country !== 'CH')
    return { ok: false, reason: 'Den Zahlteil mit QR-Code gibt es nur für die Schweiz (CHF).' }
  if (!bank)
    return {
      ok: false,
      reason: 'Ohne Bankverbindung in den Einstellungen gibt es keinen Zahlteil.',
    }
  if (!isValidSwissIban(bank.iban))
    return {
      ok: false,
      reason: 'Die IBAN in den Einstellungen ist ungültig, daher gibt es keinen Zahlteil.',
    }
  if (![bank.holder, bank.zip, bank.town].every((v) => sanitizeQrText(v, 70)))
    return {
      ok: false,
      reason: 'Für den Zahlteil fehlen Name, PLZ oder Ort in der Bankverbindung.',
    }
  if (balanceCents <= 0)
    return { ok: false, reason: 'Es ist nichts zu zahlen, daher gibt es keinen Zahlteil.' }
  return { ok: true, bank }
}
