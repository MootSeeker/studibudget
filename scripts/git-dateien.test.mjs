import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { geaenderteDateien, neueDateien } from './lib/git-dateien.mjs'
import { planpruefung } from './lib/verify-kurz.mjs'

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'studibudget-git-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr || r.error?.message)
    return r
  }
  git('init', '--initial-branch=main')
  git('config', 'core.quotePath', 'true')
  const tracked = 'Prüfung geändert.md'
  const fresh = 'Neue Vorschläge.md'
  writeFileSync(join(cwd, tracked), 'vorher\n')
  git('add', '--', tracked)
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-m',
    'Testbestand',
  )
  git('switch', '-c', 'fix/test')
  writeFileSync(join(cwd, tracked), 'nachher\n')
  writeFileSync(join(cwd, fresh), 'neu\n')
  return { git, tracked, fresh }
}

test('gelistete Dateinamen mit Umlauten sind grün (#153)', (t) => {
  const { git, tracked, fresh } = fixture(t)
  const files = geaenderteDateien(git)
  assert.deepEqual(new Set(files), new Set([tracked, fresh]))
  assert.deepEqual(neueDateien(git), [fresh])
  const plan = ['```plan-dateien', tracked, fresh, '```'].join('\n')
  assert.deepEqual(
    planpruefung(plan, files, () => null),
    { name: 'Plan', status: 'gruen', befunde: [] },
  )
})

test('nicht gelistete Dateinamen mit Umlauten bleiben rot (#153)', (t) => {
  const { git, tracked, fresh } = fixture(t)
  for (const omitted of [tracked, fresh]) {
    const included = omitted === tracked ? fresh : tracked
    const plan = ['```plan-dateien', included, '```'].join('\n')
    assert.deepEqual(
      planpruefung(plan, geaenderteDateien(git), () => null),
      {
        name: 'Plan',
        status: 'rot',
        befunde: [`${omitted}: nicht in der Dateiliste des Plans`],
      },
    )
  }
})
