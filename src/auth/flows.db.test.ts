import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { decryptRecord, encryptRecord } from '../crypto/records'
import {
  AuthError,
  changePassword,
  deleteAccount,
  deleteAccountWithoutKey,
  login,
  logout,
  register,
  renewRecoveryKey,
  resetWithRecovery,
} from './flows'

function status(): Record<string, string> {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
  return Object.fromEntries([...out.matchAll(/^(\w+)="(.*)"$/gm)].map((m) => [m[1], m[2]]))
}

const run = Date.now()
let url: string
let anonKey: string
let admin: SupabaseClient

/** Ein «Gerät» = ein eigener Client ohne gemeinsamen Speicher. */
const device = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

const PW = 'Mein-langes-Passwort-1'
const NEW_PW = 'Ganz-neues-Passwort-2'
const REDIRECT = 'http://localhost:5173/studibudget/'

async function confirm(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = data.users.find((x) => x.email === email)!
  await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
  return u.id
}

beforeAll(() => {
  const s = status()
  url = s.API_URL
  anonKey = s.ANON_KEY
  admin = createClient(url, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
})

describe('Konto-Lebenszyklus', () => {
  const email = `lena-${run}@test.local`
  let recoveryCode: string
  let userId: string
  let record: string

  it('Registrieren: Schlüssel landen per Trigger in user_keys, Metadaten werden bereinigt', async () => {
    const res = await register(device(), email, PW, REDIRECT)
    recoveryCode = res.recoveryCode
    expect(recoveryCode).toMatch(/^([A-Z2-7]{4}-){6}[A-Z2-7]{2}$/)
    userId = await confirm(email)
    const keys = (await admin.from('user_keys').select().eq('user_id', userId)).data!
    expect(keys).toHaveLength(1)
    const user = (await admin.auth.admin.getUserById(userId)).data.user!
    expect(user.user_metadata).not.toHaveProperty('wrapped_dek')
    expect(user.user_metadata).not.toHaveProperty('kdf')
  })

  it('zu kurzes Passwort wird abgelehnt', async () => {
    await expect(register(device(), `x-${run}@test.local`, 'kurz', REDIRECT)).rejects.toMatchObject(
      { code: 'weak' },
    )
  })

  it('das echte Passwort ist beim Server nicht als Login-Passwort hinterlegt', async () => {
    const raw = await device().auth.signInWithPassword({ email, password: PW })
    expect(raw.error).not.toBeNull()
  })

  it('ohne bestätigte E-Mail ist kein Login möglich', async () => {
    const other = `unbestaetigt-${run}@test.local`
    await register(device(), other, PW, REDIRECT)
    await expect(login(device(), other, PW)).rejects.toMatchObject({ code: 'unconfirmed' })
  })

  it('Login mit richtigem Passwort liefert den Datenschlüssel, falsches scheitert', async () => {
    const d = device()
    const { dek } = await login(d, email, PW)
    record = await encryptRecord(dek, 'rec-1', { table: 'transactions', data: { note: 'Geheim' } })
    await expect(login(device(), email, 'Falsches-Passwort-123')).rejects.toBeInstanceOf(AuthError)
    await logout(d)
  })

  it('Passwort ändern: neues Passwort öffnet dieselben Daten, altes nicht mehr', async () => {
    const d = device()
    await login(d, email, PW)
    await expect(changePassword(d, email, 'Falsches-Passwort-123', NEW_PW)).rejects.toMatchObject({
      code: 'invalid',
    })
    await changePassword(d, email, PW, NEW_PW)
    await logout(d)
    await expect(login(device(), email, PW)).rejects.toMatchObject({ code: 'invalid' })
    const { dek } = await login(device(), email, NEW_PW)
    expect(await decryptRecord(dek, 'rec-1', record)).toMatchObject({ data: { note: 'Geheim' } })
  })

  it('Passwort vergessen: falscher Schlüssel scheitert, richtiger setzt neues Passwort und behält die Daten', async () => {
    const d = device()
    await login(d, email, NEW_PW) // entspricht der Sitzung aus dem Link der Reset-Mail
    await expect(
      resetWithRecovery(d, email, 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG', 'Wieder-ein-Passwort-3'),
    ).rejects.toMatchObject({ code: 'invalid' })
    const dek = await resetWithRecovery(d, email, recoveryCode, 'Wieder-ein-Passwort-3')
    expect(await decryptRecord(dek, 'rec-1', record)).toMatchObject({ data: { note: 'Geheim' } })
    await logout(d)
    const again = await login(device(), email, 'Wieder-ein-Passwort-3')
    expect(await decryptRecord(again.dek, 'rec-1', record)).toBeTruthy()
  })

  it('neuer Wiederherstellungsschlüssel macht den alten ungültig', async () => {
    const d = device()
    await login(d, email, 'Wieder-ein-Passwort-3')
    const fresh = await renewRecoveryKey(d, email, 'Wieder-ein-Passwort-3')
    expect(fresh).not.toBe(recoveryCode)
    await expect(resetWithRecovery(d, email, recoveryCode, NEW_PW)).rejects.toMatchObject({
      code: 'invalid',
    })
    await resetWithRecovery(d, email, fresh, NEW_PW)
    await logout(d)
  })

  it('Konto löschen braucht das Passwort und entfernt alle Daten', async () => {
    const d = device()
    await login(d, email, NEW_PW)
    await d.rpc('push_records', {
      rows: [{ id: crypto.randomUUID(), hlc: '1', deleted: false, ciphertext: record }],
    })
    await expect(deleteAccount(d, email, 'Falsches-Passwort-123')).rejects.toMatchObject({
      code: 'invalid',
    })
    await deleteAccount(d, email, NEW_PW)
    expect((await admin.from('records').select('id').eq('user_id', userId)).data).toEqual([])
    expect((await admin.from('user_keys').select('user_id').eq('user_id', userId)).data).toEqual([])
    expect((await admin.auth.admin.getUserById(userId)).data.user).toBeNull()
  })

  it('Zurücksetzen ohne Schlüssel löscht das Konto', async () => {
    const mail = `ohne-schluessel-${run}@test.local`
    await register(device(), mail, PW, REDIRECT)
    const id = await confirm(mail)
    const d = device()
    await login(d, mail, PW)
    await deleteAccountWithoutKey(d)
    expect((await admin.auth.admin.getUserById(id)).data.user).toBeNull()
  })
})
