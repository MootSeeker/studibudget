/** IBAN für die Bankverbindung auf Rechnungen (Issue #104): nur Schweiz und Liechtenstein, 21 Zeichen. */

/** Entfernt Leerzeichen (auch geschützte und Tabs) und schreibt gross. */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

/** Gruppiert in Vierer («CH93 0076 2011 6238 5295 7»); normalisiert vorher. */
export function formatIban(input: string): string {
  return normalizeIban(input).replace(/(.{4})(?=.)/g, '$1 ')
}

/** Prüfsumme nach ISO 7064 Mod 97-10: die umgestellte Zahl muss bei Division durch 97 den Rest 1 lassen. */
function checksumOk(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let rest = 0
  for (const ch of rearranged) {
    const digits = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97
  }
  return rest === 1
}

/**
 * Ist `iban` (bereits normalisiert) eine gültige Schweizer oder Liechtensteiner IBAN?
 * Normalisiert nicht selbst: Leerzeichen und Kleinbuchstaben gelten als ungültig.
 */
export function isValidSwissIban(iban: string): boolean {
  return /^(CH|LI)\d{2}[0-9A-Z]{17}$/.test(iban) && checksumOk(iban)
}

/**
 * Ist `iban` (bereits normalisiert) eine gültige QR-IBAN (#160)? Erkennbar an der Bank-Kennung (IID, Stellen 5 bis 9)
 * im Bereich 30000 bis 31999. Eine QR-IBAN verlangt im Zahlteil eine QR-Referenz; der Zahlteil der App hat keine.
 */
export function isQrIban(iban: string): boolean {
  if (!isValidSwissIban(iban)) return false
  const iid = Number(iban.slice(4, 9))
  return iid >= 30000 && iid <= 31999
}

export const QR_IBAN_PROBLEM =
  'Das ist eine QR-IBAN. Für den Zahlteil braucht es die normale IBAN des Kontos.'

/**
 * Warum ist die Eingabe keine gültige Schweizer oder Liechtensteiner IBAN? `null`, wenn sie gültig ist (Issue #120).
 * Normalisiert vorher selbst; die Gründe sind nach Nutzen für die Korrektur geordnet.
 */
export function ibanProblem(input: string): string | null {
  const iban = normalizeIban(input)
  if (!iban) return 'Die IBAN fehlt.'
  // Vor dem Grossschreiben prüfen: «ß» würde sonst zu «SS» und die Zeichenzahl stimmte nicht mehr.
  if (!/^[0-9A-Za-z]+$/.test(input.replace(/\s+/g, '')))
    return 'Eine IBAN enthält nur Buchstaben und Ziffern.'
  if (!/^(CH|LI)/.test(iban))
    return 'Es gelten nur Schweizer und Liechtensteiner IBAN (sie beginnen mit CH oder LI).'
  if (iban.length !== 21) return `Die IBAN hat ${iban.length} Zeichen, erwartet sind 21.`
  if (!isValidSwissIban(iban))
    return /^(CH|LI)\d{2}/.test(iban)
      ? 'Die Prüfsumme der IBAN stimmt nicht: wahrscheinlich ein Tippfehler.'
      : 'Nach CH oder LI folgen zwei Ziffern.'
  if (isQrIban(iban)) return QR_IBAN_PROBLEM
  return null
}
