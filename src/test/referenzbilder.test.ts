import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ersetzeOrdner, waehleLauf } from '../../scripts/lib/referenzbilder.mjs'

// Referenzbilder per Befehl übernehmen (Issue #111, AK-4)
const lauf = (id: number, headSha: string, conclusion = 'success') => ({
  databaseId: id,
  headSha,
  conclusion,
  createdAt: '2026-10-08T10:00:00Z',
})

describe('waehleLauf', () => {
  it('AK-4: nimmt den neuesten erfolgreichen Lauf zum aktuellen Stand', () => {
    const runs = [lauf(3, 'bbb'), lauf(2, 'aaa'), lauf(1, 'aaa')]
    expect(waehleLauf(runs, 'aaa')).toEqual({ run: runs[1], veraltet: false })
  })
  it('AK-4: überspringt fehlgeschlagene und abgebrochene Läufe', () => {
    const runs = [lauf(3, 'aaa', 'failure'), lauf(2, 'aaa', 'cancelled'), lauf(1, 'aaa')]
    expect(waehleLauf(runs, 'aaa')?.run.databaseId).toBe(1)
  })
  it('AK-4: gehört der Lauf nicht zum aktuellen Stand, wird er als veraltet gemeldet', () => {
    const runs = [lauf(2, 'alt')]
    expect(waehleLauf(runs, 'neu')).toEqual({ run: runs[0], veraltet: true })
  })
  it('AK-4: ohne erfolgreichen Lauf gibt es nichts zu übernehmen', () => {
    expect(waehleLauf([lauf(1, 'aaa', 'failure')], 'aaa')).toBeNull()
    expect(waehleLauf([], 'aaa')).toBeNull()
  })
})

describe('ersetzeOrdner', () => {
  it('AK-4: ersetzt den Inhalt von e2e/referenz vollständig, auch entfernte Bilder', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'ref-'))
    const quelle = join(wurzel, 'neu')
    const ziel = join(wurzel, 'referenz')
    mkdirSync(quelle)
    mkdirSync(ziel)
    writeFileSync(join(quelle, 'a.png'), 'neu')
    writeFileSync(join(ziel, 'a.png'), 'alt')
    writeFileSync(join(ziel, 'weg.png'), 'alt')
    ersetzeOrdner(quelle, ziel)
    expect(readFileSync(join(ziel, 'a.png'), 'utf8')).toBe('neu')
    expect(existsSync(join(ziel, 'weg.png'))).toBe(false)
  })
  it('AK-4: ein leerer oder fehlender Quellordner ersetzt nichts', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'ref-'))
    const ziel = join(wurzel, 'referenz')
    mkdirSync(ziel)
    writeFileSync(join(ziel, 'a.png'), 'alt')
    expect(() => ersetzeOrdner(join(wurzel, 'gibt-es-nicht'), ziel)).toThrow()
    mkdirSync(join(wurzel, 'leer'))
    expect(() => ersetzeOrdner(join(wurzel, 'leer'), ziel)).toThrow(/keine Bilder/)
    expect(readFileSync(join(ziel, 'a.png'), 'utf8')).toBe('alt')
  })
})
