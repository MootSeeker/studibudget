// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Liest die Farb-Tokens aus index.css und prüft die WCAG-Kontraste in beiden Darstellungen. */
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const block = (selector: string): Record<string, string> => {
  const body = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  )
}
const light = block(':root')
const dark = { ...light, ...block(":root\\[data-theme='dark'\\]") }

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Text (WCAG AA, normale Schrift): 4.5:1
const TEXT: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['accent-text', 'accent'],
  ['accent', 'bg'],
  ['accent', 'surface'], // Links
  ['ok', 'bg'],
  ['ok', 'surface'],
  ['warn', 'bg'],
  ['warn', 'surface'],
  ['bad', 'bg'],
  ['bad', 'surface'],
]
// Ränder von Bedienelementen (WCAG 1.4.11): 3:1
const CONTROLS: [string, string][] = [
  ['control', 'bg'],
  ['control', 'surface'],
]

describe.each([
  ['Hellmodus', light],
  ['Dunkelmodus', dark],
])('Kontraste im %s', (_name, tokens) => {
  it('alle Token sind gelesen worden', () => {
    for (const k of [
      'bg',
      'surface',
      'text',
      'muted',
      'border',
      'control',
      'accent',
      'accent-text',
      'ok',
      'warn',
      'bad',
    ])
      expect(tokens[k], k).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it.each(TEXT)('%s auf %s: mindestens 4.5:1', (fg, bg) => {
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5)
  })
  it.each(CONTROLS)('Rand %s auf %s: mindestens 3:1', (fg, bg) => {
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3)
  })
})

describe('Rechenweg', () => {
  it('Schwarz auf Weiss ist 21:1, gleiche Farbe 1:1', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(ratio('#777777', '#777777')).toBeCloseTo(1, 5)
  })
})
