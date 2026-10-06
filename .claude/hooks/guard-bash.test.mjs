// Testet den Git-Wächter: node .claude/hooks/guard-bash.test.mjs
// Läuft in einem Wegwerf-Repository (erst auf main, dann auf einem Themen-Branch), unabhängig vom Projekt-Branch.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const guard = fileURLToPath(new URL('./guard-bash.mjs', import.meta.url))
const HEREDOC = (tag, body) => `<<'${tag}'\n${body}\n${tag}`

const cases = [
  // blockiert
  [2, 'git push origin main'],
  [2, 'git push origin HEAD:main'],
  [2, 'git -C . push origin main'],
  [2, 'git status && git push --force origin feature'],
  [2, 'git push -f origin feature'],
  [2, 'git push origin +feature'],
  [2, 'cd x; git push --force-with-lease'],
  [2, 'git commit --no-verify -m "x"'],
  [2, 'git push --no-verify'],
  [2, 'git commit -m "x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"'],
  [2, `git commit -m "$(cat ${HEREDOC('EOF', 'Nachricht\n\nCo-Authored-By: Claude')})"`],
  [2, 'gh pr create --body "Generated with [Claude Code](https://claude.com/claude-code)"'],
  [2, 'gh issue comment 1 --body "Co-Authored-By: X"'],
  [2, 'gh pr checks 98 --watch'],
  [2, 'gh pr checks --watch --interval 20'],
  [2, 'gh pr checks 98 -w'],
  [2, 'gh run watch 123456'],
  [2, 'timeout 500 gh run watch 123456 && gh run view 123456'],
  // erlaubt, auch wenn die Wörter als Text vorkommen
  [0, 'gh pr checks 98'],
  [0, 'gh run view 123456 --json conclusion'],
  [0, 'gh run list --branch feat/x --limit 3'],
  [0, 'echo "gh run watch ist verboten"'],
  [0, 'git push -u origin docs/claude-md'],
  [0, 'git commit -m "Normale Nachricht"'],
  [0, `git commit -m "$(cat ${HEREDOC('EOF', 'Nachricht ohne Kennzeichnung')})"`],
  [0, 'git status'],
  [0, 'echo --no-verify'],
  [0, 'echo "git push origin main"'],
  [0, `cat > datei.md ${HEREDOC('EOF', 'Danach git push origin main und git commit --no-verify')}`],
  [0, 'grep -rn "git push --force" docs'],
  [0, 'gh pr create --title "Wächter für git push auf main" --body "Blockiert --no-verify"'],
]

// Fälle auf dem Hauptzweig: nur Tag-Pushes (Release) sind erlaubt
const mainCases = [
  [0, 'git push origin v9.9.9'],
  [0, 'git push origin refs/tags/v9.9.9'],
  [0, 'git push --tags'],
  [0, 'git push origin --tags'],
  [2, 'git push'],
  [2, 'git push origin HEAD'],
  [2, 'git push origin main'],
  [2, 'git push origin v9.9.9 main'],
  [2, 'git push origin unbekannter-tag'],
  [2, 'git push --force origin v9.9.9'],
  [2, 'git push origin +v9.9.9'],
  [2, 'git push origin :v9.9.9'],
  [2, 'git push origin gleichnamig'], // Tag und Branch heissen gleich: gilt nicht als reiner Tag-Push
  [0, 'git status'],
]

// Eigenes Wegwerf-Repository, damit der Test nicht vom aktuellen Branch des Projekts abhängt
const repo = mkdtempSync(join(tmpdir(), 'guard-test-'))
const git = (...args) =>
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd: repo,
    encoding: 'utf8',
  })
git('init', '-q', '-b', 'main')
git('commit', '-q', '--allow-empty', '-m', 'start')
git('tag', 'v9.9.9')
git('tag', 'gleichnamig')
git('branch', 'gleichnamig')

let failed = 0
const run = (list, label) => {
  for (const [want, command] of list) {
    const r = spawnSync('node', [guard], {
      input: JSON.stringify({ tool_input: { command } }),
      encoding: 'utf8',
      cwd: repo,
    })
    const ok = r.status === want
    if (!ok) failed++
    console.log(
      ok ? 'OK  ' : 'FAIL',
      `[${label}] erwartet ${want}, war ${r.status}:`,
      command.split('\n')[0],
    )
  }
}
run(mainCases, 'main')
git('checkout', '-q', '-b', 'feature')
run(cases, 'Themen-Branch')
rmSync(repo, { recursive: true, force: true })
console.log(failed ? `${failed} Fehler` : 'Alle Fälle bestanden')
process.exit(failed ? 1 : 0)
