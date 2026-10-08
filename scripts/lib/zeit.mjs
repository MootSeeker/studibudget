// Zeitfehler-Wächter (Issue #111): Tests dürfen die echte Uhr nicht ungeschützt lesen. Reine Hilfen, aufgerufen von
// scripts/check-zeit.mjs und getestet in src/test/zeit.test.ts.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Echte Uhr: `new Date` ohne Argument (mit oder ohne Klammern) und jede Erwähnung von `Date.now` (auch als Referenz).
const ECHTE_UHR = /\bnew\s+Date\b(?!\s*\(\s*[^\s)])|\bDate\s*\.\s*now\b/
const FESTE_UHR = /\bsetSystemTime\b/

/** Zeilen (ab 1) mit Zugriff auf die echte Uhr; Kommentarzeilen zählen nicht. */
export function findeZeitstellen(text) {
  return text
    .split('\n')
    .map((zeile, i) => ({ zeile: i + 1, text: zeile }))
    .filter((z) => !z.text.trim().startsWith('//') && ECHTE_UHR.test(z.text))
}

/** Beginn eines Tests (`it(`, `test(` auch mit `.only`/`.each`-Zusätzen). */
const TEST_BEGINN = /^\s*(it|test)\b/

/**
 * Stellen ohne feste Uhr: Eine feste Uhr gilt für den Test, in dem sie steht (zwischen Testbeginn und Treffer), oder für
 * die ganze Datei, wenn sie vor dem ersten Test steht oder in einem `beforeEach`/`beforeAll` gesetzt wird.
 */
function ungeschuetzt(text) {
  const zeilen = text.split('\n')
  const ersterTest = zeilen.findIndex((z) => TEST_BEGINN.test(z))
  const dateiweit =
    zeilen.some((z, i) => FESTE_UHR.test(z) && (ersterTest === -1 || i < ersterTest)) ||
    zeilen.some(
      (z, i) =>
        FESTE_UHR.test(z) &&
        /^\s*before(Each|All)\b/.test(zeilen.slice(Math.max(0, i - 3), i + 1).join('\n')),
    )
  if (dateiweit) return []
  return findeZeitstellen(text).filter((s) => {
    let beginn = s.zeile - 1
    while (beginn > 0 && !TEST_BEGINN.test(zeilen[beginn])) beginn--
    return !zeilen.slice(beginn, s.zeile).some((z) => FESTE_UHR.test(z))
  })
}

/**
 * Prüft Dateien `{ pfad, text }` gegen die Ausnahmen `{ datei, grund }`; liefert die Verstösse als Sätze.
 * Eine Datei mit `setSystemTime` gilt als fest (je Test; dateiweit nur vor dem ersten Test oder in beforeEach/beforeAll), eine Ausnahme braucht eine Begründung und muss noch nötig sein.
 */
export function pruefeZeit(dateien, ausnahmen) {
  const probleme = []
  const ausnahme = new Map(ausnahmen.map((a) => [a.datei, a]))
  const gebraucht = new Set()
  for (const { pfad, text } of dateien) {
    const stellen = ungeschuetzt(text)
    if (stellen.length === 0) continue
    const a = ausnahme.get(pfad)
    if (a) {
      gebraucht.add(pfad)
      if (!a.grund?.trim()) probleme.push(`${pfad}: Die Ausnahme braucht eine Begründung.`)
      continue
    }
    for (const s of stellen)
      probleme.push(
        `${pfad}:${s.zeile}: Zugriff auf die echte Uhr (${s.text.trim()}). Uhr mit vi.setSystemTime festsetzen oder in scripts/zeit-ausnahmen.json begründen.`,
      )
  }
  for (const a of ausnahmen)
    if (!gebraucht.has(a.datei))
      probleme.push(`${a.datei}: Die Ausnahme ist nicht mehr nötig, bitte entfernen.`)
  return probleme
}

const istTestdatei = (pfad) => /\.(test\.tsx?|spec\.ts)$/.test(pfad)

function sammle(wurzel, ordner, ergebnis) {
  for (const e of readdirSync(join(wurzel, ordner), { withFileTypes: true })) {
    const pfad = `${ordner}/${e.name}`
    if (e.isDirectory()) sammle(wurzel, pfad, ergebnis)
    else if (istTestdatei(pfad))
      ergebnis.push({ pfad, text: readFileSync(join(wurzel, pfad), 'utf8') })
  }
}

/** Prüft alle Testdateien unter `src/` und `e2e/` von `wurzel` aus. */
export function pruefeRepo(wurzel, ausnahmen) {
  const dateien = []
  for (const ordner of ['src', 'e2e']) sammle(wurzel, ordner, dateien)
  return pruefeZeit(dateien, ausnahmen)
}
