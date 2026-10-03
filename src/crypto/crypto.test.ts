// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { seal, open } from './box'
import { fromBase32, toBase32 } from './encoding'
import {
  createAccountKeys,
  generateDek,
  generateRecoveryCode,
  newRecoveryFor,
  parseRecoveryCode,
  rewrapForPassword,
  unlockWithPassword,
  unlockWithRecovery,
} from './keys'
import { decryptRecord, encryptRecord } from './records'

const FAST = { v: 1 as const, iterations: 1000 }
const PW = 'ein-langes-passwort-123'
const MAIL = 'Anna@Example.com'

async function rawOf(k: CryptoKey) {
  return Buffer.from(await crypto.subtle.exportKey('raw', k)).toString('hex')
}

describe('encoding', () => {
  it('Base32 hin und zurück', () => {
    const raw = crypto.getRandomValues(new Uint8Array(16))
    expect(fromBase32(toBase32(raw)).slice(0, 16)).toEqual(raw)
  })
})

describe('Wiederherstellungsschlüssel', () => {
  it('hat das Format und lässt sich lesen (Gross/Klein, ohne Striche)', () => {
    const { code, raw } = generateRecoveryCode()
    expect(code).toMatch(/^([A-Z2-7]{4}-){6}[A-Z2-7]{2}$/)
    expect(parseRecoveryCode(code)).toEqual(raw)
    expect(parseRecoveryCode(code.toLowerCase().replace(/-/g, ' '))).toEqual(raw)
  })
  it('lehnt zu kurze Schlüssel ab', () => {
    expect(() => parseRecoveryCode('ABCD-EFGH')).toThrow()
  })
})

describe('Datensätze', () => {
  it('Ergebnis ist ohne Schlüssel nicht lesbar und enthält keinen Klartext', async () => {
    const dek = await generateDek()
    const ct = await encryptRecord(dek, 'id-1', {
      table: 'transactions',
      data: { note: 'Geheime Migros-Notiz', amountCents: 2350 },
    })
    expect(ct).not.toContain('Geheime')
    expect(Buffer.from(ct, 'base64').toString('latin1')).not.toContain('Migros')
    expect(await decryptRecord(dek, 'id-1', ct)).toEqual({
      table: 'transactions',
      data: { note: 'Geheime Migros-Notiz', amountCents: 2350 },
    })
  })
  it('gleiche Daten ergeben jedes Mal anderen Chiffretext', async () => {
    const dek = await generateDek()
    const rec = { table: 't', data: 1 }
    expect(await encryptRecord(dek, 'x', rec)).not.toBe(await encryptRecord(dek, 'x', rec))
  })
  it('falscher Schlüssel, falsche ID oder veränderter Inhalt schlagen fehl', async () => {
    const dek = await generateDek()
    const ct = await encryptRecord(dek, 'id-1', { table: 't', data: 1 })
    await expect(decryptRecord(await generateDek(), 'id-1', ct)).rejects.toThrow()
    await expect(decryptRecord(dek, 'id-2', ct)).rejects.toThrow()
    const bytes = Buffer.from(ct, 'base64')
    bytes[bytes.length - 1] ^= 1
    await expect(decryptRecord(dek, 'id-1', bytes.toString('base64'))).rejects.toThrow()
  })
  it('seal/open mit Bytes', async () => {
    const dek = await generateDek()
    const sealed = await seal(dek, new Uint8Array([1, 2, 3]))
    expect(Array.from(await open(dek, sealed))).toEqual([1, 2, 3])
  })
})

describe('Konto-Schlüssel', () => {
  it('Anmeldung mit richtigem Passwort ergibt denselben Datenschlüssel und dasselbe Login-Geheimnis', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    const u = await unlockWithPassword(PW, 'anna@example.com ', k.wrappedDek, k.kdf)
    expect(await rawOf(u.dek)).toBe(await rawOf(k.dek))
    expect(u.authSecret).toBe(k.authSecret)
  })
  it('das Login-Geheimnis ist nicht das Passwort', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    expect(k.authSecret).not.toContain(PW)
    expect(k.authSecret).not.toBe(PW)
  })
  it('falsches Passwort scheitert und liefert ein anderes Login-Geheimnis', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    await expect(
      unlockWithPassword('falsch-falsch-123', MAIL, k.wrappedDek, k.kdf),
    ).rejects.toThrow()
    const other = await createAccountKeys('falsch-falsch-123', MAIL, FAST)
    expect(other.authSecret).not.toBe(k.authSecret)
  })
  it('andere E-Mail ergibt anderes Geheimnis (Salz)', async () => {
    const a = await createAccountKeys(PW, 'a@x.ch', FAST)
    const b = await createAccountKeys(PW, 'b@x.ch', FAST)
    expect(a.authSecret).not.toBe(b.authSecret)
  })
  it('Wiederherstellung mit dem Schlüssel öffnet denselben Datenschlüssel', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    const dek = await unlockWithRecovery(k.recoveryCode, k.wrappedDekRecovery)
    expect(await rawOf(dek)).toBe(await rawOf(k.dek))
  })
  it('falscher Wiederherstellungsschlüssel scheitert', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    await expect(
      unlockWithRecovery(generateRecoveryCode().code, k.wrappedDekRecovery),
    ).rejects.toThrow()
  })
  it('Passwort ändern: neues Passwort öffnet denselben Datenschlüssel, altes nicht mehr', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    const next = await rewrapForPassword(k.dek, 'neues-passwort-456', MAIL, FAST)
    const u = await unlockWithPassword('neues-passwort-456', MAIL, next.wrappedDek, next.kdf)
    expect(await rawOf(u.dek)).toBe(await rawOf(k.dek))
    await expect(unlockWithPassword(PW, MAIL, next.wrappedDek, next.kdf)).rejects.toThrow()
  })
  it('neuer Wiederherstellungsschlüssel macht den alten ungültig', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    const n = await newRecoveryFor(k.dek)
    expect(await rawOf(await unlockWithRecovery(n.recoveryCode, n.wrappedDekRecovery))).toBe(
      await rawOf(k.dek),
    )
    await expect(unlockWithRecovery(k.recoveryCode, n.wrappedDekRecovery)).rejects.toThrow()
  })
  it('verpackte Schlüssel verraten den Datenschlüssel nicht', async () => {
    const k = await createAccountKeys(PW, MAIL, FAST)
    const hex = await rawOf(k.dek)
    expect(Buffer.from(k.wrappedDek, 'base64').toString('hex')).not.toContain(hex)
    expect(k.wrappedDek).not.toBe(k.wrappedDekRecovery)
  })
})
