// PostToolUse (Edit|Write): formatiert die geänderte Datei mit Prettier und prüft sie mit Oxlint.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { extname, relative, resolve, isAbsolute } from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8'))
const file = input.tool_input?.file_path ?? input.tool_response?.filePath
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
if (!file) process.exit(0)

const abs = isAbsolute(file) ? file : resolve(root, file)
const rel = relative(root, abs).split(String.fromCharCode(92)).join('/')
if (rel.startsWith('..') || rel.includes('node_modules/') || rel.startsWith('.claude/')) process.exit(0)

const ext = extname(abs).toLowerCase()
if (!['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.css'].includes(ext)) process.exit(0)

const run = (args) =>
  spawnSync(`npx --no-install ${args.map((a) => JSON.stringify(a)).join(' ')}`, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  })

run(['prettier', '--write', '--ignore-unknown', rel])

if (['.ts', '.tsx', '.js', '.mjs'].includes(ext)) {
  const lint = run(['oxlint', '--deny-warnings', rel])
  if (lint.status !== 0) {
    process.stderr.write(`Oxlint meldet Probleme in ${rel}:\n${lint.stdout}${lint.stderr}`)
    process.exit(2)
  }
}
