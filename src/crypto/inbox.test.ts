import { describe, expect, it } from 'vitest'
import { fromB64 } from './encoding'
import {
  generateInboxKeyPair,
  hashInboxToken,
  newInboxToken,
  openInboxEntry,
  sealForInbox,
  unwrapInboxPrivateKey,
  wrapInboxPrivateKey,
} from './inbox'
import { createAccountKeys, generateDek, unlockWithRecovery } from './keys'

const ID = '11111111-1111-4111-8111-111111111111'
const TEXT = JSON.stringify({
  studibudgetVorschlaege: 1,
  eintraege: [
    {
      id: ID,
      date: '2026-10-09',
      amountCents: 1850,
      categoryName: 'Einkauf zuhause',
      note: 'Streng-geheime-Notiz',
    },
  ],
})

describe('Posteingang-Krypto (#157)', () => {
  it('AK-1: Schlüsselpaar ist P-256 mit 65 Byte öffentlichem Schlüssel', async () => {
    const pair = await generateInboxKeyPair()
    const raw = fromB64(pair.publicKey)
    expect(raw.length).toBe(65)
    expect(raw[0]).toBe(4)
    expect(pair.privateKey.algorithm).toMatchObject({ namedCurve: 'P-256' })
  })

  it('AK-1: privater Schlüssel ist mit dem Datenschlüssel verpackt', async () => {
    const dek = await generateDek()
    const pair = await generateInboxKeyPair()
    const wrapped = await wrapInboxPrivateKey(dek, ID, pair.privateKey)
    const priv = await unwrapInboxPrivateKey(dek, ID, wrapped)
    const ct = await sealForInbox(pair.publicKey, ID, TEXT)
    expect(await openInboxEntry(priv, pair.publicKey, ID, ct)).toBe(TEXT)
    const fremder = await generateDek()
    await expect(unwrapInboxPrivateKey(fremder, ID, wrapped)).rejects.toThrow()
    await expect(
      unwrapInboxPrivateKey(dek, '22222222-2222-4222-8222-222222222222', wrapped),
    ).rejects.toThrow()
  })

  it('AK-1: Token hat 256 Bit und der Hash ist SHA-256 in Hex', async () => {
    const t1 = newInboxToken()
    const t2 = newInboxToken()
    expect(t1).toMatch(/^sbi1_[A-Za-z0-9_-]{43}$/)
    expect(t1).not.toBe(t2)
    expect(await hashInboxToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('AK-2: Eintrag lässt sich mit dem privaten Schlüssel öffnen', async () => {
    const pair = await generateInboxKeyPair()
    const ct = await sealForInbox(pair.publicKey, ID, TEXT)
    expect(await openInboxEntry(pair.privateKey, pair.publicKey, ID, ct)).toBe(TEXT)
    expect(await openInboxEntry(pair.privateKey, pair.publicKey, ID.toUpperCase(), ct)).toBe(TEXT)
  })

  it('AK-2: falsche Vorschlags-ID wird abgelehnt', async () => {
    const pair = await generateInboxKeyPair()
    const ct = await sealForInbox(pair.publicKey, ID, TEXT)
    await expect(
      openInboxEntry(pair.privateKey, pair.publicKey, '22222222-2222-4222-8222-222222222222', ct),
    ).rejects.toThrow()
  })

  it('AK-2: fremder privater Schlüssel kann nicht öffnen', async () => {
    const pair = await generateInboxKeyPair()
    const fremd = await generateInboxKeyPair()
    const ct = await sealForInbox(pair.publicKey, ID, TEXT)
    await expect(openInboxEntry(fremd.privateKey, pair.publicKey, ID, ct)).rejects.toThrow()
    await expect(openInboxEntry(pair.privateKey, pair.publicKey, ID, 'AAAA')).rejects.toThrow(
      'Unbekanntes Format im Posteingang',
    )
  })

  it('AK-3: Chiffretext enthält keinen Klartext', async () => {
    const pair = await generateInboxKeyPair()
    const ct = await sealForInbox(pair.publicKey, ID, TEXT)
    const latin = Buffer.from(ct, 'base64').toString('latin1')
    expect(latin).not.toContain('geheime')
    expect(latin).not.toContain('Einkauf')
    expect(latin).not.toContain('1850')
    expect(fromB64(ct)[0]).toBe(1)
  })

  it('AK-8: nach Anmeldung mit dem Wiederherstellungsschlüssel lässt sich der Posteingang öffnen', async () => {
    const keys = await createAccountKeys('passwort-123', 'anna@example.com', {
      v: 1,
      iterations: 1000,
    })
    const dek2 = await unlockWithRecovery(keys.recoveryCode, keys.wrappedDekRecovery)
    const pair = await generateInboxKeyPair()
    const wrapped = await wrapInboxPrivateKey(keys.dek, ID, pair.privateKey)
    const priv = await unwrapInboxPrivateKey(dek2, ID, wrapped)
    const ct = await sealForInbox(pair.publicKey, ID, TEXT)
    expect(await openInboxEntry(priv, pair.publicKey, ID, ct)).toBe(TEXT)
  })
})
