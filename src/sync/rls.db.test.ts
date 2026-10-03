import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateDek } from '../crypto/keys'
import { encryptRecord } from '../crypto/records'

function status(): Record<string, string> {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
  return Object.fromEntries([...out.matchAll(/^(\w+)="(.*)"$/gm)].map((m) => [m[1], m[2]]))
}

const run = Date.now()
const uuid = () => crypto.randomUUID()
let url: string
let anonKey: string
let admin: SupabaseClient
let a: { client: SupabaseClient; id: string }
let b: { client: SupabaseClient; id: string }

async function makeUser(name: string) {
  const email = `${name}-${run}@test.local`
  const password = 'testpasswort-' + run
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  return { client, id: data.user.id }
}

beforeAll(async () => {
  const s = status()
  url = s.API_URL
  anonKey = s.ANON_KEY
  admin = createClient(url, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  a = await makeUser('a')
  b = await makeUser('b')
})

const row = (id: string, hlc: string, ciphertext = 'ct', deleted = false) => ({
  id,
  hlc,
  deleted,
  ciphertext,
})

describe('user_keys', () => {
  it('Person A legt ihre Schlüssel an, Person B sieht und ändert sie nicht', async () => {
    const ins = await a.client
      .from('user_keys')
      .insert({ user_id: a.id, wrapped_dek: 'w', wrapped_dek_recovery: 'r', kdf: { v: 1 } })
    expect(ins.error).toBeNull()
    expect((await a.client.from('user_keys').select()).data).toHaveLength(1)
    expect((await b.client.from('user_keys').select()).data).toEqual([])
    await b.client.from('user_keys').update({ wrapped_dek: 'hacked' }).eq('user_id', a.id)
    expect(
      (await admin.from('user_keys').select('wrapped_dek').eq('user_id', a.id)).data![0]
        .wrapped_dek,
    ).toBe('w')
  })
  it('Person B kann keine Schlüssel im Namen von A anlegen', async () => {
    const ins = await b.client
      .from('user_keys')
      .insert({ user_id: a.id, wrapped_dek: 'x', wrapped_dek_recovery: 'x', kdf: {} })
    expect(ins.error).not.toBeNull()
  })
})

describe('records', () => {
  it('direktes Schreiben ist verboten, nur push_records erlaubt', async () => {
    const ins = await a.client.from('records').insert({ user_id: a.id, ...row(uuid(), '1') })
    expect(ins.error).not.toBeNull()
  })
  it('Anonyme Aufrufe sind verboten', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    expect((await anon.rpc('push_records', { rows: [row(uuid(), '1')] })).error).not.toBeNull()
    expect((await anon.from('records').select()).data ?? []).toEqual([])
  })
  it('A und B sehen nur die eigenen Datensätze, auch bei gleicher ID', async () => {
    const shared = uuid()
    expect(
      (
        await a.client.rpc('push_records', {
          rows: [row(shared, '0001', 'von-a'), row(uuid(), '0001')],
        })
      ).error,
    ).toBeNull()
    expect(
      (await b.client.rpc('push_records', { rows: [row(shared, '0001', 'von-b')] })).error,
    ).toBeNull()
    const seenByB = (await b.client.from('records').select('id, ciphertext')).data!
    expect(seenByB).toEqual([{ id: shared, ciphertext: 'von-b' }])
    const seenByA = (await a.client.from('records').select('id, ciphertext').eq('id', shared)).data!
    expect(seenByA).toEqual([{ id: shared, ciphertext: 'von-a' }])
  })
  it('Last-Writer-Wins: ältere hlc überschreibt nicht, neuere schon; seq steigt', async () => {
    const id = uuid()
    await a.client.rpc('push_records', { rows: [row(id, '0005', 'v5')] })
    const first = (await a.client.from('records').select('seq, ciphertext').eq('id', id)).data![0]
    await a.client.rpc('push_records', { rows: [row(id, '0003', 'v3-alt')] })
    expect(
      (await a.client.from('records').select('ciphertext').eq('id', id)).data![0].ciphertext,
    ).toBe('v5')
    await a.client.rpc('push_records', { rows: [row(id, '0009', 'v9', true)] })
    const last = (await a.client.from('records').select('seq, ciphertext, deleted').eq('id', id))
      .data![0]
    expect(last).toMatchObject({ ciphertext: 'v9', deleted: true })
    expect(Number(last.seq)).toBeGreaterThan(Number(first.seq))
  })
  it('Pull über seq liefert nur Neueres', async () => {
    const { data: before } = await a.client.rpc('push_records', { rows: [row(uuid(), '1')] })
    await a.client.rpc('push_records', { rows: [row(uuid(), '1')] })
    const newer = (await a.client.from('records').select('id').gt('seq', before)).data!
    expect(newer).toHaveLength(1)
  })
  it('zu grosse Pakete werden abgelehnt', async () => {
    const rows = Array.from({ length: 501 }, () => row(uuid(), '1'))
    expect((await a.client.rpc('push_records', { rows })).error).not.toBeNull()
  })
  it('in der Datenbank steht kein Klartext', async () => {
    const dek = await generateDek()
    const id = uuid()
    const ct = await encryptRecord(dek, id, {
      table: 'transactions',
      data: { note: 'Streng-geheime-Notiz', amountCents: 4242 },
    })
    expect((await a.client.rpc('push_records', { rows: [row(id, '0001', ct)] })).error).toBeNull()
    const stored = (
      await admin.from('records').select('ciphertext').eq('id', id).eq('user_id', a.id)
    ).data![0].ciphertext
    expect(stored).toBe(ct)
    expect(Buffer.from(stored, 'base64').toString('latin1')).not.toContain('geheime')
  })
})

describe('delete_account', () => {
  it('löscht Benutzer und alle Daten', async () => {
    const c = await makeUser('c')
    await c.client
      .from('user_keys')
      .insert({ user_id: c.id, wrapped_dek: 'w', wrapped_dek_recovery: 'r', kdf: {} })
    await c.client.rpc('push_records', { rows: [row(uuid(), '1')] })
    expect((await c.client.rpc('delete_account')).error).toBeNull()
    expect((await admin.from('records').select('id').eq('user_id', c.id)).data).toEqual([])
    expect((await admin.from('user_keys').select('user_id').eq('user_id', c.id)).data).toEqual([])
    expect((await admin.auth.admin.getUserById(c.id)).data.user).toBeNull()
  })
})
