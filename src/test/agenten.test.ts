import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Agenten-Ablauf (Issue #128): Modelle und wörtliche Regeln der Subagenten planer und umsetzer.
const agent = (name: string) => readFileSync(`.claude/agents/${name}.md`, 'utf8')

function frontmatter(text: string): Record<string, string> {
  const kopf = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  return Object.fromEntries(
    kopf
      .split('\n')
      .map((z) => z.match(/^(\w+):\s*(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2].trim()]),
  )
}

describe('Agenten-Ablauf (#128)', () => {
  it('AK-1: planer läuft mit Opus und umsetzer mit Haiku, beide ohne Agent-Werkzeug', () => {
    const planer = frontmatter(agent('planer'))
    const umsetzer = frontmatter(agent('umsetzer'))
    expect(planer.model).toBe('opus')
    expect(umsetzer.model).toBe('haiku')
    for (const fm of [planer, umsetzer]) {
      expect(fm.tools.split(/,\s*/)).not.toContain('Agent')
      expect(fm.disallowedTools.split(/,\s*/)).toContain('Agent')
    }
    expect(umsetzer.disallowedTools.split(/,\s*/)).toEqual(
      expect.arrayContaining(['WebFetch', 'WebSearch']),
    )
    expect(planer.tools.split(/,\s*/)).not.toContain('Edit')
  })

  it('AK-3: umsetzer.md enthält die Regeln wörtlich', () => {
    const text = agent('umsetzer')
    for (const regel of [
      'PLAN UNKLAR:',
      'TROCKENLAUF OK',
      'ENTSCHEIDUNG:',
      'Tests zuerst',
      'Nur Dateien aus dem Block `plan-dateien`',
      'Nur die geplanten Tests',
      'Imports, Formatierung, Typen',
      'Du committest nie',
    ])
      expect(text).toContain(regel)
  })
})
