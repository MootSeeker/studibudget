import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Dependabot (#190): Konfiguration und gepinnte Fremd-Actions als Text geprüft; belegt wird es erst auf GitHub.
const lese = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const conf = lese('.github/dependabot.yml')
// Ein Eintrag pro Ökosystem: vom «- package-ecosystem» bis zum nächsten.
const eintraege = conf
  .split(/\n(?= {2}- package-ecosystem:)/)
  .slice(1)
  .map((text) => ({ text, art: /package-ecosystem:\s*(\S+)/.exec(text)![1] }))

describe('Dependabot (#190)', () => {
  it('AK-3: npm und github-actions, je wöchentlich gegen main, höchstens 5 PRs', () => {
    expect(eintraege.map((e) => e.art).sort()).toEqual(['github-actions', 'npm'])
    for (const { text } of eintraege) {
      expect(text).toMatch(/interval:\s*weekly/)
      expect(text).toMatch(/target-branch:\s*main/)
      const limit = Number(/open-pull-requests-limit:\s*(\d+)/.exec(text)![1])
      expect(limit).toBeGreaterThan(0)
      expect(limit).toBeLessThanOrEqual(5)
    }
  })

  it('AK-3: je eine Gruppe für Minor und Patch', () => {
    for (const { text } of eintraege) {
      const gruppen = text.slice(text.indexOf('groups:'))
      expect(gruppen).toMatch(/update-types:\s*\n\s*- minor\s*\n\s*- patch/)
    }
  })

  it('AK-4: Label «ci», kein eigenes Label wie «dependencies»', () => {
    for (const { text } of eintraege) {
      const labels = /labels:\s*\n((?:\s+- \S+\n?)+)/.exec(text)![1]
      expect(
        labels
          .trim()
          .split(/\s*-\s+/)
          .filter(Boolean),
      ).toEqual(['ci'])
    }
  })

  it('AK-5: gitleaks und lychee zeigen auf einen Commit-SHA mit Version als Kommentar', () => {
    const doku = lese('.github/workflows/doku.yml')
    for (const action of ['gitleaks/gitleaks-action', 'lycheeverse/lychee-action']) {
      const zeile = doku.split('\n').find((z) => z.includes(`uses: ${action}@`))!
      expect(zeile).toMatch(new RegExp(`${action}@[0-9a-f]{40} # v\\d+\\.\\d+\\.\\d+$`))
    }
  })
})
