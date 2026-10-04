import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { TransportError, supabaseTransport } from './transport'

type Err = { message?: string; code?: string; status?: number }
const failing = (error: Err) =>
  supabaseTransport({
    rpc: async () => ({ error }),
    from: () => {
      const q = {
        select: () => q,
        gt: () => q,
        order: () => q,
        limit: async () => ({ data: null, error }),
      }
      return q
    },
  } as unknown as SupabaseClient)

const kindOf = async (error: Err) => {
  const e = await failing(error)
    .push([])
    .catch((x) => x)
  expect(e).toBeInstanceOf(TransportError)
  return (e as TransportError).kind
}

describe('Server-Fehler werden richtig eingeordnet', { tags: ['negativ'] }, () => {
  it.each([
    ['Failed to fetch', 'network'],
    ['Load failed', 'network'], // Safari
    ['The request timeout', 'network'],
    ['NetworkError when attempting to fetch resource', 'network'],
  ])('«%s» ist ein Netzwerkfehler', async (message, kind) => {
    expect(await kindOf({ message })).toBe(kind)
  })
  it('Status 0 ist ein Netzwerkfehler', async () => {
    expect(await kindOf({ message: 'x', status: 0 })).toBe('network')
  })
  it.each([
    ['PGRST301 (JWT ungültig)', { message: 'x', code: 'PGRST301' }],
    ['42501 (keine Berechtigung)', { message: 'x', code: '42501' }],
    ['HTTP 401', { message: 'x', status: 401 }],
    ['«JWT expired»', { message: 'JWT expired' }],
  ])('%s ist ein Anmeldefehler', async (_n, error) => {
    expect(await kindOf(error)).toBe('auth')
  })
  it.each([
    ['HTTP 500', { message: 'Internal error', status: 500 }],
    ['22023 (ungültiger Parameter)', { message: 'bad', code: '22023' }],
  ])('%s ist ein anderer Fehler', async (_n, error) => {
    expect(await kindOf(error)).toBe('other')
  })
  it('ohne Meldung gibt es eine Standardmeldung', async () => {
    const e = await failing({})
      .push([])
      .catch((x) => x)
    expect(e.message).toBe('Unbekannter Fehler')
  })
  it('pull() ohne Daten liefert eine leere Liste', async () => {
    const t = supabaseTransport({
      from: () => {
        const q = {
          select: () => q,
          gt: () => q,
          order: () => q,
          limit: async () => ({ data: null, error: null }),
        }
        return q
      },
    } as unknown as SupabaseClient)
    expect(await t.pull(0, 10)).toEqual([])
  })
  it('pull() meldet Fehler als TransportError', async () => {
    const e = await failing({ message: 'Failed to fetch' })
      .pull(0, 10)
      .catch((x) => x)
    expect(e).toBeInstanceOf(TransportError)
  })
})
