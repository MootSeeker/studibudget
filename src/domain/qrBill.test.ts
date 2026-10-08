import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildQrPayload, qrBillStatus, sanitizeQrText, splitStreet } from './qrBill'
import type { BankDetails } from './types'

const bank: BankDetails = {
  holder: 'Kevin Muster',
  street: 'Weg 1',
  zip: '8000',
  town: 'Zürich',
  country: 'CH',
  iban: 'CH9300762011623852957',
}

describe('Swiss QR-Payload', () => {
  it('AK-2: entspricht Zeichen für Zeichen dem Beispiel nach der Spezifikation (Typ S, ohne Referenz)', () => {
    const expected = [
      'SPC',
      '0200',
      '1',
      'CH9300762011623852957',
      'S',
      'Kevin Muster',
      'Weg',
      '1',
      '8000',
      'Zürich',
      'CH',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '2100.00',
      'CHF',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'NON',
      '',
      '',
      'EPD',
    ].join('\n')
    expect(buildQrPayload(bank, 210000)).toBe(expected)
  })

  it('AK-4: Betrag in Rappen mit Punkt und zwei Nachkommastellen', () => {
    expect(buildQrPayload(bank, 5).split('\n')[18]).toBe('0.05')
    expect(buildQrPayload(bank, 100).split('\n')[18]).toBe('1.00')
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99999999999 }), (c) => {
        const amt = buildQrPayload(bank, c).split('\n')[18]
        expect(amt).toMatch(/^\d+\.\d{2}$/)
        expect(Math.round(Number(amt) * 100)).toBe(c)
      }),
    )
  })

  it('AK-6: unerlaubte Zeichen werden ersetzt, Limits eingehalten', () => {
    expect(sanitizeQrText('Müller 😀 „Hans“ – Zürich', 70)).toBe('Müller . "Hans" - Zürich')
    expect(sanitizeQrText('a'.repeat(100), 70)).toHaveLength(70)
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        const out = sanitizeQrText(s, 70)
        expect(out.length).toBeLessThanOrEqual(70)
        expect(out).not.toMatch(/[\n\r]/)
        expect(out).toMatch(/^[\x20-\x7E -ſ]*$/u)
      }),
    )
    const lines = buildQrPayload(
      { ...bank, holder: 'X😀'.repeat(60), town: 'T'.repeat(50) },
      100,
    ).split('\n')
    expect(lines[5].length).toBeLessThanOrEqual(70)
    expect(lines[9].length).toBeLessThanOrEqual(35)
  })

  it('trennt die Hausnummer von der Strasse', () => {
    expect(splitStreet('Weg 1')).toEqual(['Weg', '1'])
    expect(splitStreet('Obere Gasse 12a')).toEqual(['Obere Gasse', '12a'])
    expect(splitStreet('Bahnhofstrasse')).toEqual(['Bahnhofstrasse', ''])
  })
})

describe('qrBillStatus', () => {
  it('AK-1: ok bei CH, gültiger Bank und Saldo > 0', () => {
    expect(qrBillStatus('CH', bank, 100)).toEqual({ ok: true, bank })
  })
  it('AK-4: Saldo 0 oder negativ → kein Zahlteil', () => {
    expect(qrBillStatus('CH', bank, 0)).toMatchObject({ ok: false })
    expect(qrBillStatus('CH', bank, -5)).toMatchObject({ ok: false })
  })
  it('AK-5: EUR, fehlende oder ungültige Bank nennen den Grund', () => {
    expect(qrBillStatus('DE', bank, 100)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Schweiz/),
    })
    expect(qrBillStatus('CH', undefined, 100)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Bankverbindung/),
    })
    expect(qrBillStatus('CH', { ...bank, iban: 'CH00' }, 100)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/IBAN/),
    })
    expect(qrBillStatus('CH', { ...bank, holder: '' }, 100)).toMatchObject({ ok: false })
  })
})
