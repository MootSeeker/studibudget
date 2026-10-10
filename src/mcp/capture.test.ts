import { beforeAll, describe, expect, it, vi } from 'vitest'
import { generateInboxKeyPair, openInboxEntry } from '../crypto/inbox'
import type { ConnectorConfig } from './config'
import { type CaptureDeps, erfasse } from './capture'
import type { SendResult } from './inboxClient'

const ID = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b'
const GUELTIG = {
  date: '2026-10-09',
  amountCents: 1850,
  categoryName: 'Mittagessen',
  note: 'Mensa',
}
const KONFIG: ConnectorConfig = {
  supabaseUrl: 'https://beispiel.supabase.co',
  anonKey: 'anon-key',
  connectionId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
  publicKey: '',
  token: 'sbi1_' + 'a'.repeat(43),
  kategorien: ['Einkauf zuhause', 'Mittagessen'],
}
let privateKey: CryptoKey

beforeAll(async () => {
  const pair = await generateInboxKeyPair()
  KONFIG.publicKey = pair.publicKey
  privateKey = pair.privateKey
})

function deps(send: (id: string, ct: string) => Promise<SendResult>) {
  return {
    newId: () => ID,
    send: vi.fn(send),
    warte: vi.fn(async (_ms: number) => {}),
  } satisfies CaptureDeps & { send: unknown; warte: unknown }
}

describe('Werkzeug ausgabe_vorschlagen (#158)', () => {
  it('AK-1: meldet unbekannte Kategorie ohne Einliefern', async () => {
    const d = deps(async () => 'ok')
    const r = await erfasse({ ...GUELTIG, categoryName: 'Ferien' }, KONFIG, d)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe('Nicht eingeliefert: Die Kategorie «Ferien» gibt es nicht.')
    expect(d.send).not.toHaveBeenCalled()
  })

  it('AK-1: meldet ungültigen Betrag ohne Einliefern', async () => {
    const d = deps(async () => 'ok')
    const r = await erfasse({ ...GUELTIG, amountCents: 18.5 }, KONFIG, d)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe(
      'Nicht eingeliefert: Der Betrag muss eine ganze Zahl grösser 0 sein (in Rappen).',
    )
    expect(d.send).not.toHaveBeenCalled()
  })

  it('AK-1: meldet ungültiges Datum ohne Einliefern', async () => {
    const d = deps(async () => 'ok')
    const r = await erfasse({ ...GUELTIG, date: '2026-02-30' }, KONFIG, d)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe(
      'Nicht eingeliefert: Das Datum ist ungültig (erwartet JJJJ-MM-TT).',
    )
    expect(d.send).not.toHaveBeenCalled()
  })

  it('AK-1: meldet fehlende Angaben ohne Einliefern', async () => {
    const d = deps(async () => 'ok')
    const r = await erfasse(null, KONFIG, d)
    expect(r.isError).toBe(true)
    expect(r.content[0].text.startsWith('Nicht eingeliefert: ')).toBe(true)
    expect(d.send).not.toHaveBeenCalled()
  })

  it('AK-2: sendet nur Chiffretext, der sich mit dem privaten Schlüssel öffnen lässt', async () => {
    const d = deps(async () => 'ok')
    const r = await erfasse(GUELTIG, KONFIG, d)
    expect(d.send).toHaveBeenCalledTimes(1)
    const [sendId, ct] = d.send.mock.calls[0] as unknown as [string, string]
    expect(sendId).toBe(ID)
    expect(ct).not.toContain('Mittagessen')
    expect(ct).not.toContain('Mensa')
    expect(ct).not.toContain('1850')
    expect(JSON.parse(await openInboxEntry(privateKey, KONFIG.publicKey, ID, ct))).toEqual({
      studibudgetVorschlaege: 1,
      eintraege: [
        {
          id: ID,
          date: '2026-10-09',
          amountCents: 1850,
          categoryName: 'Mittagessen',
          note: 'Mensa',
        },
      ],
    })
    expect(r.isError).toBe(false)
    expect(r.content[0].text).toContain(ID)
  })

  it('AK-2: übernimmt den Kategorienamen aus der Konfiguration', async () => {
    const d = deps(async () => 'ok')
    await erfasse({ ...GUELTIG, categoryName: ' mittagessen ' }, KONFIG, d)
    const [, ct] = d.send.mock.calls[0] as unknown as [string, string]
    const klar = JSON.parse(await openInboxEntry(privateKey, KONFIG.publicKey, ID, ct))
    expect(klar.eintraege[0].categoryName).toBe('Mittagessen')
  })

  it('AK-2: meldet Serverfehler an die KI', async () => {
    const d = deps(async () => ({ fehler: 'Posteingang voll' }))
    const r = await erfasse(GUELTIG, KONFIG, d)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe('Nicht eingeliefert: Posteingang voll')
    expect(d.send).toHaveBeenCalledTimes(1)
  })

  it('AK-3: wiederholt nach Netzfehler mit derselben Vorschlags-ID', async () => {
    const d = deps(vi.fn<(id: string, ct: string) => Promise<SendResult>>())
    d.send.mockReset()
    d.send.mockResolvedValueOnce('netzfehler').mockResolvedValueOnce('ok')
    const r = await erfasse(GUELTIG, KONFIG, d)
    expect(d.send).toHaveBeenCalledTimes(2)
    expect(d.send.mock.calls[1]).toEqual(d.send.mock.calls[0])
    expect(d.warte).toHaveBeenCalledTimes(1)
    expect(d.warte).toHaveBeenCalledWith(1000)
    expect(r.isError).toBe(false)
  })

  it('AK-3: gibt nach drei Netzfehlern auf', async () => {
    const d = deps(async () => 'netzfehler')
    const r = await erfasse(GUELTIG, KONFIG, d)
    expect(d.send).toHaveBeenCalledTimes(3)
    expect(d.warte).toHaveBeenCalledTimes(2)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe(
      'StudiBudget ist nicht erreichbar. Der Vorschlag wurde nicht eingeliefert. Versuche es später noch einmal.',
    )
  })

  it('AK-4: meldet der KI, dass die Verbindung nicht mehr gilt', async () => {
    const d = deps(async () => 'widerrufen')
    const r = await erfasse(GUELTIG, KONFIG, d)
    expect(d.send).toHaveBeenCalledTimes(1)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe(
      'Die Verbindung zu StudiBudget gilt nicht mehr, sie wurde widerrufen. Richte in StudiBudget unter Einstellungen, KI-Posteingang eine neue Verbindung ein.',
    )
  })
})
