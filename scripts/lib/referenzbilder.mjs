// Referenzbilder aus dem Workflow «Referenzbilder» übernehmen (Issue #111). Reine Hilfen, getestet in
// src/test/referenzbilder.test.ts; aufgerufen von scripts/referenzbilder.mjs.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'

/**
 * Wählt aus den Läufen `[{ databaseId, headSha, conclusion }]` (neueste zuerst) den passenden: erfolgreich und zum
 * aktuellen Stand `headSha`; gibt es keinen, den neuesten erfolgreichen mit `veraltet: true`. `null`, wenn keiner.
 */
export function waehleLauf(runs, headSha) {
  const gut = runs.filter((r) => r.conclusion === 'success')
  const passend = gut.find((r) => r.headSha === headSha)
  if (passend) return { run: passend, veraltet: false }
  return gut[0] ? { run: gut[0], veraltet: true } : null
}

/** Ersetzt den Inhalt von `ziel` durch den von `quelle`. Wirft, wenn die Quelle fehlt oder keine Bilder enthält. */
export function ersetzeOrdner(quelle, ziel) {
  if (!existsSync(quelle)) throw new Error(`Quellordner fehlt: ${quelle}`)
  if (readdirSync(quelle).length === 0)
    throw new Error(`Der Ordner ${quelle} enthält keine Bilder.`)
  rmSync(ziel, { recursive: true, force: true })
  mkdirSync(ziel, { recursive: true })
  cpSync(quelle, ziel, { recursive: true })
}
