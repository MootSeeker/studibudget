// Hebt die Coverage-Untergrenzen in scripts/coverage-areas.json auf den gemessenen Wert (abgerundet, minus 1 Punkt Puffer), senkt sie nie.
// Aufruf: npm run coverage:ratchet   (misst zuerst) oder `node scripts/coverage-ratchet.mjs --check` (nur anzeigen, was möglich wäre).
import { readFileSync, writeFileSync } from 'node:fs'
import { matchesGlob, relative } from 'node:path'

// V8 misst Zweige von Lauf zu Lauf minimal unterschiedlich; 1 Prozentpunkt Puffer verhindert zufällig rote Läufe.
const PUFFER = 1

export const METRICS = ['lines', 'statements', 'functions', 'branches']

/** Prozentwerte pro Bereich aus reports/coverage/coverage-summary.json. */
export function measure(areas, summaryPath = 'reports/coverage/coverage-summary.json') {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  const files = Object.entries(summary)
    .filter(([k]) => k !== 'total')
    .map(([k, v]) => [relative(process.cwd(), k), v])
  return areas.map((a) => {
    const mine = files.filter(([f]) => matchesGlob(f, a.glob))
    const pct = {}
    for (const m of METRICS) {
      const total = mine.reduce((s, [, v]) => s + v[m].total, 0)
      const covered = mine.reduce((s, [, v]) => s + v[m].covered, 0)
      pct[m] = total === 0 ? 100 : (covered / total) * 100
    }
    return { ...a, pct, files: mine.length }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = new URL('./coverage-areas.json', import.meta.url)
  const config = JSON.parse(readFileSync(path, 'utf8'))
  const check = process.argv.includes('--check')
  const measured = measure(config.bereiche)
  let changed = false
  for (const a of config.bereiche) {
    const m = measured.find((x) => x.name === a.name)
    a.schwelle ??= {}
    for (const metric of METRICS) {
      const next = Math.max(0, Math.floor(m.pct[metric]) - PUFFER)
      if (next > (a.schwelle[metric] ?? -1)) {
        console.log(`${a.name} ${metric}: ${a.schwelle[metric] ?? '–'} → ${next}`)
        a.schwelle[metric] = next
        changed = true
      }
    }
  }
  if (!changed) console.log('Keine Untergrenze kann angehoben werden.')
  else if (!check) {
    writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
    console.log('scripts/coverage-areas.json aktualisiert. Prüfen und committen.')
  } else console.log('(--check: nichts geschrieben)')
}
