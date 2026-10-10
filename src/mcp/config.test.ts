import { describe, expect, it } from 'vitest'
import { parseConnectorConfig } from './config'

const GUELTIG = {
  studibudgetPosteingang: 1,
  supabaseUrl: 'https://beispiel.supabase.co/',
  anonKey: 'anon-key',
  connectionId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
  publicKey: 'BAAA',
  token: 'sbi1_' + 'a'.repeat(43),
  kategorien: ['Einkauf zuhause', 'Mittagessen'],
}
const text = (werte: Record<string, unknown>) => JSON.stringify({ ...GUELTIG, ...werte })

describe('Konfiguration des MCP-Servers (#158)', () => {
  it('AK-1: liest die Konfiguration mit Kategorien', () => {
    const r = parseConnectorConfig(text({}))
    expect(r).toEqual({
      ok: true,
      config: {
        supabaseUrl: 'https://beispiel.supabase.co',
        anonKey: 'anon-key',
        connectionId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
        publicKey: 'BAAA',
        token: 'sbi1_' + 'a'.repeat(43),
        kategorien: ['Einkauf zuhause', 'Mittagessen'],
      },
    })
  })

  it('AK-1: meldet fehlende Kategorienliste', () => {
    const { kategorien: _k, ...ohne } = GUELTIG
    expect(parseConnectorConfig(JSON.stringify(ohne))).toEqual({
      ok: false,
      fehler: 'Die Konfiguration ist ungültig: «kategorien» fehlt oder ist falsch.',
    })
  })

  it('AK-1: meldet Text ohne JSON', () => {
    expect(parseConnectorConfig('kein json')).toEqual({
      ok: false,
      fehler: 'Die Konfiguration ist kein JSON-Objekt.',
    })
  })

  it('AK-1: meldet Token ohne Präfix sbi1_', () => {
    expect(parseConnectorConfig(text({ token: 'abc' }))).toEqual({
      ok: false,
      fehler: 'Die Konfiguration ist ungültig: «token» fehlt oder ist falsch.',
    })
  })
})
