import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  generateInboxKeyPair,
  hashInboxToken,
  newInboxToken,
  openInboxEntry,
  sealForInbox,
} from '../crypto/inbox'
import { supabaseStatus } from '../test/supabaseStatus'

const run = crypto.randomUUID().slice(0, 8)
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
  const s = supabaseStatus()
  url = s.API_URL
  anonKey = s.ANON_KEY
  admin = createClient(url, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  a = await makeUser('inbox-a')
  b = await makeUser('inbox-b')
})

const anon = () => createClient(url, anonKey, { auth: { persistSession: false } })
async function verbinde(user: { client: SupabaseClient }) {
  const id = uuid()
  const token = newInboxToken()
  const ins = await user.client
    .from('inbox_connections')
    .insert({ id, token_hash: await hashInboxToken(token) })
  expect(ins.error).toBeNull()
  return { id, token, pair: await generateInboxKeyPair() }
}
const einliefern = (token: string, pid: string, ct: string) =>
  anon().rpc('inbox_insert', { p_token: token, p_proposal_id: pid, p_ciphertext: ct })

describe('Posteingang (#157, Server)', () => {
  it('AK-3: in inbox steht kein Klartext von Betrag, Kategorie oder Notiz', async () => {
    const v = await verbinde(a)
    const pid = uuid()
    const text = JSON.stringify({
      studibudgetVorschlaege: 1,
      eintraege: [
        {
          id: pid,
          date: '2026-10-09',
          amountCents: 98765,
          categoryName: 'Einkauf zuhause',
          note: 'Streng-geheime-Notiz',
        },
      ],
    })
    const ct = await sealForInbox(v.pair.publicKey, pid, text)
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
    const rows = (await admin.from('inbox').select('*').eq('proposal_id', pid)).data!
    expect(Object.keys(rows[0]).sort()).toEqual([
      'ciphertext',
      'connection_id',
      'created_at',
      'proposal_id',
      'user_id',
    ])
    const latin = Buffer.from(rows[0].ciphertext as string, 'base64').toString('latin1')
    expect(latin).not.toContain('geheime')
    expect(latin).not.toContain('Einkauf')
    expect(latin).not.toContain('98765')
    expect(await openInboxEntry(v.pair.privateKey, v.pair.publicKey, pid, rows[0].ciphertext)).toBe(
      text,
    )
  })

  it('AK-4: das Token fügt nur über inbox_insert ein', async () => {
    const v = await verbinde(a)
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
    const direkt = await anon()
      .from('inbox')
      .insert({ user_id: a.id, proposal_id: uuid(), connection_id: v.id, ciphertext: 'x' })
    expect(direkt.error).not.toBeNull()
    const records = await anon().from('records').insert({ id: uuid() })
    expect(records.error).not.toBeNull()
  })

  it('AK-4: mit dem Token lassen sich inbox, records und user_keys nicht lesen', async () => {
    const v = await verbinde(a)
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
    for (const t of ['inbox', 'records', 'user_keys', 'inbox_connections']) {
      expect((await anon().from(t).select()).data ?? []).toEqual([])
    }
  })

  it('AK-4: ein unbekanntes Token wird abgelehnt', async () => {
    const r = await einliefern(newInboxToken(), uuid(), 'x')
    expect(r.error).not.toBeNull()
  })

  it('AK-4: eine Verbindung lässt sich nicht für eine andere Person anlegen', async () => {
    const r = await b.client
      .from('inbox_connections')
      .insert({ id: uuid(), user_id: a.id, token_hash: await hashInboxToken(newInboxToken()) })
    expect(r.error).not.toBeNull()
  })

  it('AK-5: nach dem Widerruf lehnt der Server das Token ab', async () => {
    const v = await verbinde(a)
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
    const rev = await a.client.rpc('inbox_revoke', { p_connection_id: v.id })
    expect(rev.error).toBeNull()
    expect((await einliefern(v.token, uuid(), ct)).error).not.toBeNull()
    const rest = await admin.from('inbox').select('proposal_id').eq('connection_id', v.id)
    expect(rest.data).toEqual([])
  })

  it('AK-5: eine andere Person kann die Verbindung nicht widerrufen', async () => {
    const v = await verbinde(a)
    await b.client.rpc('inbox_revoke', { p_connection_id: v.id })
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
  })

  it('AK-6: dieselbe Vorschlags-ID liegt nur einmal in inbox', async () => {
    const v = await verbinde(a)
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
    expect(
      (await admin.from('inbox').select('proposal_id').eq('proposal_id', pid)).data!.length,
    ).toBe(1)
  })

  it('AK-7: nur die eigene Person löscht ihren Eintrag in inbox', async () => {
    const v = await verbinde(a)
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    expect((await einliefern(v.token, pid, ct)).error).toBeNull()
    expect((await a.client.from('inbox').select().eq('proposal_id', pid)).data).toHaveLength(1)
    expect((await b.client.from('inbox').select().eq('proposal_id', pid)).data).toHaveLength(0)
    await b.client.from('inbox').delete().eq('proposal_id', pid)
    expect(
      (await admin.from('inbox').select('proposal_id').eq('proposal_id', pid)).data!.length,
    ).toBe(1)
    await a.client.from('inbox').delete().eq('proposal_id', pid)
    expect(
      (await admin.from('inbox').select('proposal_id').eq('proposal_id', pid)).data!.length,
    ).toBe(0)
  })
})
