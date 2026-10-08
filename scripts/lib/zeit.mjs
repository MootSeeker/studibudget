// Zeitfehler-Wächter (Issue #111): Tests dürfen die echte Uhr nicht ungeschützt lesen. Reine Hilfen, aufgerufen von
// scripts/check-zeit.mjs und getestet in src/test/zeit.test.ts.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ECHTE_UHR = /\bnew Date\s*\(\s*\)|\bDate\s*\.\s*now\s*\(\s*\)/
const FESTE_UHR = /\bsetSystemTime\b/

/** Zeilen (ab 1) mit Zugriff auf die echte Uhr; Kommentarzeilen zählen nicht. */
export function findeZeitstellen(text) {
  return text
    .split('\n')
    .map((zeile, i) => ({ zeile: i + 1, text: zeile }))
    .filter((z) => !z.text.trim().startsWith('//') && ECHTE_UHR.test(z.text))
}

/**
 * Prüft Dateien `{ pfad, text }` gegen die Ausnahmen `{ datei, grund }`; liefert die Verstösse als Sätze.
 * Eine Datei mit `setSystemTime` gilt als fest (grob: die Prüfung gilt je Datei, nicht je Test), eine Ausnahme braucht eine Begründung und muss noch nötig sein.
 */
export function pruefeZeit(dateien, ausnahmen) {
  const probleme = []
  const ausnahme = new Map(ausnahmen.map((a) => [a.datei, a]))
  const gebraucht = new Set()
  for (const { pfad, text } of dateien) {
    const stellen = findeZeitstellen(text)
    if (stellen.length === 0 || FESTE_UHR.test(text)) continue
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
