import { execSync } from 'node:child_process'

export interface SupabaseUmgebung {
  url: string
  anonKey: string
  serviceKey: string
  mailUrl: string
}

/**
 * Adressen und Schlüssel des lokalen Supabase (`npx supabase start`). Bricht ab, wenn der Server nicht lokal ist:
 * Die Tests löschen und legen Konten an und dürfen nie gegen die Produktion laufen.
 */
export function supabaseUmgebung(): SupabaseUmgebung {
  let out: string
  try {
    out = execSync('npx supabase status -o env', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new Error(
      'Lokales Supabase läuft nicht. Starte es mit `npx supabase start` (Docker nötig).',
    )
  }
  const werte = Object.fromEntries([...out.matchAll(/^(\w+)="(.*)"$/gm)].map((m) => [m[1], m[2]]))
  const url = werte.API_URL
  if (!url || !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url))
    throw new Error(`Supabase-URL ist nicht lokal (${url}). E2E-Tests laufen nur gegen localhost.`)
  return {
    url,
    anonKey: werte.ANON_KEY,
    serviceKey: werte.SERVICE_ROLE_KEY,
    // Der lokale Mail-Fänger (Mailpit) liegt auf dem Port aus supabase/config.toml [local_smtp]
    mailUrl: 'http://127.0.0.1:54324',
  }
}
