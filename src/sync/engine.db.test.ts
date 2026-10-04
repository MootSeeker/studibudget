import 'fake-indexeddb/auto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateDek } from '../crypto/keys'
import { StudiBudgetDB } from '../data/db'
import { createStore } from '../data/store'
import type { Transaction } from '../domain/types'
import { SyncEngine } from './engine'
import { supabaseTransport } from './transport'
import { supabaseStatus } from '../test/supabaseStatus'

const run = Date.now()
let url: string
let anonKey: string
let admin: SupabaseClient
let n = 0

async function makeUser(name: string) {
  const email = `${name}-${run}@test.local`
  const password = 'testpasswort-' + run
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { email, password }
}

/** Ein Gerät: eigener Supabase-Client (angemeldet) und eigene lokale Datenbank. */
async function device(
  user: { email: string; password: string },
  dek: CryptoKey,
  now = () => 1_000_000,
) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await sb.auth.signInWithPassword(user)
  if (error) throw error
  const db = new StudiBudgetDB(`e2e-${++n}`)
  const store = createStore(db, now)
  return { db, store, engine: new SyncEngine(db, store, supabaseTransport(sb), dek) }
}

const UUID = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
const tx = (id: string, note: string): Omit<Transaction, 'updatedAt'> => ({
  id,
  deleted: false,
  date: '2026-10-01',
  categoryId: 'c',
  amountCents: 100,
  myAmountCents: 100,
  note,
})

beforeAll(() => {
  const s = supabaseStatus()
  url = s.API_URL
  anonKey = s.ANON_KEY
  admin = createClient(url, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
})

describe('Sync gegen das echte Supabase', () => {
  it('zwei Geräte derselben Person gleichen sich ab, Konflikte entscheidet die spätere Änderung', async () => {
    const user = await makeUser('sync')
    const dek = await generateDek()
    const a = await device(user, dek, () => 1_000_000)
    const b = await device(user, dek, () => 2_000_000)
    await a.store.put('transactions', tx(UUID(1), 'von A'))
    await a.store.put('transactions', tx(UUID(2), 'zwei'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(a.engine.getStatus().state).toBe('idle')
    expect((await b.db.transactions.get(UUID(1)))?.note).toBe('von A')

    await a.store.put('transactions', tx(UUID(1), 'A neu'))
    await b.store.put('transactions', tx(UUID(1), 'B neu (später)'))
    await b.store.remove('transactions', UUID(2))
    for (const d of [a, b, a, b]) await d.engine.syncNow()
    for (const d of [a, b]) {
      expect((await d.db.transactions.get(UUID(1)))?.note).toBe('B neu (später)')
      expect((await d.db.transactions.get(UUID(2)))?.deleted).toBe(true)
      expect(await d.db.outbox.count()).toBe(0)
    }
  })

  it('eine andere Person bekommt nichts davon zu sehen', async () => {
    const owner = await makeUser('owner')
    const other = await makeUser('other')
    const dek = await generateDek()
    const a = await device(owner, dek)
    await a.store.put('transactions', tx(UUID(1), 'privat'))
    await a.engine.syncNow()
    const c = await device(other, await generateDek())
    await c.engine.syncNow()
    expect(await c.db.transactions.count()).toBe(0)
    expect(c.engine.getStatus().skipped).toBe(0)
  })
})
