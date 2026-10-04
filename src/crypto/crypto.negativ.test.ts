// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { open, seal } from './box'
import { fromB64, fromBase32, toB64, toBase32 } from './encoding'
import { DEFAULT_KDF, generateDek, generateRecoveryCode, parseRecoveryCode } from './keys'
import { decryptRecord, encryptRecord } from './records'

const bytes = (s: string) => new TextEncoder().encode(s)
const ID = '11111111-1111-4111-8111-111111111111'

describe('Verschlüsselung: manipulierte und kaputte Daten', { tags: ['negativ'] }, () => {
  it('ein verändertes IV-Byte wird abgelehnt', async () => {
    const dek = await generateDek()
    const raw = fromB64(await seal(dek, bytes('geheim'), 'a'))
    raw[0] ^= 1
    await expect(open(dek, toB64(raw), 'a')).rejects.toThrow()
  })
  it.each([
    ['leer', ''],
    ['kürzer als das IV', toB64(new Uint8Array(5))],
    ['nur IV, kein Chiffretext', toB64(new Uint8Array(12))],
    ['IV und zu kurzer Chiffretext (kein Tag)', toB64(new Uint8Array(20))],
  ])('%s wird abgelehnt', async (_n, sealed) => {
    await expect(open(await generateDek(), sealed)).rejects.toThrow()
  })
  it('Text, der kein Base64 ist, wird abgelehnt statt falsch gelesen', async () => {
    await expect(open(await generateDek(), 'das ist kein base64!')).rejects.toThrow()
  })
  it('abgeschnittener Chiffretext wird abgelehnt', async () => {
    const dek = await generateDek()
    const raw = fromB64(await seal(dek, bytes('geheim')))
    await expect(open(dek, toB64(raw.slice(0, raw.length - 1)))).rejects.toThrow()
  })
  it('ein Datensatz lässt sich nicht unter einer anderen ID entschlüsseln', async () => {
    const dek = await generateDek()
    const c = await encryptRecord(dek, ID, { table: 'persons', data: { x: 1 } })
    await expect(decryptRecord(dek, ID.replace(/1$/, '2'), c)).rejects.toThrow()
  })
  it('ein zweimal verschlüsselter Text unterscheidet sich (zufälliges IV)', async () => {
    const dek = await generateDek()
    expect(await seal(dek, bytes('gleich'))).not.toBe(await seal(dek, bytes('gleich')))
  })
})

describe('Wiederherstellungsschlüssel: ungültige Eingaben', { tags: ['negativ'] }, () => {
  it.each([
    ['25 Zeichen', 'A'.repeat(25)],
    ['27 Zeichen', 'A'.repeat(27)],
    ['leer', ''],
  ])('%s werden abgelehnt', (_n, code) => {
    expect(() => parseRecoveryCode(code)).toThrow(/26 Zeichen/)
  })
  it.each(['0', '1', '8', '9'])('die Ziffer %s ist nicht im Alphabet', (ch) => {
    const { code } = generateRecoveryCode()
    const bad = code.replace(/-/g, '').slice(0, 25) + ch
    expect(() => parseRecoveryCode(bad)).toThrow(/Ungültiges Zeichen/)
  })
  it('«ß» wird beim Grossschreiben zu «SS» und ändert die Länge, also abgelehnt', () => {
    const { code } = generateRecoveryCode()
    expect(() => parseRecoveryCode(code.replace(/-/g, '').slice(0, 25) + 'ß')).toThrow()
  })
  it('Base32 weist Zeichen ausserhalb des Alphabets ab', () => {
    expect(() => fromBase32('abc!')).toThrow()
    expect(toBase32(new Uint8Array([]))).toBe('')
  })
})

describe('Schlüsselableitung: Mindestaufwand', { tags: ['negativ'] }, () => {
  it('der Standard verwendet mindestens 600 000 Iterationen', () => {
    expect(DEFAULT_KDF.iterations).toBeGreaterThanOrEqual(600_000)
  })
})
