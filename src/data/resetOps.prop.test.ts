import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { RESET_KINDS } from '../domain/reset'
import { backupOk, live, seed } from '../test/resetSeed'
import { db } from './db'
import { createResetOps } from './resetOps'
import { store } from './store'

const ops = createResetOps(db, store)

describe('Eigenschaften: Daten zurücksetzen (Issue #30)', { tags: ['property'] }, () => {
  it('jede Auswahl hinterlässt Daten, die die Backup-Prüfung bestehen', async () => {
    await fc.assert(
      fc.asyncProperty(fc.subarray(RESET_KINDS.map((k) => k.kind)), async (selected) => {
        await seed()
        await ops.reset(selected)
        expect(await backupOk()).toBe(true)
        for (const kind of selected) expect(await live(kind)).toHaveLength(0)
        if (selected.includes('accounts')) expect(await live('accountBalances')).toHaveLength(0)
      }),
      { numRuns: 25 },
    )
  })
})
