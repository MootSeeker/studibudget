import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { decryptRecord, encryptRecord } from '../crypto/records'
import { changeEmail, login, register } from './flows'
import { supabaseStatus } from '../test/supabaseStatus'

const run = Date.now()
let url: string
let anonKey: string
let admin: SupabaseClient

/** Ein «Gerät» = ein eigener Client ohne gemeinsamen Speicher. */
const device = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

const PW = 'Mein-langes-Passwort-1'
const REDIRECT = 'http://localhost:5173/studibudget/'

/** Bestätigung ohne Mail-Abruf: der Admin-Client bestätigt die Adresse wie in flows.db.test.ts. */
async function confirm(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = data.users.find((x) => x.email === email)!
  await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
  return u.id
}

beforeAll(() => {
  const s = supabaseStatus()
  url = s.API_URL
  anonKey = s.ANON_KEY
  admin = createClient(url, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
})

describe('E-Mail-Adresse ändern (Issue #188)', () => {
  it('AK-2: nach der Änderung entschlüsselt die neue Adresse alles', async () => {
    const alt = `wechsel-${run}@test.local`
    const neu = `neu-${run}@test.local`
    const d = device()
    await register(d, alt, PW, REDIRECT)
    const id = await confirm(alt)
    const { dek } = await login(d, alt, PW)
    const record = await encryptRecord(dek, 'rec-mail-1', { table: 'notes', data: 'geheim' })

    await changeEmail(d, alt, PW, neu)
    // Beide Adressen müssen bestätigen (double_confirm_changes): hier per Admin-Client
    await admin.auth.admin.updateUserById(id, { email: neu, email_confirm: true })

    const { dek: neuerDek } = await login(device(), neu, PW)
    expect(await decryptRecord(neuerDek, 'rec-mail-1', record)).toEqual({
      table: 'notes',
      data: 'geheim',
    })
  })

  it('AK-3: vergebene und ungültige Adresse', async () => {
    const besetzt = `besetzt-${run}@test.local`
    const wechsler = `wechsler-${run}@test.local`
    await register(device(), besetzt, PW, REDIRECT)
    await confirm(besetzt)
    const d = device()
    await register(d, wechsler, PW, REDIRECT)
    await confirm(wechsler)
    await login(d, wechsler, PW)

    await expect(changeEmail(d, wechsler, PW, besetzt)).rejects.toThrow(
      'Diese Adresse ist schon vergeben.',
    )
    await expect(changeEmail(d, wechsler, PW, 'abc')).rejects.toThrow(
      'Bitte gib eine gültige E-Mail-Adresse ein.',
    )
    // Die Rücknahme hat gegriffen: die alte Adresse mit dem Passwort geht weiterhin
    await expect(login(device(), wechsler, PW)).resolves.toBeDefined()
  })
})
