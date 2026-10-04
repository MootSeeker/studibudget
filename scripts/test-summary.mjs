// Fasst alle Berichte unter reports/ als Markdown zusammen: nach $GITHUB_STEP_SUMMARY (CI) oder auf stdout (lokal).
// Aufruf: node scripts/test-summary.mjs
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { measure, METRICS } from './coverage-ratchet.mjs'

const NAMES = {
  unit: 'Unit',
  langsam: 'Langsam (SLOW_DB)',
  slow: 'Langsam (SLOW_DB)',
  db: 'Datenbank',
}
const out = []
const say = (s = '') => out.push(s)
const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`)

const suites = existsSync('reports')
  ? readdirSync('reports').filter((d) => existsSync(`reports/${d}/results.json`))
  : []

say('## Testbericht')
say()
if (suites.length === 0) say('_Keine Testberichte gefunden (`reports/*/results.json`)._')
else {
  say('| Suite | Tests | Grün | Rot | Übersprungen | Dauer |')
  say('| --- | ---: | ---: | ---: | ---: | ---: |')
}

const failed = []
const regressions = []
for (const suite of suites) {
  const r = JSON.parse(readFileSync(`reports/${suite}/results.json`, 'utf8'))
  say(
    `| ${NAMES[suite] ?? suite} | ${r.numTotalTests} | ${r.numPassedTests} | ${r.numFailedTests} | ${r.numPendingTests + r.numTodoTests} | ${ms(Math.max(0, ...r.testResults.map((f) => f.endTime - f.startTime)))} |`,
  )
  for (const file of r.testResults) {
    const path = file.name.replace(`${process.cwd()}/`, '')
    for (const t of file.assertionResults) {
      if (t.status === 'failed')
        failed.push({
          suite,
          path,
          name: t.fullName,
          msg: (t.failureMessages?.[0] ?? '').split('\n')[0],
        })
      if (suite === 'unit' && t.tags?.includes('regression'))
        regressions.push({ path, name: t.fullName, line: t.location?.line })
    }
  }
}

if (failed.length) {
  say()
  say('### Rote Tests')
  for (const f of failed)
    say(`- **${f.name}** (\`${f.path}\`, ${NAMES[f.suite] ?? f.suite}): ${f.msg}`)
}

const covPath = 'reports/coverage/coverage-summary.json'
if (existsSync(covPath)) {
  const config = JSON.parse(readFileSync('scripts/coverage-areas.json', 'utf8'))
  say()
  say('### Abdeckung pro Bereich (Zeilen)')
  say()
  say('| Bereich | Ist | Untergrenze | Ziel | Zweige |')
  say('| --- | ---: | ---: | ---: | ---: |')
  for (const a of measure(config.bereiche)) {
    const ok = a.pct.lines >= a.ziel ? '✅' : '🔸'
    say(
      `| ${a.name} | ${a.pct.lines.toFixed(1)} % | ${a.schwelle?.lines ?? '–'} % | ${a.ziel} % ${ok} | ${a.pct.branches.toFixed(1)} % |`,
    )
  }
  void METRICS
}

if (regressions.length) {
  const repo = process.env.GITHUB_REPOSITORY
  const sha = process.env.GITHUB_SHA
  say()
  say('### Regressionstests')
  for (const t of regressions) {
    const issue = t.name.match(/#(\d+)/)?.[1]
    const link =
      repo && sha && t.line
        ? `[${t.path}:${t.line}](https://github.com/${repo}/blob/${sha}/${t.path}#L${t.line})`
        : `\`${t.path}\``
    say(
      `- ${t.name} – ${link}${issue && repo ? ` – [#${issue}](https://github.com/${repo}/issues/${issue})` : ''}`,
    )
  }
}

const text = out.join('\n') + '\n'
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
else process.stdout.write(text)
