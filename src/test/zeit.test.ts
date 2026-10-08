import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findeZeitstellen, pruefeRepo, pruefeZeit } from '../../scripts/lib/zeit.mjs'

// Zeitfehler-Wächter (Issue #111): Tests dürfen die echte Uhr nicht ungeschützt lesen.
describe('Zeitfehler-Wächter', () => {
  it('AK-2: findet new Date() und Date.now() mit Zeilennummer', () => {
    const text = [
      'const a = 1',
      'const b = new Date()',
      'const c = Date.now() - 5',
      '// new Date()',
    ].join('\n')
    expect(findeZeitstellen(text).map((s) => s.zeile)).toEqual([2, 3])
  })

  it('AK-2: erkennt auch Schreibweisen mit Leerzeichen', () => {
    expect(findeZeitstellen('new Date ()\nDate.now ( )\nDate . now()')).toHaveLength(3)
    expect(findeZeitstellen('new  Date()\nnew\tDate()')).toHaveLength(2)
  })

  it('AK-2: erkennt auch new Date ohne Klammern und Date.now ohne Aufruf', () => {
    expect(
      findeZeitstellen('const a = new Date;\nconst b = Date.now\nsetTimeout(Date.now, 1)'),
    ).toHaveLength(3)
  })

  it('AK-2: new Date("2026-01-01") und Date.UTC sind erlaubt (feste Zeit)', () => {
    expect(findeZeitstellen("new Date('2026-01-01')\nDate.UTC(2026, 0, 1)\nnew Date(0)")).toEqual(
      [],
    )
  })

  it('AK-2: meldet Datei und Zeile', () => {
    const p = pruefeZeit([{ pfad: 'src/x.test.ts', text: 'a\nnew Date()' }], [])
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('src/x.test.ts:2')
  })

  it('AK-2: eine feste Uhr in der Datei (setSystemTime) macht die Datei zulässig', () => {
    const text = "vi.setSystemTime(new Date('2026-10-08'))\nconst jetzt = new Date()"
    expect(pruefeZeit([{ pfad: 'src/x.test.ts', text }], [])).toEqual([])
  })

  it('AK-2: die feste Uhr gilt je Test: ein anderer Test derselben Datei ohne feste Uhr wird gemeldet', () => {
    const text = [
      "it('fest', () => {",
      "  vi.setSystemTime(new Date('2026-10-08'))",
      '  const a = new Date()',
      '})',
      "it('ungeschützt', () => {",
      '  const b = new Date()',
      '})',
    ].join('\n')
    const p = pruefeZeit([{ pfad: 'src/x.test.ts', text }], [])
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('src/x.test.ts:6')
  })

  it('AK-2: eine feste Uhr in beforeEach oder vor dem ersten Test gilt für die ganze Datei', () => {
    const vorher = "vi.setSystemTime(new Date('2026-10-08'))\nit('a', () => {\n  new Date()\n})"
    const inBeforeEach = [
      'beforeEach(() => {',
      "  vi.setSystemTime(new Date('2026-10-08'))",
      '})',
      "it('a', () => {",
      '  new Date()',
      '})',
    ].join('\n')
    expect(pruefeZeit([{ pfad: 'src/a.test.ts', text: vorher }], [])).toEqual([])
    expect(pruefeZeit([{ pfad: 'src/b.test.ts', text: inBeforeEach }], [])).toEqual([])
  })

  it('AK-2: eine begründete Ausnahme ist zulässig, eine ohne Begründung ein Fehler', () => {
    const datei = [{ pfad: 'src/x.db.test.ts', text: 'const run = Date.now()' }]
    expect(pruefeZeit(datei, [{ datei: 'src/x.db.test.ts', grund: 'Laufkennung' }])).toEqual([])
    expect(pruefeZeit(datei, [{ datei: 'src/x.db.test.ts', grund: '  ' }]).join(' ')).toMatch(
      /Begründung/,
    )
  })

  it('AK-2: eine Ausnahme ohne Treffer ist überflüssig und wird gemeldet', () => {
    const p = pruefeZeit(
      [{ pfad: 'src/y.test.ts', text: 'const x = 1' }],
      [{ datei: 'src/y.test.ts', grund: 'alt' }],
    )
    expect(p.join(' ')).toMatch(/nicht mehr nötig/)
  })

  it('AK-2: alle Testdateien des Repos sind sauber', () => {
    const ausnahmen = JSON.parse(readFileSync('scripts/zeit-ausnahmen.json', 'utf8')) as {
      datei: string
      grund: string
    }[]
    expect(pruefeRepo('.', ausnahmen)).toEqual([])
    for (const a of ausnahmen) expect(a.grund.trim().length).toBeGreaterThan(10)
  })
})
