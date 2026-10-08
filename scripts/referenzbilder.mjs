// Übernimmt die Referenzbilder des letzten erfolgreichen Laufs von «Referenzbilder» in e2e/referenz (Issue #111).
// Aufruf: npm run referenzbilder -- [Branch]   (ohne Angabe: der aktuelle Branch; braucht die GitHub-CLI `gh`)
// Committen bleibt Handarbeit: erst die Bilder im Diff ansehen (docs/testing.md).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ersetzeOrdner, waehleLauf } from './lib/referenzbilder.mjs'

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim()
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' })

const branch = process.argv[2] ?? git('rev-parse', '--abbrev-ref', 'HEAD')
const headSha = git('rev-parse', branch === 'HEAD' ? 'HEAD' : `origin/${branch}`)
const runs = JSON.parse(
  gh(
    'run',
    'list',
    '--workflow',
    'referenzbilder.yml',
    '--branch',
    branch,
    '--limit',
    '10',
    '--json',
    'databaseId,headSha,conclusion,createdAt',
  ),
)
const gewaehlt = waehleLauf(runs, headSha)
if (!gewaehlt) {
  console.error(
    `Kein erfolgreicher Lauf von «Referenzbilder» auf ${branch}. Starte ihn unter Actions auf diesem Branch.`,
  )
  process.exit(1)
}
if (gewaehlt.veraltet)
  console.warn(
    `Achtung: Der Lauf ${gewaehlt.run.databaseId} gehört nicht zum aktuellen Stand von ${branch} (${headSha.slice(0, 7)}). ` +
      'Starte den Workflow nach dem letzten Push neu, wenn sich die Oberfläche seither geändert hat.',
  )
const tmp = mkdtempSync(join(tmpdir(), 'referenzbilder-'))
try {
  gh('run', 'download', String(gewaehlt.run.databaseId), '--name', 'referenzbilder', '--dir', tmp)
  ersetzeOrdner(tmp, 'e2e/referenz')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log(
  'e2e/referenz ist ersetzt. Bilder im Diff ansehen (git status, git diff --stat), dann committen.',
)
