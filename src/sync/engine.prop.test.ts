import 'fake-indexeddb/auto'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { generateDek } from '../crypto/keys'
import { StudiBudgetDB } from '../data/db'
import { createStore } from '../data/store'
import { FakeServer } from '../test/fakeServer'
import { SyncEngine } from './engine'

const UUID = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`

type Op =
  | { kind: 'put'; dev: number; rec: number; name: string }
  | { kind: 'remove'; dev: number; rec: number }
  | { kind: 'sync'; dev: number }
  | { kind: 'clock'; dev: number; delta: number }

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('put' as const),
    dev: fc.nat(2),
    rec: fc.nat(3),
    name: fc.string({ minLength: 1, maxLength: 5 }),
  }),
  fc.record({ kind: fc.constant('remove' as const), dev: fc.nat(2), rec: fc.nat(3) }),
  fc.record({ kind: fc.constant('sync' as const), dev: fc.nat(2) }),
  fc.record({
    kind: fc.constant('clock' as const),
    dev: fc.nat(2),
    delta: fc.integer({ min: -5000, max: 5000 }),
  }),
)

describe('Eigenschaften: Sync mit mehreren Geräten', { tags: ['property'] }, () => {
  it('nach dem Abgleich haben alle Geräte dieselben Daten und eine leere Outbox, egal was vorher geschah', async () => {
    const dek = await generateDek()
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 25 }), async (ops) => {
        const server = new FakeServer()
        const offsets = [0, 0, 0]
        const devices = [0, 1, 2].map((i) => {
          const db = new StudiBudgetDB(`prop-${Math.random()}`)
          const store = createStore(db, () => 1_000_000 + offsets[i])
          return { db, store, engine: new SyncEngine(db, store, server, dek) }
        })
        for (const o of ops) {
          const d = devices[o.dev]
          if (o.kind === 'put')
            await d.store.put('persons', {
              id: UUID(o.rec),
              deleted: false,
              name: o.name,
              active: true,
            })
          else if (o.kind === 'remove') await d.store.remove('persons', UUID(o.rec))
          else if (o.kind === 'sync') await d.engine.syncNow()
          else offsets[o.dev] += o.delta
        }
        for (let round = 0; round < 2; round++) for (const d of devices) await d.engine.syncNow()
        const view = async (db: StudiBudgetDB) =>
          (await db.persons.toArray()).sort((a, b) => a.id.localeCompare(b.id))
        const first = await view(devices[0].db)
        for (const d of devices) {
          expect(await view(d.db)).toEqual(first)
          expect(await d.db.outbox.count()).toBe(0)
          expect(d.engine.getStatus().state).toBe('idle')
        }
      }),
      { numRuns: 25 },
    )
  })
})
