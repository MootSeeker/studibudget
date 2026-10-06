// Prüft den Obsidian-Vault in vault/: Verweise [[Notiz]] müssen auf vorhandene Notizen zeigen, und jede Notiz in einem
// Ordner braucht Frontmatter mit typ und aktualisiert (siehe vault/00 Meta/Vault-Anleitung.md). Aufruf: npm run check:vault
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

const root = 'vault'
const problems = []

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else files.push(path)
  }
}
walk(root)

const notes = files.filter((f) => f.endsWith('.md'))
const names = new Set(notes.map((f) => basename(f, '.md')))
const allFiles = new Set(files.map((f) => basename(f)))
const rel = (f) => relative('.', f).split('\\').join('/')

for (const file of notes) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const isTemplate = rel(file).startsWith(`${root}/_Vorlagen/`)

  // Verweise: [[Notiz]], [[Notiz|Anzeige]], [[Notiz#Abschnitt]]; Code-Blöcke und eingebettete Dateien ausnehmen
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
  for (const match of prose.matchAll(/!?\[\[([^\]]+)\]\]/g)) {
    const target = match[1].split('|')[0].split('#')[0].trim()
    if (!target || isTemplate) continue
    if (!names.has(target) && !allFiles.has(target))
      problems.push(`${rel(file)}: Verweis [[${match[1]}]] zeigt auf keine Notiz`)
  }

  // Frontmatter nur für Notizen in Ordnern (nicht für vault/README.md und die Vorlagen)
  if (isTemplate || file === join(root, 'README.md')) continue
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!front) {
    problems.push(`${rel(file)}: Frontmatter fehlt`)
    continue
  }
  for (const key of ['typ', 'aktualisiert']) {
    if (!new RegExp(`^${key}:\\s*\\S`, 'm').test(front[1]))
      problems.push(`${rel(file)}: Eigenschaft «${key}» fehlt im Frontmatter`)
  }
  const date = front[1].match(/^aktualisiert:\s*(\S+)/m)?.[1]
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
    problems.push(`${rel(file)}: «aktualisiert» ist kein Datum (JJJJ-MM-TT): ${date}`)
}

if (problems.length) {
  console.error(`Vault: ${problems.length} Problem(e)\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`Vault in Ordnung: ${notes.length} Notizen geprüft`)
