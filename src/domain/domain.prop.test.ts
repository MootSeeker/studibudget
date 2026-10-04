import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { MAX_AMOUNT_CENTS } from './entry'
import { formatMoney, parseAmount } from './money'
import { addMonths, daysInMonth, monthRange } from './period'
import { rescaleShared, splitByPercent, splitByWeights, splitEqual } from './split'
import { detectInterval, INTERVALS, monthsForInterval } from './templates'

const cents = fc.integer({ min: -MAX_AMOUNT_CENTS, max: MAX_AMOUNT_CENTS })
const total = fc.integer({ min: 0, max: MAX_AMOUNT_CENTS })
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const month = fc
  .tuple(fc.integer({ min: 1990, max: 2090 }), fc.integer({ min: 1, max: 12 }))
  .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`)

describe('Eigenschaften: Beträge', { tags: ['property'] }, () => {
  it('parseAmount(formatMoney(c)) ergibt wieder c, für beide Länder', () => {
    fc.assert(
      fc.property(cents, fc.constantFrom('CH', 'DE' as const), (c, country) => {
        expect(parseAmount(formatMoney(c, country as 'CH' | 'DE'))).toBe(c)
      }),
    )
  })
  it('parseAmount wirft nie und liefert null oder eine ganze Zahl', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        const r = parseAmount(s)
        expect(r === null || Number.isSafeInteger(r)).toBe(true)
      }),
    )
  })
})

describe('Eigenschaften: Teilen', { tags: ['property'] }, () => {
  it('splitEqual: Summe stimmt, Teile unterscheiden sich um höchstens 1', () => {
    fc.assert(
      fc.property(total, fc.integer({ min: 1, max: 20 }), (t, n) => {
        const parts = splitEqual(t, n)
        expect(parts).toHaveLength(n)
        expect(sum(parts)).toBe(t)
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
      }),
    )
  })
  it('splitByPercent: Summe stimmt immer genau', () => {
    fc.assert(
      fc.property(total, fc.integer({ min: 0, max: 100 }), (t, p) => {
        expect(sum(splitByPercent(t, [p, 100 - p]))).toBe(t)
      }),
    )
  })
  it('splitByWeights: Summe stimmt, jedes Teil liegt höchstens 1 neben dem genauen Anteil', () => {
    fc.assert(
      fc.property(
        total,
        fc.array(fc.integer({ min: 0, max: 100_000 }), { minLength: 1, maxLength: 12 }),
        (t, w) => {
          const parts = splitByWeights(t, w)
          expect(sum(parts)).toBe(t)
          const s = sum(w)
          if (s > 0)
            parts.forEach((p, i) => expect(Math.abs(p - (t * w[i]) / s)).toBeLessThan(1 + 1e-6))
          if (s > 0) w.forEach((x, i) => x === 0 && expect(parts[i]).toBe(0))
        },
      ),
    )
  })
  it('rescaleShared: Summe stimmt, auf denselben Betrag angewendet ändert sich nichts', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 8 }),
        total,
        (c, t) => {
          const shared = { paidBy: 'me', parts: c.map((x, i) => ({ who: `p${i}`, cents: x })) }
          const scaled = rescaleShared(shared, t)
          expect(sum(scaled.parts.map((p) => p.cents))).toBe(t)
          expect(rescaleShared(shared, sum(c))).toEqual(shared)
        },
      ),
    )
  })
})

describe('Eigenschaften: Zeit', { tags: ['property'] }, () => {
  it('addMonths ist umkehrbar und zerlegbar', () => {
    fc.assert(
      fc.property(
        month,
        fc.integer({ min: -600, max: 600 }),
        fc.integer({ min: -600, max: 600 }),
        (m, a, b) => {
          expect(addMonths(addMonths(m, a), -a)).toBe(m)
          expect(addMonths(addMonths(m, a), b)).toBe(addMonths(m, a + b))
        },
      ),
    )
  })
  it('monthRange ist aufsteigend, lückenlos und hat die erwartete Länge', () => {
    fc.assert(
      fc.property(month, fc.integer({ min: 0, max: 60 }), (m, n) => {
        const r = monthRange(m, addMonths(m, n))
        expect(r).toHaveLength(n + 1)
        r.forEach((x, i) => expect(x).toBe(addMonths(m, i)))
      }),
    )
  })
  it('daysInMonth liegt zwischen 28 und 31', () => {
    fc.assert(
      fc.property(month, (m) => {
        expect([28, 29, 30, 31]).toContain(daysInMonth(m))
      }),
    )
  })
})

describe('Eigenschaften: Vorlagen-Intervalle', { tags: ['property'] }, () => {
  it('monthsForInterval enthält den Startmonat und erkennt sich über detectInterval wieder', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INTERVALS.map((i) => i.every)),
        fc.integer({ min: 1, max: 12 }),
        (every, start) => {
          const months = monthsForInterval(every, start)
          expect(months).toContain(start)
          expect(months.every((m) => m >= 1 && m <= 12)).toBe(true)
          const found = detectInterval(months)
          expect(found).not.toBeNull()
          expect(monthsForInterval(found!.every, found!.startMonth)).toEqual(months)
        },
      ),
    )
  })
})
