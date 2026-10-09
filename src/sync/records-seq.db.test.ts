import { execSync, spawn } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { supabaseStatus } from '../test/supabaseStatus'

const run = crypto.randomUUID().slice(0, 8)
let url: string
let anonKey: string
let admin: SupabaseClient

async function makeUser(name: string): Promise<{ client: SupabaseClient; id: string }> {
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

/** Hält in einer zweiten Verbindung eine nicht committete Zeile mit (userId, id). */
function holdRow(userId: string, id: string): Promise<{ release: () => Promise<void> }> {
  const proc = spawn('docker', [
    'exec',
    '-i',
    'supabase_db_studibudget',
    'psql',
    '-U',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ])
  let out = ''
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('holdRow: Zeitüberschreitung')), 10000)
    proc.once('close', () => {
      clearTimeout(timer)
      reject(new Error('holdRow: psql beendet'))
    })
    proc.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString()
      if (out.includes('INSERT 0 1')) {
        clearTimeout(timer)
        resolve({
          release: () =>
            new Promise<void>((done) => {
              proc.once('close', () => done())
              proc.stdin.write('rollback;\n')
              proc.stdin.end()
            }),
        })
      }
    })
    proc.stdin.write(
      `begin;\ninsert into public.records (user_id, id, hlc, deleted, ciphertext) values ('${userId}', '${id}', '0000', false, 'halt');\n`,
    )
  })
}

/** Anzahl Verbindungen, die auf ein Lock eines push_records-Aufrufs warten. */
function lockWaiters(): number {
  const out = execSync(
    `docker exec supabase_db_studibudget psql -U postgres -tAc "select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%push_records%'"`,
    { encoding: 'utf8' },
  )
  return Number(out.trim())
}

async function waitUntil(cond: () => boolean, ms: number): Promise<boolean> {
  for (let i = 0; i < Math.ceil(ms / 50); i++) {
    if (cond()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return cond()
}

beforeAll(() => {
  const s = supabaseStatus()
  url = s.API_URL
  anonKey = s.ANON_KEY
  admin = createClient(url, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
})

describe('records_seq bei gleichzeitigen Pushes', () => {
  it('AK-1: Pull zwischen zwei gleichzeitigen Pushes verpasst keine Zeile', async () => {
    const d = await makeUser('seq')
    const idA = crypto.randomUUID()
    const idB = crypto.randomUUID()

    const { data: startSeq } = await d.client.rpc('push_records', {
      rows: [{ id: crypto.randomUUID(), hlc: '0001', deleted: false, ciphertext: 'start' }],
    })
    let cursor = Number(startSeq)

    const hold = await holdRow(d.id, idA)

    const pushA = d.client
      .rpc('push_records', {
        rows: [{ id: idA, hlc: '0001', deleted: false, ciphertext: 'a' }],
      })
      .then((r) => r)
    expect(await waitUntil(() => lockWaiters() >= 1, 10000)).toBe(true)

    let bDone = false
    const pushB = d.client
      .rpc('push_records', {
        rows: [{ id: idB, hlc: '0001', deleted: false, ciphertext: 'b' }],
      })
      .then((r) => {
        bDone = true
        return r
      })
    await waitUntil(() => bDone || lockWaiters() >= 2, 10000)

    const p1 = (await d.client.from('records').select('id, seq').gt('seq', cursor)).data!
    if (p1.length > 0) cursor = Math.max(...p1.map((r) => Number(r.seq)))

    await hold.release()
    const [ra, rb] = await Promise.all([pushA, pushB])
    expect(ra.error).toBeNull()
    expect(rb.error).toBeNull()

    const p2 = (await d.client.from('records').select('id, seq').gt('seq', cursor)).data!
    const seen = new Set([...p1, ...p2].map((r) => r.id))
    expect(seen.has(idA)).toBe(true)
    expect(seen.has(idB)).toBe(true)
  }, 30000)
})
