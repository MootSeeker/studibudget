import { beforeAll, describe, expect, it, vi } from 'vitest'
import { generateInboxKeyPair } from '../crypto/inbox'
import type { ConnectorConfig } from './config'
import { inboxInsert } from './inboxClient'

const ID = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b'
const KONFIG: ConnectorConfig = {
  supabaseUrl: 'https://beispiel.supabase.co',
  anonKey: 'anon-key',
  connectionId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
  publicKey: '',
  token: 'sbi1_' + 'a'.repeat(43),
  kategorien: ['Einkauf zuhause', 'Mittagessen'],
}

beforeAll(async () => {
  KONFIG.publicKey = (await generateInboxKeyPair()).publicKey
})

function antwort(ok: boolean, status: number, body?: unknown) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('kein Körper')
      return body
    },
  }))
}

describe('Einlieferung an inbox_insert (#158)', () => {
  it('AK-2: ruft inbox_insert mit Token, Vorschlags-ID und Chiffretext auf', async () => {
    const fetchFn = antwort(true, 204)
    expect(await inboxInsert(KONFIG, ID, 'CT', fetchFn)).toBe('ok')
    expect(fetchFn).toHaveBeenCalledWith('https://beispiel.supabase.co/rest/v1/rpc/inbox_insert', {
      method: 'POST',
      headers: {
        apikey: 'anon-key',
        Authorization: 'Bearer anon-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: KONFIG.token, p_proposal_id: ID, p_ciphertext: 'CT' }),
    })
  })

  it('AK-2: meldet andere Serverfehler mit der Meldung', async () => {
    const fetchFn = antwort(false, 400, { code: '54000', message: 'Posteingang voll' })
    expect(await inboxInsert(KONFIG, ID, 'CT', fetchFn)).toEqual({ fehler: 'Posteingang voll' })
  })

  it('AK-2: meldet Serverfehler ohne Körper mit dem Status', async () => {
    const fetchFn = antwort(false, 400)
    expect(await inboxInsert(KONFIG, ID, 'CT', fetchFn)).toEqual({ fehler: 'HTTP 400' })
  })

  it('AK-3: meldet Netzfehler, wenn fetch wirft', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await inboxInsert(KONFIG, ID, 'CT', fetchFn)).toBe('netzfehler')
  })

  it('AK-3: meldet Netzfehler bei Status 503', async () => {
    const fetchFn = antwort(false, 503, {})
    expect(await inboxInsert(KONFIG, ID, 'CT', fetchFn)).toBe('netzfehler')
  })

  it('AK-4: erkennt widerrufenes Token am Code 42501', async () => {
    const fetchFn = antwort(false, 401, {
      code: '42501',
      message: 'ungültiges oder widerrufenes Token',
    })
    expect(await inboxInsert(KONFIG, ID, 'CT', fetchFn)).toBe('widerrufen')
  })
})
