import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import fc from 'fast-check'
import { afterEach, beforeAll } from 'vitest'
import { db } from '../data/db'

// Die Seiten lesen aus IndexedDB; unter Last (CI, parallele Prozesse) brauchen waitFor/findBy länger als die 1 s Vorgabe.
configure({ asyncUtilTimeout: 4000 })

/**
 * Mit SLOW_DB=<ms> (siehe `npm run test:slow`) wird jeder Datenbank-Lesezugriff um diese Zeit verzögert. So lassen sich
 * Zeitfehler nachstellen, die sonst nur auf langsamen Rechnern auftreten: Tests, die lesen, bevor die Daten geladen sind,
 * oder Oberflächen, die auf einem veralteten Bildschirmzustand speichern.
 */
if (process.env.SLOW_DB) {
  const delay = Number(process.env.SLOW_DB)
  const collection = Object.getPrototypeOf(db.persons.toCollection())
  const original = collection.toArray
  collection.toArray = function (this: unknown, ...args: unknown[]) {
    return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
      original.apply(this, args),
    )
  }
}

/**
 * Die Seiten lesen per Live-Abfrage aus IndexedDB; deren Aktualisierungen kommen von selbst, zwischen zwei `await` des
 * Tests, also ausserhalb von `act()`. Das ist gewollt und kein Fehler. Darum meldet React sie hier nicht («not wrapped in
 * act»); Tests warten mit `findBy…`/`waitFor` auf das Ergebnis (siehe vault «Tests und Zeitfehler»). `act()` aus der
 * Testing Library schaltet die Umgebung selbst wieder ein.
 */
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
})

/**
 * Konsolen-Wächter: Jede unerwartete Ausgabe auf console.error/warn lässt den Test scheitern. Meist steckt dahinter ein echter
 * Fehler (z. B. «not wrapped in act(...)»: der Test endet, bevor die Oberfläche fertig ist). Soll ein Test eine Ausgabe
 * absichtlich auslösen, ersetzt er die Methode mit `vi.spyOn(console, 'error').mockImplementation(() => {})`.
 */
const unexpectedOutput: string[] = []
for (const level of ['error', 'warn'] as const) {
  const original = console[level]
  console[level] = (...args: unknown[]) => {
    unexpectedOutput.push(`console.${level}: ${args.map(String).join(' ').split('\n')[0]}`)
    original(...args)
  }
}
afterEach(() => {
  // Gemerkte Auf-/Zuklapp-Zustände sollen nicht von Test zu Test wandern.
  try {
    localStorage.clear()
  } catch {
    /* node-Umgebung ohne Speicher */
  }
  const found = unexpectedOutput.splice(0)
  if (found.length > 0) throw new Error(`Unerwartete Konsolenausgabe im Test:\n${found.join('\n')}`)
})

// Eigenschaftstests: Anzahl Zufallsfälle über FC_NUM_RUNS einstellbar (Tiefenlauf in der CI: 2000).
fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS ?? 100) })
