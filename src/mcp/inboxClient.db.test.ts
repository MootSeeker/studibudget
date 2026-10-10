import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateInboxKeyPair, hashInboxToken, newInboxToken, sealForInbox } from '../crypto/inbox'
import { supabaseStatus } from '../test/supabaseStatus'
import type { ConnectorConfig } from './config'
import { inboxInsert } from './inboxClient'

const run = crypto.randomUUID().slice(0, 8)
const uuid = () => crypto.randomUUID()
let url: string
let anonKey: string
let admin: SupabaseClient
let a: { client: SupabaseClient; id: string }

async function makeUser(name: string) {
  const email = `mcp-${name}-${run}@test.local`
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
})

async function verbinde() {
  const id = uuid()
  const token = newInboxToken()
  const ins = await a.client
    .from('inbox_connections')
    .insert({ id, token_hash: await hashInboxToken(token) })
  if (ins.error) throw ins.error
  return { id, token, pair: await generateInboxKeyPair() }
}

function konfig(token: string, publicKey: string): ConnectorConfig {
  return {
    supabaseUrl: url,
    anonKey,
    connectionId: '',
    publicKey,
    token,
    kategorien: [],
  }
}

describe('MCP-Einlieferung gegen den Posteingang (#158, Server)', () => {
  it('AK-3: zweimal dieselbe Vorschlags-ID ergibt eine Zeile', async () => {
    const v = await verbinde()
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    const k = konfig(v.token, v.pair.publicKey)
    expect(await inboxInsert(k, pid, ct, fetch)).toBe('ok')
    expect(await inboxInsert(k, pid, ct, fetch)).toBe('ok')
    expect((await admin.from('inbox').select('*').eq('proposal_id', pid)).data).toHaveLength(1)
  })

  it('AK-4: widerrufene Verbindung ergibt widerrufen', async () => {
    const v = await verbinde()
    const rev = await a.client.rpc('inbox_revoke', { p_connection_id: v.id })
    expect(rev.error).toBeNull()
    const pid = uuid()
    const ct = await sealForInbox(v.pair.publicKey, pid, '{}')
    expect(await inboxInsert(konfig(v.token, v.pair.publicKey), pid, ct, fetch)).toBe('widerrufen')
  })
})
