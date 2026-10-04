import { describe, expect, it } from 'vitest'
import { MAX_AMOUNT_CENTS, buildEntry, type EntryInput } from './entry'
import { parseAmount } from './money'

describe('parseAmount: ungültige Eingaben', { tags: ['negativ'] }, () => {
  it.each([
    ['nur ein Minus', '-'],
    ['nur ein Punkt', '.'],
    ['nur ein Komma', ','],
    ['doppeltes Minus', '--5'],
    ['Minus hinten', '5-'],
    ['wissenschaftliche Schreibweise', '1e3'],
    ['Infinity', 'Infinity'],
    ['NaN', 'NaN'],
    ['Hexadezimal', '0x10'],
    ['arabisch-indische Ziffern', '٣٤'],
    ['Buchstaben im Betrag', '12a'],
    ['mehr als zwei Nachkommastellen', '1.2345'],
    ['leer', ''],
    ['nur Leerraum', ' \t '],
    ['Zahl über dem sicheren Bereich', '99999999999999999999'],
    ['echtes Minuszeichen U+2212 wird nicht erkannt', '−5'],
  ])('%s → null', (_name, input) => {
    expect(parseAmount(input)).toBeNull()
  })

  it.each([
    ['Währung vorn', '€5', 500],
    ['Währung hinten', '5 €', 500],
    ['EUR mit Leerzeichen', 'EUR 5,00', 500],
    ['CHF vorn', 'CHF 1’234.50', 123450],
    ['geschütztes Leerzeichen als Tausendertrenner', '1 234,50', 123450],
    ['schmales geschütztes Leerzeichen (de-CH ICU)', '1 234,50', 123450],
    ['negativ', '-5', -500],
  ])('%s wird erkannt', (_name, input, cents) => {
    expect(parseAmount(input)).toBe(cents)
  })

  it(
    'Zahlen mit uneinheitlichen Tausendergruppen sind keine Beträge (Regression #38)',
    { tags: ['regression'] },
    () => {
      for (const s of ['1.2.3', '1,2,3', '12.34.567', '1.2,50', '1.234.5'])
        expect(parseAmount(s), s).toBeNull()
      expect(parseAmount('1.234.567')).toBe(123456700)
      expect(parseAmount('1,234,567.50')).toBe(123456750)
    },
  )
})

const base: EntryInput = {
  id: 'e1',
  type: 'ausgabe',
  categoryId: 'c1',
  amount: '10',
  date: '2026-10-01',
  note: '',
  shared: null,
  goal: null,
}
const error = (patch: Partial<EntryInput>) => {
  const r = buildEntry({ ...base, ...patch })
  return r.ok ? null : r.error
}

describe('buildEntry: Grenzwerte und ungültige Eingaben', { tags: ['negativ'] }, () => {
  it('Betrag genau am Höchstwert geht, einen Rappen mehr nicht', () => {
    expect(error({ amount: String(MAX_AMOUNT_CENTS / 100) })).toBeNull()
    expect(error({ amount: String(MAX_AMOUNT_CENTS / 100 + 0.01) })).toMatch(/zu gross/)
  })
  it.each(['0', '0.00', '-5'])('Betrag %s wird abgelehnt', (amount) => {
    expect(error({ amount })).toMatch(/grösser als 0/)
  })
  it.each([
    ['29. Februar im Nicht-Schaltjahr', '2026-02-29'],
    ['Monat 00', '2026-00-10'],
    ['Monat 13', '2026-13-01'],
    ['Tag 00', '2026-10-00'],
    ['Tag 32', '2026-10-32'],
    ['einstelliger Tag', '2026-10-1'],
    ['führendes Leerzeichen', ' 2026-10-01'],
    ['leer', ''],
    ['Punkt-Schreibweise', '01.10.2026'],
  ])('Datum: %s wird abgelehnt', (_n, date) => {
    expect(error({ date })).toMatch(/gültiges Datum/)
  })
  it('29. Februar im Schaltjahr ist gültig', () => {
    expect(error({ date: '2028-02-29' })).toBeNull()
  })
  it.each([NaN, Infinity, -1, 101])('Prozentanteil %s wird abgelehnt', (myPct) => {
    expect(
      error({
        shared: { paidBy: 'me', mode: 'percent', participants: ['me'], partnerId: 'p', myPct },
      }),
    ).toMatch(/0 und 100/)
  })
  it('Prozentanteil ohne Partner wird abgelehnt', () => {
    expect(
      error({ shared: { paidBy: 'me', mode: 'percent', participants: ['me'], myPct: 50 } }),
    ).toMatch(/0 und 100/)
  })
  it('Notiz: die Länge zählt vor dem Trimmen', () => {
    expect(error({ note: 'x'.repeat(200) })).toBeNull()
    expect(error({ note: 'x'.repeat(201) })).toMatch(/200 Zeichen/)
    expect(error({ note: ' ' + 'x'.repeat(200) })).toMatch(/200 Zeichen/)
  })
})
