import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AccountSeries, WealthPoint } from '../../domain/wealth'
import type { MonthTotals } from '../../domain/stats'
import type { ExpenseArea } from '../../domain/statsView'
import { ExpenseBars } from './ExpenseBars'
import { MonthlyChart } from './MonthlyChart'
import { niceStep } from './scale'
import { SettlementChart } from './SettlementChart'
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
        accounts={[]}
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
        accounts={[]}
        money={money}
      />,
    )
    noBrokenNumbers(container.innerHTML)
    expect(container.querySelectorAll('path[data-linie="gesamt"]')).toHaveLength(1)
    expect(container.querySelectorAll('circle[data-linie="gesamt"]')).toHaveLength(3)
  })
  it('negatives Vermögen (Schulden) bleibt gültig', () => {
    const { container } = render(
      <WealthChart
        points={[p('2026-09', -50_000), p('2026-10', -20_000)]}
        accounts={[]}
        money={money}
      />,
    )
    noBrokenNumbers(container.innerHTML)
  })
})

describe('WealthChart mit Konten (Issue #113)', () => {
  const full = (month: string, total: number): WealthPoint => ({
    month,
    total,
    complete: true,
    missing: 0,
  })
  const points = ['2026-07', '2026-08', '2026-09', '2026-10'].map((m, i) => full(m, (i + 1) * 1000))
  const accounts: AccountSeries[] = [
    { accountId: 'a', name: 'Privat', include: true, values: [400, 800, 1200, 1600] },
    { accountId: 'b', name: 'Spar', include: true, values: [600, 1200, 1800, 2400] },
  ]
  const gapPoints: WealthPoint[] = [
    full('2026-06', 1000),
    full('2026-07', 2000),
    { month: '2026-08', total: 1800, complete: false, missing: 1 },
    full('2026-09', 4000),
    full('2026-10', 5000),
  ]
  const gapAccounts: AccountSeries[] = [
    { accountId: 'a', name: 'Privat', include: true, values: [400, 800, null, 1200, 1600] },
  ]
  const show = () => {
    const user = userEvent.setup()
    const view = render(<WealthChart points={points} accounts={accounts} money={money} />)
    return { user, ...view }
  }
  const lines = (c: HTMLElement, key: string) => c.querySelectorAll(`path[data-linie="${key}"]`)
  const dots = (c: HTMLElement, key: string) => c.querySelectorAll(`circle[data-linie="${key}"]`)

  it('AK-1: zeichnet pro Konto eine Linie und die Linie Gesamtvermögen', () => {
    const { container, getByText } = show()
    expect(lines(container, 'gesamt')).toHaveLength(1)
    expect(lines(container, 'a')).toHaveLength(1)
    expect(lines(container, 'b')).toHaveLength(1)
    expect(dots(container, 'a')).toHaveLength(4)
    expect(getByText('Privat')).toBeInTheDocument()
    expect(getByText('Spar')).toBeInTheDocument()
    expect(getByText('Gesamtvermögen')).toBeInTheDocument()
    noBrokenNumbers(container.innerHTML)
  })

  it('AK-1: ein nicht gezähltes Konto ist in der Legende gekennzeichnet', () => {
    const { getByRole } = render(
      <WealthChart points={points} accounts={[{ ...accounts[0], include: false }]} money={money} />,
    )
    expect(getByRole('checkbox', { name: 'Privat (nicht gezählt)' })).toBeChecked()
  })

  it('AK-2: alle Kästchen sind zu Beginn angewählt', () => {
    const { getAllByRole } = show()
    const boxes = getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    for (const b of boxes) expect(b).toBeChecked()
  })

  it('AK-2: Abwählen blendet die Linie aus, Anwählen blendet sie wieder ein', async () => {
    const { user, container, getByRole } = show()
    const box = getByRole('checkbox', { name: 'Privat' })
    await user.click(box)
    expect(box).not.toBeChecked()
    expect(lines(container, 'a')).toHaveLength(0)
    expect(dots(container, 'a')).toHaveLength(0)
    expect(lines(container, 'b')).toHaveLength(1)
    await user.click(box)
    expect(box).toBeChecked()
    expect(lines(container, 'a')).toHaveLength(1)
    expect(dots(container, 'a')).toHaveLength(4)
  })

  it('AK-2: auch die Linie Gesamtvermögen lässt sich aus- und einblenden', async () => {
    const { user, container, getByRole } = show()
    const box = getByRole('checkbox', { name: 'Gesamtvermögen' })
    await user.click(box)
    expect(lines(container, 'gesamt')).toHaveLength(0)
    expect(dots(container, 'gesamt')).toHaveLength(0)
    await user.click(box)
    expect(lines(container, 'gesamt')).toHaveLength(1)
  })

  it('AK-3: Gesamtlinie ist dicker, solange weitere Linien sichtbar sind', async () => {
    const { user, container, getByRole } = show()
    expect(lines(container, 'gesamt')[0]).toHaveAttribute('stroke-width', '4')
    expect(lines(container, 'a')[0]).toHaveAttribute('stroke-width', '2')
    expect(lines(container, 'b')[0]).toHaveAttribute('stroke-width', '2')
    await user.click(getByRole('checkbox', { name: 'Privat' }))
    expect(lines(container, 'gesamt')[0]).toHaveAttribute('stroke-width', '4')
  })

  it('AK-3: als einzige sichtbare Linie hat die Gesamtlinie die normale Dicke', async () => {
    const { user, container, getByRole } = show()
    await user.click(getByRole('checkbox', { name: 'Privat' }))
    await user.click(getByRole('checkbox', { name: 'Spar' }))
    expect(lines(container, 'gesamt')[0]).toHaveAttribute('stroke-width', '2')
    await user.click(getByRole('checkbox', { name: 'Spar' }))
    expect(lines(container, 'gesamt')[0]).toHaveAttribute('stroke-width', '4')
  })

  it('AK-4: bietet keine Möglichkeit, weitere Linien hinzuzufügen', () => {
    const { queryAllByRole, getAllByRole } = show()
    expect(queryAllByRole('button')).toHaveLength(0)
    expect(queryAllByRole('textbox')).toHaveLength(0)
    expect(queryAllByRole('combobox')).toHaveLength(0)
    expect(getAllByRole('checkbox')).toHaveLength(accounts.length + 1)
  })

  it('AK-5: Linien und Legende nehmen ihre Farben aus den Serien-Variablen', () => {
    const { container } = show()
    expect(lines(container, 'gesamt')[0]).toHaveAttribute('stroke', 'var(--series-1)')
    expect(lines(container, 'a')[0]).toHaveAttribute('stroke', 'var(--series-2)')
    expect(lines(container, 'b')[0]).toHaveAttribute('stroke', 'var(--series-3)')
    const legend = container.querySelectorAll('line[data-legende]')
    expect(legend).toHaveLength(3)
    for (const l of Array.from(legend))
      expect(l.getAttribute('stroke')).toMatch(/^var\(--series-[1-6]\)$/)
  })

  it('AK-5: ab dem sechsten Konto wiederholen sich die Serienfarben', () => {
    const six: AccountSeries[] = Array.from({ length: 6 }, (_, k) => ({
      accountId: `k${k}`,
      name: `Konto ${k}`,
      include: true,
      values: [100, 200, 300, 400],
    }))
    const { container } = render(<WealthChart points={points} accounts={six} money={money} />)
    expect(lines(container, 'k4')[0]).toHaveAttribute('stroke', 'var(--series-6)')
    expect(lines(container, 'k5')[0]).toHaveAttribute('stroke', 'var(--series-2)')
  })

  it('AK-5: Kästchen lassen sich per Tastatur umschalten', async () => {
    const { user, container, getByRole } = show()
    const box = getByRole('checkbox', { name: 'Spar' })
    expect(box.tabIndex).toBe(0)
    box.focus()
    await user.keyboard('[Space]')
    expect(box).not.toBeChecked()
    expect(lines(container, 'b')).toHaveLength(0)
    await user.keyboard('[Space]')
    expect(box).toBeChecked()
    expect(lines(container, 'b')).toHaveLength(1)
  })

  it('AK-6: ein fehlender Monat bleibt eine Lücke in Konto- und Gesamtlinie', () => {
    const { container } = render(
      <WealthChart points={gapPoints} accounts={gapAccounts} money={money} />,
    )
    expect(lines(container, 'a')).toHaveLength(2)
    expect(dots(container, 'a')).toHaveLength(4)
    expect(lines(container, 'gesamt')).toHaveLength(2)
    expect(dots(container, 'gesamt')).toHaveLength(4)
    noBrokenNumbers(container.innerHTML)
  })

  it('AK-6: Beschriftung und Tooltip zeigen für das Konto «keine Angabe»', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <WealthChart points={gapPoints} accounts={gapAccounts} money={money} />,
    )
    const rect = container.querySelectorAll('rect[tabindex="0"]')[2]
    expect(rect.getAttribute('aria-label')).toBe(
      'August 2026: Gesamtvermögen unvollständig, 1 Konto ohne Angabe, bisher CHF 18.00; Privat keine Angabe',
    )
    await user.hover(rect)
    const tip = container.querySelector('[role="status"]')!
    expect(tip.textContent).toContain('Privat')
    expect(tip.textContent).toContain('keine Angabe')
    expect(tip.textContent).toContain('unvollständig (1 ohne Angabe)')
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

describe('SettlementChart', { tags: ['negativ'] }, () => {
  const persons = [
    { id: 'a', name: 'Anna' },
    { id: 'b', name: 'Ben' },
  ]
  const row = (month: string, personId: string, paid: number, received: number) => ({
    month,
    personId,
    paid,
    received,
  })
  it('zeigt je Person Säulen und im Tooltip Name, bezahlt und erhalten', async () => {
    const months = ['2026-09', '2026-10']
    const rows = [
      row('2026-09', 'a', 10_000, 0),
      row('2026-09', 'b', 0, 5_000),
      row('2026-10', 'a', 0, 0),
      row('2026-10', 'b', 0, 0),
    ]
    const { container } = render(
      <SettlementChart months={months} persons={persons} rows={rows} money={money} />,
    )
    noBrokenNumbers(container.innerHTML)
    await userEvent.setup().hover(container.querySelectorAll('rect[tabindex="0"]')[0])
    const tip = container.querySelector('[role="status"]')!
    expect(tip.textContent).toContain('Anna')
    expect(tip.textContent).toContain('bezahlt CHF 100.00')
    expect(tip.textContent).toContain('erhalten CHF 50.00')
  })
  it('lauter Nullen und viele Monate ergeben keine kaputten Zahlen', () => {
    const months = Array.from(
      { length: 30 },
      (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
    )
    const rows = months.flatMap((m) => persons.map((p) => row(m, p.id, 0, 0)))
    const { container } = render(
      <SettlementChart months={months} persons={persons} rows={rows} money={money} />,
    )
    noBrokenNumbers(container.innerHTML)
  })
})
