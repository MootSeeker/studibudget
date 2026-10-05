import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createAccountKeys } from '../../src/crypto/keys'
import { supabaseUmgebung } from './umgebung'

export const PASSWORT = 'Mein-langes-Passwort-1'

export interface Konto {
  id: string
  email: string
  passwort: string
  recoveryCode: string
}

const sb = supabaseUmgebung()

/** Client mit Service-Schlüssel: nur für Testaufbau und Aufräumen, nie in der App. */
export const admin: SupabaseClient = createClient(sb.url, sb.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let zaehler = 0
export function neueAdresse(vorname = 'lena'): string {
  return `${vorname}-${Date.now()}-${++zaehler}@test.local`
}

/**
 * Legt ein bestätigtes Konto an, ohne Hintertür in der App: Die Schlüssel entstehen in Node mit demselben Code wie im
 * Browser, der Server übernimmt sie aus den Metadaten wie bei der Registrierung.
 */
export async function kontoAnlegen(email = neueAdresse(), passwort = PASSWORT): Promise<Konto> {
  const keys = await createAccountKeys(passwort, email)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: keys.authSecret,
    email_confirm: true,
    user_metadata: {
      wrapped_dek: keys.wrappedDek,
      wrapped_dek_recovery: keys.wrappedDekRecovery,
      kdf: keys.kdf,
    },
  })
  if (error || !data.user) throw new Error(`Konto anlegen gescheitert: ${error?.message}`)
  return { id: data.user.id, email, passwort, recoveryCode: keys.recoveryCode }
}

export async function kontoLoeschen(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = data.users.find((x) => x.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

export async function kontoExistiert(email: string): Promise<boolean> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  return data.users.some((x) => x.email === email)
}
