import { describe, expect, it } from 'vitest'
import { formatIban, ibanProblem, isValidSwissIban, normalizeIban } from './iban'

// Bankverbindung für Rechnungen (Issue #104): nur Schweizer und Liechtensteiner IBAN.

const CH = 'CH9300762011623852957' // Beispiel-IBAN aus der Dokumentation der Schweizer Banken
const LI = 'LI21088100002324013AA' // Beispiel-IBAN aus der Dokumentation (mit Buchstaben)

describe('normalizeIban (AK-3)', () => {
  it.each([
    ['CH93 0076 2011 6238 5295 7', CH],
    ['ch93 0076 2011 6238 5295 7', CH],
    ['  ch9300762011623852957  ', CH],
    ['CH93 0076\t2011 6238 5295 7', CH],
    ['li21 0881 0000 2324 013a a', LI],
  ])('«%s» wird zu «%s»', (input, expected) => {
    expect(normalizeIban(input)).toBe(expected)
  })
})

describe('formatIban (AK-3)', () => {
  it('gruppiert in Vierer, der Rest steht am Ende', () => {
    expect(formatIban(CH)).toBe('CH93 0076 2011 6238 5295 7')
    expect(formatIban(LI)).toBe('LI21 0881 0000 2324 013A A')
  })
  it('normalisiert zuerst, bevor es gruppiert', () => {
    expect(formatIban('ch93 00762011 6238 52957')).toBe('CH93 0076 2011 6238 5295 7')
  })
})

describe('isValidSwissIban (AK-2)', () => {
  it.each([CH, LI])('akzeptiert die gültige IBAN %s', (iban) => {
    expect(isValidSwissIban(iban)).toBe(true)
  })

  it.each([
    ['falsche Prüfziffer', 'CH9400762011623852957'],
    ['geändertes Zeichen im Konto', 'CH9300762011623852958'],
    ['zu kurz', 'CH930076201162385295'],
    ['zu lang', 'CH93007620116238529570'],
    ['deutsche IBAN (gültig, aber nicht CH oder LI)', 'DE89370400440532013000'],
    ['österreichische IBAN', 'AT611904300234573201'],
    ['Länderkennzeichen klein und nicht normalisiert', 'ch9300762011623852957'],
    ['Leerzeichen sind nicht normalisiert', 'CH93 0076 2011 6238 5295 7'],
    ['leer', ''],
    ['nur Buchstaben', 'CHABCDEFGHIJKLMNOPQRS'],
    ['Sonderzeichen', 'CH93-0076-2011-6238-5295-7'],
  ])('lehnt ab: %s', (_name, iban) => {
    expect(isValidSwissIban(iban)).toBe(false)
  })
})

describe('ibanProblem (Issue #120)', () => {
  it('AK-1: gültige IBAN hat kein Problem, auch mit Leerzeichen und Kleinbuchstaben', () => {
    expect(ibanProblem(CH)).toBeNull()
    expect(ibanProblem('ch93 0076 2011 6238 5295 7')).toBeNull()
    expect(ibanProblem(LI)).toBeNull()
  })
  it.each([
    ['Prüfsumme falsch', 'CH78 9325 3212 9847 3647 3', /Prüfsumme/],
    ['zu kurz', 'CH93 0076 2011 6238 5295', /20 Zeichen.*21/],
    ['zu lang', 'CH93 0076 2011 6238 5295 77', /22 Zeichen.*21/],
    ['deutsche IBAN', 'DE89 3704 0044 0532 0130 00', /Schweiz.*Liechtenstein/],
    ['Sonderzeichen', 'CH93 0076 2011 6238 529-7', /Buchstaben und Ziffern/],
    ['Sonderzeichen ß (würde zu SS)', 'CH93 0076 2011 6238 5295 ß', /Buchstaben und Ziffern/],
    ['leer', '   ', /fehlt/],
  ])('AK-1: nennt den Grund: %s', (_n, iban, grund) => {
    expect(ibanProblem(iban)).toMatch(grund)
  })
  it('stimmt mit isValidSwissIban überein', () => {
    for (const i of [CH, LI, 'CH7893253212984736473', 'DE89370400440532013000', 'CH93'])
      expect(ibanProblem(i) === null).toBe(isValidSwissIban(normalizeIban(i)))
  })
})
