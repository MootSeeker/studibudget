import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Prüft die Workflow-Datei als Text (Issue #111); belegt wird sie erst von der CI selbst.
const yml = readFileSync('.github/workflows/deploy.yml', 'utf8')
const jobsText = yml.slice(yml.indexOf('\njobs:'))
const jobNames = [...jobsText.matchAll(/^ {2}([a-z0-9-]+):\s*$/gm)].map((m) => m[1])
const block = (name: string) => {
  const start = jobsText.indexOf(`\n  ${name}:`)
  const rest = jobsText.slice(start + 1)
  const next = rest.slice(1).search(/^ {2}[a-z0-9-]+:\s*$/m)
  return next === -1 ? rest : rest.slice(0, next + 1)
}

describe('CI-Sammelstatus (Issue #111)', () => {
  it('AK-1: der Job «ci-gesamt» existiert', () => {
    expect(jobNames).toContain('ci-gesamt')
  })

  it('AK-1: er hängt von allen Pflichtjobs ab, damit kein neuer Job vergessen geht', () => {
    const pflicht = jobNames.filter((j) => !['bericht', 'deploy', 'ci-gesamt'].includes(j))
    expect(pflicht.length).toBeGreaterThanOrEqual(6)
    const needs = /needs:\s*\[([^\]]*)\]/
      .exec(block('ci-gesamt'))![1]
      .split(',')
      .map((s) => s.trim())
    for (const j of pflicht) expect(needs, `Pflichtjob ${j} fehlt in needs`).toContain(j)
  })

  it('AK-1: er läuft auch nach Fehlern, nicht bei Entwürfen, und schlägt bei Fehler oder Abbruch fehl', () => {
    const b = block('ci-gesamt')
    expect(b).toMatch(/if:.*always\(\)/)
    expect(b).toMatch(/draft != true/)
    expect(b).toMatch(/failure/)
    expect(b).toMatch(/cancelled/)
    expect(b).toMatch(/exit 1/)
  })

  it('AK-1: der Deploy wartet auf den Sammelstatus', () => {
    expect(/needs:\s*\[([^\]]*)\]/.exec(block('deploy'))![1]).toContain('ci-gesamt')
  })

  it('AK-3: bei einem Bildunterschied steht ein Hinweis mit Anleitung in der Zusammenfassung', () => {
    const b = block('e2e')
    expect(b).toMatch(/failure\(\)/)
    expect(b).toContain('-diff.png')
    expect(b).toContain('GITHUB_STEP_SUMMARY')
    expect(b).toContain('Referenzbilder')
    expect(b).toContain('npm run referenzbilder')
  })
})
