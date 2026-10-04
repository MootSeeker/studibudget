import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { WealthPoint } from '../../domain/wealth'
import type { MonthTotals } from '../../domain/stats'
import type { ExpenseArea } from '../../domain/statsView'
import { ExpenseBars } from './ExpenseBars'
import { MonthlyChart } from './MonthlyChart'
import { niceStep } from './scale'
import { WealthChart } from './WealthChart'

const money = (c: number) => `CHF ${(c / 100).toFixed(2)}`
const noBrokenNumbers = (html: string) => expect(html).not.toMatch(/NaN|Infinity|undefined/)

describe('niceStep', () => {
  it.each([
    [100, 4, 50],
    [10_000, 4, 5000],
    [12_345, 4, 5000],
    [1, 4, 0.5],
  ])('Spanne %s ergibt einen schönen Schritt', (range, ticks, step) => {
    expect(niceStep(range, ticks)).toBe(step)
  })
  it('Spanne 0 fällt auf einen brauchbaren Schritt zurück statt auf 0 oder NaN', () => {
    expect(niceStep(0)).toBe(1)
  })
})

describe('MonthlyChart', { tags: ['negativ'] }, () => {
  const m = (month: string, e: number, a: number, s = 0): MonthTotals => ({
    month,
    einnahmen: e,
    ausgaben: a,
    sparen: s,
    saldo: e - a - s,
  })
  it('ein einziger Monat ergibt eine gültige Grafik', () => {
    const { container } = render(
      <MonthlyChart months={[m('2026-10', 100_000, 60_000)]} money={money} />,
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
    noBrokenNumbers(container.innerHTML)
  })
  it('lauter Nullen ergeben keine kaputten Zahlen', () => {
    const { container } = render(
      <MonthlyChart months={[m('2026-09', 0, 0), m('2026-10', 0, 0)]} money={money} />,
    )
    noBrokenNumbers(container.innerHTML)
  })
  it('negativer Saldo (nur Schulden) liegt unter der Nulllinie und bleibt gültig', () => {
    const { container } = render(
      <MonthlyChart months={[m('2026-09', 0, 50_000), m('2026-10', 0, 80_000)]} money={money} />,
    )
    noBrokenNumbers(container.innerHTML)
  })
  it('24 Monate und mehr: alle Monate sind erreichbar, der Tooltip zeigt Monat und Beträge', async () => {
    const months = Array.from({ length: 30 }, (_, i) =>
      m(`${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, 100_000, 70_000),
    )
    const { container } = render(<MonthlyChart months={months} money={money} />)
    noBrokenNumbers(container.innerHTML)
    await userEvent.setup().hover(container.querySelectorAll('rect')[0])
  })
})

describe('WealthChart', { tags: ['negativ'] }, () => {
  const p = (month: string, total: number | null, complete = true, missing = 0): WealthPoint => ({
    month,
    total,
    complete,
    missing,
  })
  it('ohne vollständige Monate keine kaputten Zahlen', () => {
    const { container } = render(
      <WealthChart
        points={[p('2026-09', null, false, 2), p('2026-10', 500, false, 1)]}
        money={money}
      />,
    )
    noBrokenNumbers(container.innerHTML)
  })
  it('Lücken zwischen vollständigen Monaten teilen die Linie in Stücke', () => {
    const { container } = render(
      <WealthChart
        points={[
          p('2026-07', 1000),
          p('2026-08', null, false, 1),
          p('2026-09', 3000),
          p('2026-10', 3500),
        ]}
        money={money}
      />,
    )
    noBrokenNumbers(container.innerHTML)
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(2)
  })
  it('negatives Vermögen (Schulden) bleibt gültig', () => {
    const { container } = render(
      <WealthChart points={[p('2026-09', -50_000), p('2026-10', -20_000)]} money={money} />,
    )
    noBrokenNumbers(container.innerHTML)
  })
})

describe('ExpenseBars', { tags: ['negativ'] }, () => {
  const area = (id: string, total: number, cats: number[] = []): ExpenseArea =>
    ({
      area: { id, name: `Bereich ${id}`, order: 0, hidden: false, deleted: false, updatedAt: '' },
      total,
      sharePct: 50,
      categories: cats.map((c, i) => ({
        category: { id: `${id}-${i}`, name: `Kat ${id}${i}` },
        total: c,
      })),
    }) as unknown as ExpenseArea

  it('ohne Ausgaben steht ein Hinweis statt einer leeren Liste', () => {
    const { container } = render(<ExpenseBars areas={[]} money={money} />)
    expect(container).toHaveTextContent('keine Ausgaben')
  })
  it('ein Klick klappt die Kategorien auf und wieder zu', async () => {
    const user = userEvent.setup()
    const { getByRole, queryByText } = render(
      <ExpenseBars areas={[area('a', 10_000, [6000, 4000])]} money={money} />,
    )
    const btn = getByRole('button', { name: /Bereich a/ })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(queryByText(/Kat a0/)).not.toBeInTheDocument()
    await user.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(queryByText(/Kat a0/)).toBeInTheDocument()
    await user.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })
  it('Bereich mit Total 0 ergibt eine Leiste der Breite 0', () => {
    const { container } = render(<ExpenseBars areas={[area('a', 0)]} money={money} />)
    expect(container.querySelector('[role="img"] > div')).toHaveStyle({ width: '0%' })
  })
})
