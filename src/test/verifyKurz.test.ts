import { describe, expect, it } from 'vitest'
import {
  bericht,
  exitCode,
  hinzugefuegteZeilen,
  lesePlanBlock,
  planlauf,
  pruefeLeitplanken,
  planpruefung,
  pruefePlan,
  schritteAusVerify,
} from '../../scripts/lib/verify-kurz.mjs'

// verify:kurz (Issue #129): knapper Prüfbericht mit Leitplanken und Abgleich mit dem Plan.
const SZ = 'ß'
const KENNZEICHNUNG = ['Co-Authored', '-By: Claude <x@y>'].join('')

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -3,0 +4,2 @@',
  `+const gross = 'Gru${SZ}'`,
  '+const ok = 1',
  '@@ -10 +12 @@',
  `-const alt = 'Stra${SZ}e'`,
  `+const neu = '${KENNZEICHNUNG}'`,
  'diff --git a/docs/b.md b/docs/b.md',
  '--- a/docs/b.md',
  '+++ b/docs/b.md',
  '@@ -1 +1 @@',
  '-alt',
  '+Generated with [Claude Code](https://claude.com)',
].join('\n')

const PLAN = [
  '## Plan',
  '```plan-dateien',
  'src/a.ts',
  'src/a.test.ts',
  '```',
  '```plan-tests',
  'src/a.test.ts :: AK-1: rundet auf ganze Rappen',
  'src/a.test.ts :: AK-2: lehnt negative Beträge ab',
  '```',
].join('\n')

describe('verify:kurz (#129)', () => {
  it('AK-1: liest die Schritte aus dem Skript verify und hängt test:slow an', () => {
    expect(schritteAusVerify('npm run lint && npm run typecheck && npm run test:coverage')).toEqual(
      ['lint', 'typecheck', 'test:coverage', 'test:slow'],
    )
  })

  it('AK-1: nach dem ersten roten Schritt sind die übrigen «nicht gelaufen»', async () => {
    const gelaufen: string[] = []
    const ergebnisse = await planlauf(['a', 'b', 'c'], async (s) => {
      gelaufen.push(s)
      return { status: s === 'b' ? 'rot' : 'gruen', tests: [], ausgabe: [] }
    })
    expect(gelaufen).toEqual(['a', 'b'])
    expect(ergebnisse.map((e) => e.status)).toEqual(['gruen', 'rot', 'nicht gelaufen'])
  })

  it('AK-2: eine Zeile pro Schritt und Zusatzprüfung, rote Tests mit Datei, Name und erster Meldungszeile', () => {
    const zeilen = bericht({
      schritte: [
        { name: 'lint', status: 'gruen', tests: [], ausgabe: [] },
        {
          name: 'test:coverage',
          status: 'rot',
          tests: [{ datei: 'src/a.test.ts', name: 'rechnet', meldung: 'expected 1' }],
          ausgabe: [],
        },
        { name: 'build', status: 'nicht gelaufen', tests: [], ausgabe: [] },
      ],
      zusatz: [
        { name: 'Leitplanken', status: 'gruen', befunde: [] },
        { name: 'Plan', status: 'uebersprungen', befunde: [] },
      ],
    })
    expect(zeilen.filter((z) => /^(grün|rot|nicht gelaufen|übersprungen)\s/.test(z))).toHaveLength(
      5,
    )
    expect(zeilen.join('\n')).toContain('src/a.test.ts › rechnet: expected 1')
  })

  it('AK-2: höchstens 5 rote Tests, der Rest als «und N weitere»', () => {
    const tests = Array.from({ length: 8 }, (_, i) => ({
      datei: `src/t${i}.test.ts`,
      name: `Test ${i}`,
      meldung: 'Zeile 1\nZeile 2',
    }))
    const text = bericht({
      schritte: [{ name: 'test:coverage', status: 'rot', tests, ausgabe: [] }],
      zusatz: [],
    }).join('\n')
    expect(text.match(/› Test \d/g)).toHaveLength(5)
    expect(text).toContain('und 3 weitere')
    expect(text).not.toContain('Zeile 2')
  })

  it('AK-2: nie mehr als 30 Zeilen, auch bei vielen Befunden', () => {
    const viele = Array.from({ length: 40 }, (_, i) => `src/x${i}.ts:${i}: Befund`)
    const zeilen = bericht({
      schritte: [
        { name: 'lint', status: 'rot', tests: [], ausgabe: viele },
        { name: 'build', status: 'nicht gelaufen', tests: [], ausgabe: [] },
      ],
      zusatz: [
        { name: 'Leitplanken', status: 'rot', befunde: viele },
        { name: 'Plan', status: 'rot', befunde: viele },
      ],
    })
    expect(zeilen.length).toBeLessThanOrEqual(30)
    expect(zeilen[0]).toMatch(/^rot\s+lint/)
  })

  it('AK-3: Exit-Code 1 bei rotem Schritt oder roter Zusatzprüfung, sonst 0', () => {
    const gruen = { name: 's', status: 'gruen' as const, tests: [], ausgabe: [] }
    const rot = { ...gruen, status: 'rot' as const }
    const z = (status: 'gruen' | 'rot' | 'uebersprungen') => ({ name: 'Plan', status, befunde: [] })
    expect(exitCode({ schritte: [gruen], zusatz: [z('gruen'), z('uebersprungen')] })).toBe(0)
    expect(exitCode({ schritte: [rot], zusatz: [z('gruen')] })).toBe(1)
    expect(exitCode({ schritte: [gruen], zusatz: [z('rot')] })).toBe(1)
  })

  it('AK-4: liest nur hinzugefügte Zeilen mit ihrer Zeilennummer', () => {
    const zeilen = hinzugefuegteZeilen(DIFF)
    expect(zeilen.map((z) => `${z.datei}:${z.zeile}`)).toEqual([
      'src/a.ts:4',
      'src/a.ts:5',
      'src/a.ts:12',
      'docs/b.md:1',
    ])
  })

  it('AK-4: findet ß und Claude-Kennzeichnung mit Datei und Zeile, entfernte Zeilen zählen nicht', () => {
    const befunde = pruefeLeitplanken(hinzugefuegteZeilen(DIFF), [])
    expect(befunde).toEqual([
      expect.stringMatching(/^src\/a\.ts:4: ß/),
      expect.stringMatching(/^src\/a\.ts:12: Claude-Kennzeichnung/),
      expect.stringMatching(/^docs\/b\.md:1: Claude-Kennzeichnung/),
    ])
  })

  it('AK-4: neue Dateien zählen ganz, Dateien der Ausnahmeliste nicht', () => {
    const neu = [{ datei: 'src/neu.ts', zeile: 2, text: `Fu${SZ}` }]
    expect(pruefeLeitplanken(neu, [])).toHaveLength(1)
    expect(pruefeLeitplanken(neu, [{ datei: 'src/neu.ts', grund: 'Testdaten' }])).toEqual([])
  })

  it('AK-4: erkennt die Kennzeichnung auch in anderer Schreibweise', () => {
    const zeilen = [
      'co-authored-by: claude opus <noreply@anthropic.com>',
      'Generated with Claude Code',
      'Mail an noreply@anthropic.com',
    ].map((text, i) => ({ datei: 'x.md', zeile: i + 1, text }))
    expect(pruefeLeitplanken(zeilen, [])).toHaveLength(3)
    expect(
      pruefeLeitplanken([{ datei: 'x.md', zeile: 1, text: 'Co-Authored-By: Kevin' }], []),
    ).toEqual([])
  })

  it('AK-5: liest Dateiliste und geplante Tests aus dem Block', () => {
    expect(lesePlanBlock(PLAN)).toEqual({
      dateien: ['src/a.ts', 'src/a.test.ts'],
      tests: [
        { datei: 'src/a.test.ts', name: 'AK-1: rundet auf ganze Rappen' },
        { datei: 'src/a.test.ts', name: 'AK-2: lehnt negative Beträge ab' },
      ],
    })
  })

  it('AK-5: Datei ausserhalb der Dateiliste ist rot, CHANGELOG.md und vault/ nicht', () => {
    const inhalt = () =>
      "it('AK-1: rundet auf ganze Rappen')\nit('AK-2: lehnt negative Beträge ab')"
    const befunde = pruefePlan(
      lesePlanBlock(PLAN)!,
      ['src/a.ts', 'src/b.ts', 'CHANGELOG.md', 'vault/60 Journal/2026-10-08.md'],
      inhalt,
    )
    expect(befunde).toEqual([expect.stringMatching(/^src\/b\.ts: nicht in der Dateiliste/)])
  })

  it('AK-6: geplanter Test, dessen Name in der Datei fehlt, ist rot mit Datei und Name', () => {
    const befunde = pruefePlan(
      lesePlanBlock(PLAN)!,
      ['src/a.ts'],
      () => "it('AK-1: rundet auf ganze Rappen')",
    )
    expect(befunde).toEqual([
      'src/a.test.ts: geplanter Test fehlt: AK-2: lehnt negative Beträge ab',
    ])
  })

  it('AK-6: fehlt die Testdatei ganz, sind alle ihre Tests rot', () => {
    expect(pruefePlan(lesePlanBlock(PLAN)!, [], () => null)).toHaveLength(2)
  })

  it('AK-7: ohne --plan ist «Plan» übersprungen', () => {
    expect(planpruefung(undefined, ['src/x.ts'], () => null)).toEqual({
      name: 'Plan',
      status: 'uebersprungen',
      befunde: [],
    })
  })

  it('AK-7: ein Plan ohne Block ist rot', () => {
    const ergebnis = planpruefung('## Plan\nnur Text', [], () => null)
    expect(ergebnis.status).toBe('rot')
    expect(ergebnis.befunde[0]).toMatch(/kein Block «plan-dateien»/)
  })

  it('AK-7: ein Block ohne Tests ist gültig', () => {
    expect(lesePlanBlock('```plan-dateien\nsrc/a.ts\n```')).toEqual({
      dateien: ['src/a.ts'],
      tests: [],
    })
    expect(planpruefung('```plan-dateien\nsrc/a.ts\n```', ['src/a.ts'], () => null).status).toBe(
      'gruen',
    )
  })
})
