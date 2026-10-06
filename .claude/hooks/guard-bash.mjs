// PreToolUse (Bash): setzt die Git-Regeln aus CLAUDE.md technisch durch.
// Geprüft werden nur echte Befehle: Heredoc-Körper und Text in Anführungszeichen zählen nicht als Befehl,
// sonst schlägt der Wächter bei Dateiinhalten und Beschreibungen an. Die Claude-Kennzeichnung wird dagegen
// im ganzen Befehl gesucht, weil Commit-Nachrichten oft in Anführungszeichen oder Heredocs stehen.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const input = JSON.parse(readFileSync(0, 'utf8'))
const cmd = String(input.tool_input?.command ?? '')

const block = (reason) => {
  process.stderr.write(`Blockiert (CLAUDE.md, Git-Regeln): ${reason}\n`)
  process.exit(2)
}

// Heredoc-Körper entfernen (die Zeile mit << bleibt), danach Anführungszeichen-Inhalt leeren
const skeleton = cmd
  .replace(/<<-?[ \t]*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2(?!\w)/g, '$3')
  .replace(/'[^']*'/g, "''")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')

// Einzelne Befehle: getrennt an &&, ||, ;, | und Zeilenumbruch; führende Variablen und Klammern abschneiden
const segments = skeleton.split(/&&|\|\||[;|\n]/).map((s) =>
  s
    .trim()
    .replace(/^(?:\w+=\S*\s+)+/, '')
    .replace(/^[({]\s*/, ''),
)

const gitCommand = (name) => new RegExp(`^git(?:\\s+-\\S+(?:\\s+[^-\\s]\\S*)?)*\\s+${name}\\b(.*)$`)
const afterGit = (name) =>
  segments.map((s) => s.match(gitCommand(name))?.[1]).filter((rest) => rest !== undefined)

const pushes = afterGit('push')
const commits = afterGit('commit')
const writesGitHub = segments.some((s) => /^gh\s+(?:pr|issue)\s+(?:create|edit|comment)\b/.test(s))

// Nicht auf die CI warten (Regel 2): der Nutzer meldet das Ergebnis. Ein einmaliges `gh pr checks` bleibt erlaubt.
const waitsForCi = segments.some(
  (s) =>
    /(^|\s)gh\s+run\s+watch\b/.test(s) ||
    (/(^|\s)gh\s+pr\s+checks\b/.test(s) && /(^|\s)(--watch|-w)(\s|$)/.test(s)),
)
if (waitsForCi)
  block(
    'Nicht auf die CI warten: der Nutzer meldet das Ergebnis. Einmal `gh pr checks` ist erlaubt.',
  )

for (const rest of [...pushes, ...commits]) {
  if (/(^|\s)--no-verify(\s|$)/.test(rest)) block('Hooks überspringen ist nicht erlaubt.')
}
if (commits.some((rest) => /(^|\s)--no-gpg-sign(\s|$)/.test(rest)))
  block('Signierung darf nicht umgangen werden.')

if (pushes.length) {
  for (const rest of pushes) {
    if (/(^|\s)(--force(-with-lease)?(=\S+)?|-[a-zA-Z]*f[a-zA-Z]*|\+\S+)(\s|$)/.test(rest))
      block('Force-Push ist nicht erlaubt.')
    if (/(^|\s|:)(main|master)(\s|$)/.test(rest))
      block('Nicht auf main pushen, Branch und Pull Request nutzen.')
  }
  const branch = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).stdout.trim()
  if (['main', 'master'].includes(branch))
    block('Aktueller Branch ist main: zuerst einen Themen-Branch anlegen.')
}

if (commits.length || writesGitHub) {
  if (
    /co-authored-by/i.test(cmd) ||
    /generated with\s*\[?claude/i.test(cmd) ||
    /noreply@anthropic\.com/i.test(cmd)
  ) {
    block(
      'Keine Claude-Kennzeichnung (Co-Authored-By, «Generated with Claude») in Commits, PRs oder Issues.',
    )
  }
}
