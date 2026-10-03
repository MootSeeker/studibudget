// Prüft, ob die App bereit für die öffentliche Freigabe ist. NICHT Teil von `verify`: Solange der Betreiber die rechtlichen
// Texte nicht ausgefüllt hat, schlägt es absichtlich fehl. Aufruf: npm run check:launch
import { readFileSync, existsSync } from 'node:fs'
import { loadEnv } from 'vite'

const blockers = []
const hints = []

// 1. Rechtliche Texte: keine TODO(human)-Markierungen mehr
const legalDir = 'src/legal'
const content = readFileSync(`${legalDir}/content.ts`, 'utf8')
const todos = [...content.matchAll(/todo:\s*'(TODO\(human\)[^']*)'/g)].map((m) => m[1])
if (todos.length)
  blockers.push(
    `Datenschutz/Impressum: ${todos.length} Abschnitt(e) mit TODO(human) in src/legal/content.ts`,
  )

// 2. Server konfiguriert
const env = loadEnv('production', process.cwd(), 'VITE_')
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)
  blockers.push('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sind nicht gesetzt')
else if (/127\.0\.0\.1|localhost/.test(env.VITE_SUPABASE_URL))
  blockers.push('VITE_SUPABASE_URL zeigt auf einen lokalen Server')

// 3. Dinge, die nur im Supabase-Dashboard geprüft werden können
hints.push(
  'Supabase: eigener E-Mail-Versand (SMTP) eingerichtet?',
  'Supabase: Site URL und Redirect URL stimmen mit der veröffentlichten Adresse überein?',
  'Supabase: Region der Datenbank in der Datenschutzerklärung genannt?',
  'Supabase: Registrierung bewusst freigeschaltet («Allow new users to sign up»)?',
  'Supabase: Auftragsverarbeitungsvertrag (DPA) akzeptiert?',
)
if (!existsSync('docs/start-checkliste.md')) blockers.push('docs/start-checkliste.md fehlt')

console.log(blockers.length ? 'NICHT startklar:' : 'Automatisch prüfbare Punkte sind erledigt.')
for (const b of blockers) console.log(`  ✗ ${b}`)
console.log('\nVon Hand zu prüfen (siehe docs/start-checkliste.md):')
for (const h of hints) console.log(`  ? ${h}`)
process.exit(blockers.length ? 1 : 0)
