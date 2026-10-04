// @vitest-environment node
import fc from 'fast-check'
import { beforeAll, describe, expect, it } from 'vitest'
import { open, seal } from './box'
import { fromB64, fromBase32, toB64, toBase32 } from './encoding'
import { generateDek } from './keys'
import { decryptRecord, encryptRecord } from './records'

let key: CryptoKey
beforeAll(async () => {
  key = await generateDek()
})
const bytes = fc.uint8Array({ maxLength: 200 })

describe('Eigenschaften: Kodierung und Verschlüsselung', { tags: ['property'] }, () => {
  it('Base64 und Base32 hin und zurück', () => {
    fc.assert(
      fc.property(bytes, (b) => {
        expect(fromB64(toB64(b))).toEqual(b)
        expect(fromBase32(toBase32(b)).slice(0, b.length)).toEqual(b)
        expect(toBase32(b)).toMatch(/^[A-Z2-7]*$/)
      }),
    )
  })
  it('Base32 lehnt jedes Zeichen ausserhalb des Alphabets ab', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => /[^A-Z2-7]/.test(s)),
        (s) => {
          expect(() => fromBase32(s)).toThrow()
        },
      ),
    )
  })
  it('seal und open: Rundlauf; falsche AAD wird abgelehnt', async () => {
    await fc.assert(
      fc.asyncProperty(bytes, fc.string({ maxLength: 20 }), async (b, aad) => {
        expect(await open(key, await seal(key, b, aad), aad)).toEqual(b)
        await expect(open(key, await seal(key, b, aad), aad + 'x')).rejects.toThrow()
      }),
      { numRuns: 30 },
    )
  })
  it('ein einzelnes verändertes Bit irgendwo wird erkannt', async () => {
    await fc.assert(
      fc.asyncProperty(bytes, fc.nat(), async (b, pos) => {
        const raw = fromB64(await seal(key, b))
        const bit = pos % (raw.length * 8)
        raw[Math.floor(bit / 8)] ^= 1 << (bit % 8)
        await expect(open(key, toB64(raw))).rejects.toThrow()
      }),
      { numRuns: 30 },
    )
  })
  it('Datensätze: Rundlauf über JSON', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.json(), async (id, json) => {
        const data = JSON.parse(json)
        const back = await decryptRecord(
          key,
          id,
          await encryptRecord(key, id, { table: 't', data }),
        )
        expect(JSON.stringify(back.data)).toBe(JSON.stringify(data))
      }),
      { numRuns: 30 },
    )
  })
})
