// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { generateDek } from '../crypto/keys'
import { encryptRecord } from '../crypto/records'
import { StudiBudgetDB } from '../data/db'
import { createStore } from '../data/store'
import type { Transaction } from '../domain/types'
import { SyncEngine } from './engine'
import { format, receive, tick } from './hlc'
import { TransportError, type PullRow, type PushRow, type Transport } from './transport'

/** Server im Speicher mit derselben Last-Writer-Wins-Regel wie push_records(). */
class FakeServer implements Transport {
  rows = new Map<string, PullRow>()
  seq = 0
  online = true
  async push(rows: PushRow[]) {
    if (!this.online) throw new TransportError('network', 'Failed to fetch')
    for (const r of rows) {
      const cur = this.rows.get(r.id)
      if (!cur || cur.hlc < r.hlc) this.rows.set(r.id, { ...r, seq: ++this.seq })
    }
  }
  async pull(afterSeq: number, limit: number) {
    if (!this.online) throw new TransportError('network', 'Failed to fetch')
    return [...this.rows.values()]
      .filter((r) => r.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
  }
}

let n = 0
async function device(server: Transport, dek: CryptoKey, now = () => 1_000_000, opts = {}) {
  const db = new StudiBudgetDB(`dev-${++n}-${Math.random()}`)
  const store = createStore(db, now)
  const engine = new SyncEngine(db, store, server, dek, opts)
  return { db, store, engine }
}

const tx = (
  id: string,
  note: string,
  extra: Partial<Transaction> = {},
): Omit<Transaction, 'updatedAt'> => ({
  id,
  deleted: false,
  date: '2026-10-01',
  categoryId: 'c',
  amountCents: 100,
  myAmountCents: 100,
  note,
  ...extra,
})
const UUID = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`

describe('HLC', () => {
  it('läuft nie rückwärts, auch wenn die Systemzeit zurückspringt', () => {
    let s = { wall: 0, counter: 0 }
    const stamps: string[] = []
    for (const t of [1000, 1000, 900, 2000, 1500]) {
      s = tick(s, t)
      stamps.push(format(s, 'aaaa0000'))
    }
    expect([...stamps].sort()).toEqual(stamps)
    expect(new Set(stamps).size).toBe(stamps.length)
  })
  it('nach dem Empfang ist der nächste eigene Stempel grösser als der fremde', () => {
    const remote = format({ wall: 5000, counter: 7 }, 'bbbb0000')
    const s = tick(receive({ wall: 1000, counter: 0 }, remote), 1200)
    expect(format(s, 'aaaa0000') > remote).toBe(true)
  })
})

describe('Sync', () => {
  it('Daten von Gerät A erscheinen auf Gerät B, die Outbox ist danach leer', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const a = await device(server, dek)
    const b = await device(server, dek)
    await a.store.put('transactions', tx(UUID(1), 'Migros'))
    await a.store.put('categories', {
      id: UUID(2),
      deleted: false,
      areaId: 'x',
      name: 'Essen',
      type: 'ausgabe',
      fix: false,
      rolloverFrom: null,
      hidden: false,
      order: 0,
    })
    expect(await a.db.outbox.count()).toBe(2)
    await a.engine.syncNow()
    expect(await a.db.outbox.count()).toBe(0)
    await b.engine.syncNow()
    expect((await b.db.transactions.get(UUID(1)))?.note).toBe('Migros')
    expect((await b.db.categories.get(UUID(2)))?.name).toBe('Essen')
    expect(b.engine.getStatus().state).toBe('idle')
  })

  it('Offline-Änderungen auf zwei Geräten an verschiedenen Datensätzen führen zusammen', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const a = await device(server, dek, () => 1_000_000)
    const b = await device(server, dek, () => 1_000_500)
    await a.store.put('transactions', tx(UUID(1), 'alt-1'))
    await a.store.put('transactions', tx(UUID(2), 'alt-2'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    server.online = false
    await a.store.put('transactions', tx(UUID(1), 'A ändert 1'))
    await b.store.put('transactions', tx(UUID(2), 'B ändert 2'))
    await a.engine.syncNow()
    expect(a.engine.getStatus().state).toBe('offline')
    expect(await a.db.outbox.count()).toBe(1) // bleibt vorgemerkt
    server.online = true
    for (const d of [a, b, a, b]) await d.engine.syncNow()
    for (const d of [a, b]) {
      expect((await d.db.transactions.get(UUID(1)))?.note).toBe('A ändert 1')
      expect((await d.db.transactions.get(UUID(2)))?.note).toBe('B ändert 2')
    }
  })

  it('bei gleichzeitiger Änderung desselben Datensatzes gewinnt die spätere, auf beiden Geräten', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const a = await device(server, dek, () => 1_000_000)
    const b = await device(server, dek, () => 2_000_000)
    await a.store.put('transactions', tx(UUID(1), 'start'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.store.put('transactions', tx(UUID(1), 'von A'))
    await b.store.put('transactions', tx(UUID(1), 'von B (später)'))
    for (const d of [a, b, a, b]) await d.engine.syncNow()
    expect((await a.db.transactions.get(UUID(1)))?.note).toBe('von B (später)')
    expect((await b.db.transactions.get(UUID(1)))?.note).toBe('von B (später)')
  })

  it('Löschen (Grabstein) kommt auf dem anderen Gerät an', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const a = await device(server, dek)
    const b = await device(server, dek, () => 2_000_000)
    await a.store.put('transactions', tx(UUID(1), 'weg damit'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    await b.store.remove('transactions', UUID(1))
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect((await a.db.transactions.get(UUID(1)))?.deleted).toBe(true)
  })

  it('der Server sieht nur Chiffretext', async () => {
    const server = new FakeServer()
    const a = await device(server, await generateDek())
    await a.store.put('transactions', tx(UUID(1), 'Streng-geheime-Notiz'))
    await a.engine.syncNow()
    const stored = [...server.rows.values()]
      .map((r) => Buffer.from(r.ciphertext, 'base64').toString('latin1'))
      .join('')
    expect(stored).not.toContain('geheime')
    expect(JSON.stringify([...server.rows.values()])).not.toContain('Notiz')
  })

  it('Datensätze mit falschem Schlüssel werden übersprungen, der Rest wird übernommen', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const foreign = await encryptRecord(await generateDek(), UUID(9), {
      table: 'transactions',
      data: { id: UUID(9), updatedAt: '9' },
    })
    await server.push([{ id: UUID(9), hlc: '9', deleted: false, ciphertext: foreign }])
    const a = await device(server, dek)
    await a.store.put('transactions', tx(UUID(1), 'ok'))
    await a.engine.syncNow() // pusht 1
    const b = await device(server, dek)
    await b.engine.syncNow()
    expect(b.engine.getStatus().skipped).toBe(1)
    expect((await b.db.transactions.get(UUID(1)))?.note).toBe('ok')
    expect(await b.db.transactions.get(UUID(9))).toBeUndefined()
  })

  it('Pull läuft seitenweise und holt alles', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const a = await device(server, dek)
    await a.store.putMany(
      'transactions',
      Array.from({ length: 7 }, (_, i) => tx(UUID(i + 1), `n${i}`)),
    )
    await a.engine.syncNow()
    const b = await device(server, dek, undefined, { pageSize: 2 })
    await b.engine.syncNow()
    expect(await b.db.transactions.count()).toBe(7)
  })

  it('mehrfaches Ändern vor dem Sync ergibt einen Upload mit dem neuesten Stand', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const a = await device(server, dek)
    for (const note of ['1', '2', '3']) await a.store.put('transactions', tx(UUID(1), note))
    await a.engine.syncNow()
    expect(server.rows.size).toBe(1)
    const b = await device(server, dek)
    await b.engine.syncNow()
    expect((await b.db.transactions.get(UUID(1)))?.note).toBe('3')
  })

  it('gleichzeitige syncNow-Aufrufe laufen sauber hintereinander', async () => {
    const server = new FakeServer()
    const a = await device(server, await generateDek())
    await a.store.put('transactions', tx(UUID(1), 'x'))
    await Promise.all([a.engine.syncNow(), a.engine.syncNow(), a.engine.syncNow()])
    expect(await a.db.outbox.count()).toBe(0)
    expect(server.rows.size).toBe(1)
  })

  it('Auth-Fehler werden als «neu anmelden» gemeldet', async () => {
    const a = await device(
      {
        push: async () => {
          throw new TransportError('auth', 'JWT expired')
        },
        pull: async () => [],
      },
      await generateDek(),
    )
    await a.store.put('transactions', tx(UUID(1), 'x'))
    await a.engine.syncNow()
    expect(a.engine.getStatus()).toMatchObject({
      state: 'error',
      message: 'Bitte melde dich neu an.',
    })
    expect(await a.db.outbox.count()).toBe(1)
  })
})
