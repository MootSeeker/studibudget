// Testet den Git-Wächter: node .claude/hooks/guard-bash.test.mjs
// Erwartet, dass der aktuelle Branch nicht main ist (der Wächter prüft ihn bei jedem Push).
import { spawnSync } from 'node:child_process'
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
  // erlaubt, auch wenn die Wörter als Text vorkommen
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

let failed = 0
for (const [want, command] of cases) {
  const r = spawnSync('node', [guard], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
  })
  const ok = r.status === want
  if (!ok) failed++
  console.log(ok ? 'OK  ' : 'FAIL', `erwartet ${want}, war ${r.status}:`, command.split('\n')[0])
}
console.log(failed ? `${failed} Fehler` : 'Alle Fälle bestanden')
process.exit(failed ? 1 : 0)
