import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { format, parse, receive, tick, type ClockState } from './hlc'

const clock = fc.record({
  wall: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  counter: fc.integer({ min: 0, max: 0xffff }),
})
const now = fc.integer({ min: 0, max: 4_000_000_000_000 })
const dev = fc.constant('aaaa0000')

describe('Eigenschaften: HLC', { tags: ['property'] }, () => {
  it('format und parse sind umkehrbar', () => {
    fc.assert(
      fc.property(clock, dev, (s, d) => {
        expect(parse(format(s, d))).toEqual(s)
      }),
    )
  })
  it('die Textordnung der Stempel entspricht der Ordnung (Uhr, Zähler)', () => {
    fc.assert(
      fc.property(clock, clock, (a, b) => {
        const order = a.wall - b.wall || a.counter - b.counter
        const text =
          format(a, 'aaaa0000') < format(b, 'aaaa0000')
            ? -1
            : format(a, 'aaaa0000') > format(b, 'aaaa0000')
              ? 1
              : 0
        expect(Math.sign(order)).toBe(text)
      }),
    )
  })
  it(
    'jeder neue Stempel ist als Text strikt grösser als der vorige, egal wie die Systemzeit springt (Regression #55)',
    { tags: ['regression'] },
    () => {
      fc.assert(
        fc.property(clock, fc.array(now, { minLength: 1, maxLength: 30 }), (start, times) => {
          let s: ClockState = start
          let last = format(s, 'aaaa0000')
          for (const t of times) {
            s = tick(s, t)
            const next = format(s, 'aaaa0000')
            expect(next > last).toBe(true)
            last = next
          }
        }),
      )
    },
  )
  it(
    'viele Stempel in derselben Millisekunde bleiben sortiert (Regression #55)',
    { tags: ['regression'] },
    () => {
      let s: ClockState = { wall: 1000, counter: 0xfffd }
      let last = format(s, 'aaaa0000')
      for (let i = 0; i < 10; i++) {
        s = tick(s, 1000)
        const next = format(s, 'aaaa0000')
        expect(next > last).toBe(true)
        last = next
      }
    },
  )
  it('nach dem Empfang eines fremden Stempels ist der nächste eigene grösser', () => {
    fc.assert(
      fc.property(clock, clock, now, (mine, theirs, t) => {
        const remote = format(theirs, 'bbbb0000')
        const next = format(tick(receive(mine, remote), t), 'aaaa0000')
        expect(next > remote).toBe(true)
      }),
    )
  })
})
