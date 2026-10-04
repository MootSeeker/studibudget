import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Category, Template } from '../domain/types'
import { ReserveHint } from './ReserveHint'

const cat: Category = {
  id: 'c1',
  updatedAt: '',
  deleted: false,
  areaId: 'a',
  name: 'Haftpflicht',
  type: 'ausgabe',
  fix: true,
  rolloverFrom: null,
  hidden: false,
  order: 0,
}
const tpl = (months: number[]): Template => ({
  id: 't1',
  updatedAt: '',
  deleted: false,
  categoryId: 'c1',
  amountCents: 60000,
  note: '',
  months,
  active: true,
})

describe('ReserveHint', () => {
  it('zeigt Betrag pro Monat und nächste Fälligkeit', () => {
    render(
      <ReserveHint
        compact
        templates={[tpl([10])]}
        categories={[cat]}
        country="CH"
        month="2026-03"
      />,
    )
    expect(screen.getByRole('complementary', { name: 'Rückstellung' }).textContent).toMatch(
      /CHF\s50\.00 pro Monat beiseite.*Haftpflicht im Oktober/s,
    )
  })
  it('zeigt nichts, wenn alles monatlich ist', () => {
    const { container } = render(
      <ReserveHint
        templates={[tpl([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])]}
        categories={[cat]}
        country="CH"
        month="2026-03"
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
