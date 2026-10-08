import { isValidSwissIban, normalizeIban } from './iban'
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

/** Die Beispiel-IBAN aus der Dokumentation der Schweizer Banken; ein Zahlteil mit ihr lässt sich nicht bezahlen. */
const EXAMPLE_IBANS = ['CH9300762011623852957', 'LI21088100002324013AA']
export const isExampleIban = (iban: string) => EXAMPLE_IBANS.includes(normalizeIban(iban))

/**
 * Prüft den Inhalt des QR-Codes gegen die Datenstruktur der QR-Rechnung (Issue #121). Leer, wenn alles stimmt;
 * sonst die Verstösse als Sätze. Prüft nur, was unsere Ausgabe (Adresstyp S, ohne Referenz) verwendet.
 */
export function validateQrPayload(payload: string): string[] {
  const l = payload.split('\n')
  if (l.length !== 31) return [`Der Inhalt hat ${l.length} Zeilen statt 31.`]
  const problems: string[] = []
  const check = (ok: boolean, text: string) => ok || problems.push(text)
  const within = (i: number, max: number, name: string, required: boolean) => {
    check(l[i].length <= max, `${name}: höchstens ${max} Zeichen.`)
    if (required) check(l[i].length > 0, `${name} fehlt.`)
  }
  check(l[0] === 'SPC', 'Die Kopfzeile muss SPC lauten.')
  check(l[1] === '0200', 'Die Version muss 0200 sein.')
  check(l[2] === '1', 'Der Zeichensatz muss 1 (UTF-8) sein.')
  check(isValidSwissIban(l[3]), 'Die IBAN ist ungültig.')
  check(l[4] === 'S', 'Der Adresstyp muss S (strukturiert) sein.')
  within(5, 70, 'Name', true)
  within(6, 70, 'Strasse', false)
  within(7, 16, 'Hausnummer', false)
  within(8, 16, 'PLZ', true)
  within(9, 35, 'Ort', true)
  check(/^(CH|LI)$/.test(l[10]), 'Das Land muss CH oder LI sein.')
  check(
    l.slice(11, 18).every((x) => x === ''),
    'Die Felder des Endgläubigers müssen leer sein.',
  )
  check(
    /^[1-9]\d{0,8}\.\d{2}$|^0\.(0[1-9]|[1-9]\d)$/.test(l[18]),
    'Der Betrag muss grösser als 0 sein, mit Punkt und zwei Nachkommastellen.',
  )
  check(l[19] === 'CHF', 'Die Währung muss CHF sein.')
  check(
    l.slice(20, 27).every((x) => x === ''),
    'Der Zahlungspflichtige muss leer sein.',
  )
  check(l[27] === 'NON', 'Die Referenzart muss NON sein.')
  check(l[28] === '' && l[29] === '', 'Referenz und Mitteilung müssen leer sein.')
  check(l[30] === 'EPD', 'Das Schlusszeichen muss EPD lauten.')
  check(
    l.every((x) => /^[\x20-\x7E\u00A0-\u017F]*$/u.test(x)),
    'Der Inhalt enthält unerlaubte Zeichen.',
  )
  return problems
}
