// Zeitfehler-Wächter (Issue #111): Testdateien dürfen die echte Uhr nur mit fester Uhr oder begründeter Ausnahme lesen.
// Ausnahmen: scripts/zeit-ausnahmen.json. Aufruf: npm run check:zeit
import { readFileSync } from 'node:fs'
import { pruefeRepo } from './lib/zeit.mjs'

const ausnahmen = JSON.parse(
  readFileSync(new URL('./zeit-ausnahmen.json', import.meta.url), 'utf8'),
)
const probleme = pruefeRepo('.', ausnahmen)
if (probleme.length) {
  console.error(probleme.join('\n'))
  console.error(
    `\n${probleme.length} Verstoss/Verstösse gegen die Zeitregeln für Tests (siehe docs/testing.md).`,
  )
  process.exit(1)
}
console.log('Zeitregeln für Tests eingehalten.')
