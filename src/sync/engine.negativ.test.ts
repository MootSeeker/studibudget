import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateDek } from '../crypto/keys'
import { encryptRecord } from '../crypto/records'
import { StudiBudgetDB } from '../data/db'
import { createStore, type Store } from '../data/store'
import type { Person } from '../domain/types'
import { FakeServer } from '../test/fakeServer'
import { SyncEngine } from './engine'
import { format } from './hlc'
import type { PullRow } from './transport'

const UUID = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
let n = 0
async function device(server: FakeServer, dek: CryptoKey, opts = {}) {
  const db = new StudiBudgetDB(`engneg-${++n}-${Math.random()}`)
  const store = createStore(db, () => 1_000_000)
  return { db, store, engine: new SyncEngine(db, store, server, dek, opts) }
}
const person = (i: number, name = `P${i}`): Omit<Person, 'updatedAt'> => ({
  id: UUID(i),
  deleted: false,
  name,
  active: true,
})
/** Eine Zeile, wie sie der Server liefern würde, mit frei wählbarer Verpackung. */
async function serverRow(
  dek: CryptoKey,
  seq: number,
  id: string,
  rec: { table: string; data: unknown },
  aadId = id,
): Promise<PullRow> {
  return {
    id,
    seq,
    hlc: format({ wall: 5_000_000 + seq, counter: 0 }, 'srv00000'),
    deleted: false,
    ciphertext: await encryptRecord(dek, aadId, rec),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Sync-Fehlerpfade', { tags: ['negativ'] }, () => {
  it('ein Serverfehler («other») setzt den Zustand auf Fehler und behält die Outbox', async () => {
    const server = new FakeServer()
    server.failPushCall = 1
    const a = await device(server, await generateDek())
    await a.store.put('persons', person(1))
    await a.engine.syncNow()
    expect(a.engine.getStatus()).toMatchObject({ state: 'error', message: 'Serverfehler 500' })
    expect(await a.db.outbox.count()).toBe(1)
  })

  it('scheitert der zweite Upload-Block, bleibt die ganze Outbox und der nächste Abgleich holt alles nach', async () => {
    const server = new FakeServer()
    server.failPushCall = 2
    const a = await device(server, await generateDek(), { pushBatch: 2 })
    for (let i = 1; i <= 5; i++) await a.store.put('persons', person(i))
    await a.engine.syncNow()
    expect(a.engine.getStatus().state).toBe('error')
    expect(await a.db.outbox.count()).toBe(5)
    await a.engine.syncNow()
    expect(a.engine.getStatus().state).toBe('idle')
    expect(await a.db.outbox.count()).toBe(0)
    expect(server.rows.size).toBe(5)
  })

  it('scheitert das Holen nach erfolgreichem Hochladen, sind die Änderungen trotzdem oben und der Fehler wird gemeldet', async () => {
    const server = new FakeServer()
    server.failPullCall = { n: 1, kind: 'other' }
    const a = await device(server, await generateDek())
    await a.store.put('persons', person(1))
    await a.engine.syncNow()
    expect(a.engine.getStatus().state).toBe('error')
    expect(server.rows.size).toBe(1)
    expect(await a.db.outbox.count()).toBe(0)
  })

  it('ein Anmeldefehler vom Server fordert zur neuen Anmeldung auf', async () => {
    const server = new FakeServer()
    server.failPullCall = { n: 1, kind: 'auth' }
    const a = await device(server, await generateDek())
    await a.engine.syncNow()
    expect(a.engine.getStatus()).toMatchObject({
      state: 'error',
      message: 'Bitte melde dich neu an.',
    })
  })

  it('ohne Netz (navigator.onLine false) wird der Server gar nicht gefragt', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const server = new FakeServer()
    const a = await device(server, await generateDek())
    await a.store.put('persons', person(1))
    await a.engine.syncNow()
    expect(a.engine.getStatus().state).toBe('offline')
    expect(server.pushCalls + server.pullCalls).toBe(0)
    expect(await a.db.outbox.count()).toBe(1)
  })

  it('ungültige Server-Zeilen werden übersprungen und gezählt, gültige trotzdem übernommen', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const other = await generateDek()
    const ok = person(1, 'gültig')
    const rows = [
      // falscher Schlüssel
      await serverRow(other, 1, UUID(10), {
        table: 'persons',
        data: { ...person(10), updatedAt: 'x' },
      }),
      // Verpackung an eine andere ID gebunden (AAD)
      await serverRow(
        dek,
        2,
        UUID(11),
        { table: 'persons', data: { ...person(11), updatedAt: 'x' } },
        UUID(99),
      ),
      // unbekannte Tabelle und Tabellen, die nie synchronisiert werden
      await serverRow(dek, 3, UUID(12), {
        table: 'keystore',
        data: { ...person(12), updatedAt: 'x' },
      }),
      await serverRow(dek, 4, UUID(13), {
        table: '__proto__',
        data: { ...person(13), updatedAt: 'x' },
      }),
      // ID im Inhalt passt nicht zur Zeilen-ID
      await serverRow(dek, 5, UUID(14), {
        table: 'persons',
        data: { ...person(15), updatedAt: 'x' },
      }),
      // Stempel fehlt
      await serverRow(dek, 6, UUID(16), { table: 'persons', data: person(16) }),
      // Chiffretext leer und kein Base64
      { ...(await serverRow(dek, 7, UUID(17), { table: 'persons', data: {} })), ciphertext: '' },
      { ...(await serverRow(dek, 8, UUID(18), { table: 'persons', data: {} })), ciphertext: '!!!' },
      await serverRow(dek, 9, ok.id, {
        table: 'persons',
        data: { ...ok, updatedAt: format({ wall: 9_000_000, counter: 0 }, 'srv00000') },
      }),
    ]
    for (const r of rows) server.rows.set(r.id, r)
    server.seq = 9
    const a = await device(server, dek)
    await a.engine.syncNow()
    expect(a.engine.getStatus()).toMatchObject({ state: 'idle', skipped: 8 })
    expect((await a.db.persons.toArray()).map((p) => p.name)).toEqual(['gültig'])
  })

  it('bei gleichem Stempel bleibt die lokale Version', async () => {
    const server = new FakeServer()
    const dek = await generateDek()
    const a = await device(server, dek)
    await a.store.put('persons', person(1, 'lokal'))
    const local = (await a.db.persons.get(UUID(1)))!
    await a.engine.syncNow()
    server.rows.set(UUID(1), {
      ...(await serverRow(dek, ++server.seq, UUID(1), {
        table: 'persons',
        data: { ...local, name: 'fremd' },
      })),
      hlc: local.updatedAt,
    })
    await a.engine.syncNow()
    expect((await a.db.persons.get(UUID(1)))?.name).toBe('lokal')
  })

  it(
    'ein Server, der nie neue Zeilen liefert, führt zu einem Fehler statt einer Endlosschleife (Regression #46)',
    { tags: ['regression'] },
    async () => {
      const server = new FakeServer()
      server.ignoreAfterSeq = true
      const dek = await generateDek()
      for (let i = 1; i <= 2; i++) {
        const r = await serverRow(dek, i, UUID(i), {
          table: 'persons',
          data: {
            ...person(i),
            updatedAt: format({ wall: 5_000_000 + i, counter: 0 }, 'srv00000'),
          },
        })
        server.rows.set(r.id, r)
      }
      server.seq = 2
      const a = await device(server, dek, { pageSize: 2 })
      await a.engine.syncNow()
      expect(a.engine.getStatus().state).toBe('error')
      expect(server.pullCalls).toBeLessThanOrEqual(3)
    },
  )
})

describe('Automatische Auslöser', { tags: ['negativ'] }, () => {
  function setup() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const handlers: (() => void)[] = []
    const store = {
      onChange: (cb: () => void) => (
        handlers.push(cb),
        () => handlers.splice(handlers.indexOf(cb), 1)
      ),
    } as unknown as Store
    const engine = new SyncEngine({} as StudiBudgetDB, store, new FakeServer(), {} as CryptoKey, {
      debounceMs: 2000,
      intervalMs: 60_000,
    })
    const sync = vi.spyOn(engine, 'syncNow').mockResolvedValue()
    const visibility = (v: 'visible' | 'hidden') =>
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
    visibility('visible')
    return { engine, sync, change: () => handlers.forEach((h) => h()), visibility }
  }
  afterEach(() => vi.useRealTimers())

  it('startet sofort, fasst Änderungen nach 2 s zu einem Abgleich zusammen', () => {
    const { engine, sync, change } = setup()
    engine.start()
    expect(sync).toHaveBeenCalledTimes(1)
    change()
    vi.advanceTimersByTime(1000)
    change()
    vi.advanceTimersByTime(1999)
    expect(sync).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(sync).toHaveBeenCalledTimes(2)
    engine.stop()
  })
  it('reagiert auf «online» und auf Sichtbarwerden, nicht auf Verstecken', () => {
    const { engine, sync, visibility } = setup()
    engine.start()
    window.dispatchEvent(new Event('online'))
    expect(sync).toHaveBeenCalledTimes(2)
    visibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(sync).toHaveBeenCalledTimes(2)
    visibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(sync).toHaveBeenCalledTimes(3)
    engine.stop()
  })
  it('das Intervall gleicht nur ab, solange die Seite sichtbar ist', () => {
    const { engine, sync, visibility } = setup()
    engine.start()
    vi.advanceTimersByTime(60_000)
    expect(sync).toHaveBeenCalledTimes(2)
    visibility('hidden')
    vi.advanceTimersByTime(120_000)
    expect(sync).toHaveBeenCalledTimes(2)
    engine.stop()
  })
  it('nach stop() löst nichts mehr aus, auch kein bereits geplanter Abgleich', () => {
    const { engine, sync, change } = setup()
    engine.start()
    change()
    engine.stop()
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(300_000)
    expect(sync).toHaveBeenCalledTimes(1)
  })
})
