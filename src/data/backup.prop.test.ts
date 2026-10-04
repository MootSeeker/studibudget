// @vitest-environment node
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'

describe('Eigenschaften: Backup-Leser', { tags: ['property', 'negativ'] }, () => {
  it('beliebiger Text bringt parseBackup nie zum Absturz', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (s) => {
        expect(() => parseBackup(s)).not.toThrow()
      }),
    )
  })
  it('beliebiges JSON wird abgelehnt oder ist ein vollständiges Backup, nie ein Absturz', () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const r = parseBackup(JSON.stringify(v) ?? 'null')
        expect(r.ok).toBe(false)
      }),
    )
  })
  it('ein Backup-Kopf mit beliebigem Rest wird abgelehnt', () => {
    fc.assert(
      fc.property(fc.anything(), (data) => {
        const r = parseBackup(
          JSON.stringify({ app: 'studibudget', schemaVersion: 1, exportedAt: 'x', data }),
        )
        expect(r.ok).toBe(false)
      }),
    )
  })
})
