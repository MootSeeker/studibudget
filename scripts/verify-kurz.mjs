// Knapper Prüfbericht (Issue #129): Schritte von `verify`, danach `test:slow`, plus Zusatzprüfungen «Leitplanken»
// (hinzugefügte Zeilen gegenüber main) und «Plan» (mit --plan <Datei>). Höchstens 30 Zeilen, Exit-Code ≠ 0 bei Rot.
// Aufruf: npm run verify:kurz [-- --plan <Datei>]
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  bericht,
  exitCode,
  hinzugefuegteZeilen,
  planlauf,
  planpruefung,
  pruefeLeitplanken,
  schritteAusVerify,
} from './lib/verify-kurz.mjs'

const args = process.argv.slice(2)
const planPfad = args.includes('--plan') ? args[args.indexOf('--plan') + 1] : undefined
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const ausnahmen = JSON.parse(
  readFileSync(new URL('./verify-kurz-ausnahmen.json', import.meta.url), 'utf8'),
)
const tmp = mkdtempSync(join(tmpdir(), 'verify-kurz-'))

const run = (befehl, argumente) =>
  spawnSync(befehl, argumente, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const git = (...argumente) => run('git', argumente)

/** Vitest-Schritte bekommen zusätzlich einen JSON-Bericht, aus dem die roten Tests kommen. */
function roteTests(pfad) {
  if (!existsSync(pfad)) return []
  const r = JSON.parse(readFileSync(pfad, 'utf8'))
  return r.testResults.flatMap((datei) =>
    datei.assertionResults
      .filter((t) => t.status === 'failed')
      .map((t) => ({
        datei: datei.name.replace(`${process.cwd()}/`, ''),
        name: t.fullName,
        meldung: t.failureMessages?.[0] ?? '',
      })),
  )
}

async function ausfuehren(name) {
  const istVitest = /^vitest\b/.test(pkg.scripts[name] ?? '')
  const json = join(tmp, `${name.replace(/\W/g, '_')}.json`)
  const extra = istVitest
    ? ['--', '--reporter=default', '--reporter=json', `--outputFile.json=${json}`]
    : []
  const r = run('npm', ['run', '--silent', name, ...extra])
  const ausgabe = `${r.stdout ?? ''}${r.stderr ?? ''}`
    .split('\n')
    .map((z) => z.trimEnd())
    .filter((z) => z.trim())
  return {
    status: r.status === 0 ? 'gruen' : 'rot',
    tests: istVitest ? roteTests(json) : [],
    ausgabe,
  }
}

function leitplanken() {
  const basis = git('merge-base', 'main', 'HEAD')
  if (basis.status !== 0)
    return { name: 'Leitplanken', status: 'rot', befunde: ['kein lokales main für den Vergleich'] }
  const zeilen = hinzugefuegteZeilen(git('diff', '-U0', basis.stdout.trim()).stdout)
  for (const datei of neueDateien()) {
    if (!existsSync(datei)) continue
    readFileSync(datei, 'utf8')
      .split('\n')
      .forEach((text, i) => zeilen.push({ datei, zeile: i + 1, text }))
  }
  const befunde = pruefeLeitplanken(zeilen, ausnahmen)
  return { name: 'Leitplanken', status: befunde.length ? 'rot' : 'gruen', befunde }
}

const neueDateien = () =>
  git('ls-files', '--others', '--exclude-standard').stdout.split('\n').filter(Boolean)

function geaenderteDateien() {
  const basis = git('merge-base', 'main', 'HEAD').stdout.trim()
  const geaendert = basis ? git('diff', '--name-only', basis).stdout.split('\n') : []
  return [...new Set([...geaendert, ...neueDateien()].filter(Boolean))]
}

function plan() {
  if (planPfad === undefined) return planpruefung(undefined, [], () => null)
  if (!existsSync(planPfad))
    return { name: 'Plan', status: 'rot', befunde: [`Plan-Datei fehlt: ${planPfad}`] }
  return planpruefung(readFileSync(planPfad, 'utf8'), geaenderteDateien(), (datei) =>
    existsSync(datei) ? readFileSync(datei, 'utf8') : null,
  )
}

const lauf = {
  schritte: await planlauf(schritteAusVerify(pkg.scripts.verify), ausfuehren),
  zusatz: [leitplanken(), plan()],
}
rmSync(tmp, { recursive: true, force: true })
console.log(bericht(lauf).join('\n'))
process.exit(exitCode(lauf))
