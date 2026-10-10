/** Konfiguration des MCP-Servers (#158): Inhalt des Felds «Konfiguration» aus Einstellungen, KI-Posteingang. */

export interface ConnectorConfig {
  supabaseUrl: string
  anonKey: string
  connectionId: string
  publicKey: string
  token: string
  kategorien: string[]
}

export type ConfigResult = { ok: true; config: ConnectorConfig } | { ok: false; fehler: string }

const FEHLER_KEIN_OBJEKT = 'Die Konfiguration ist kein JSON-Objekt.'
const fehlt = (feld: string) => `Die Konfiguration ist ungültig: «${feld}» fehlt oder ist falsch.`

function istText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function parseConnectorConfig(text: string): ConfigResult {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    return { ok: false, fehler: FEHLER_KEIN_OBJEKT }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { ok: false, fehler: FEHLER_KEIN_OBJEKT }
  }
  const o = obj as Record<string, unknown>
  if (o.studibudgetPosteingang !== 1) return { ok: false, fehler: fehlt('studibudgetPosteingang') }
  for (const feld of ['supabaseUrl', 'anonKey', 'connectionId', 'publicKey', 'token']) {
    if (!istText(o[feld])) return { ok: false, fehler: fehlt(feld) }
  }
  if (!(o.token as string).startsWith('sbi1_')) return { ok: false, fehler: fehlt('token') }
  const k = o.kategorien
  if (!Array.isArray(k) || k.length === 0 || !k.every((name) => istText(name))) {
    return { ok: false, fehler: fehlt('kategorien') }
  }
  return {
    ok: true,
    config: {
      supabaseUrl: (o.supabaseUrl as string).replace(/\/+$/, ''),
      anonKey: o.anonKey as string,
      connectionId: o.connectionId as string,
      publicKey: o.publicKey as string,
      token: o.token as string,
      kategorien: k as string[],
    },
  }
}
