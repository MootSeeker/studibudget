import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGAL_DOCS, openTodos, type LegalDoc } from './content'
import { LegalDocView, LegalPage } from './LegalPage'

describe('Gerüst für Datenschutz und Impressum', () => {
  it('jeder Abschnitt ist entweder noch offen (TODO(human)) oder hat einen Text', () => {
    for (const d of LEGAL_DOCS)
      for (const s of d.sections) {
        expect(Boolean(s.todo) || Boolean(s.body?.length), `${d.title}: ${s.title}`).toBe(true)
        if (s.todo) expect(s.todo).toMatch(/^TODO\(human\)/)
      }
  })

  it('zeigt solange Abschnitte offen sind den Hinweis «Entwurf, rechtlich nicht gültig»', () => {
    render(<LegalPage slug="datenschutz" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/Entwurf.*nicht gültig/)
    expect(screen.getAllByText(/^TODO\(human\)/).length).toBeGreaterThan(3)
  })

  it('Impressum ist erreichbar und trägt denselben Hinweis', () => {
    render(<LegalPage slug="impressum" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('ein vollständig ausgefülltes Dokument zeigt keinen Entwurfs-Hinweis und keine Platzhalter', () => {
    const doc: LegalDoc = {
      slug: 'impressum',
      title: 'Impressum',
      sections: [{ title: 'Betreiber', body: ['Beispiel Muster, Musterstrasse 1'] }],
    }
    render(<LegalDocView doc={doc} />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.queryByText(/TODO/)).not.toBeInTheDocument()
    expect(screen.getByText('Beispiel Muster, Musterstrasse 1')).toBeInTheDocument()
  })

  it('openTodos zählt nur offene Abschnitte', () => {
    expect(openTodos()).toHaveLength(
      LEGAL_DOCS.flatMap((d) => d.sections).filter((s) => s.todo).length,
    )
    expect(
      openTodos([{ slug: 'impressum', title: 'X', sections: [{ title: 'a', body: ['x'] }] }]),
    ).toEqual([])
  })

  it('das Startskript zählt dieselben offenen Stellen wie die App (kein Auseinanderlaufen)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/legal/content.ts'), 'utf8')
    const likeScript = [...source.matchAll(/todo:\s*'(TODO\(human\)[^']*)'/g)].length
    expect(likeScript).toBe(openTodos().length)
  })
})
