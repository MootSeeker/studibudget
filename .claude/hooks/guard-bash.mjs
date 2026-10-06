// PreToolUse (Bash): setzt die Git-Regeln aus CLAUDE.md technisch durch.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const input = JSON.parse(readFileSync(0, 'utf8'))
const cmd = String(input.tool_input?.command ?? '')

const block = (reason) => {
  process.stderr.write(`Blockiert (CLAUDE.md, Git-Regeln): ${reason}\n`)
  process.exit(2)
}

const isPush = /\bgit\s+(?:-\S+\s+)*push\b/.test(cmd)
const isCommit = /\bgit\s+(?:-\S+\s+)*commit\b/.test(cmd)
const writesGitHub = /\bgh\s+(?:pr|issue)\s+(?:create|edit|comment)\b/.test(cmd)

if ((isCommit || isPush) && /--no-verify\b/.test(cmd))
  block('Hooks überspringen ist nicht erlaubt.')
if (isCommit && /--no-gpg-sign\b/.test(cmd)) block('Signierung darf nicht umgangen werden.')

if (isPush) {
  if (/(\s--force\b|\s--force-with-lease\b|\s-f\b|\s\+\S+)/.test(cmd))
    block('Force-Push ist nicht erlaubt.')
  if (/(\s|:)(main|master)(\s|$)/.test(cmd))
    block('Nicht auf main pushen, Branch und Pull Request nutzen.')
  const branch = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).stdout.trim()
  if (['main', 'master'].includes(branch))
    block('Aktueller Branch ist main: zuerst einen Themen-Branch anlegen.')
}

if (isCommit || writesGitHub) {
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
