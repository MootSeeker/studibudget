import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { addMonths, currentMonth, defaultSemesters } from '../domain/period'
import { Monat } from './Monat'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")
const NOW = currentMonth()
const catByKey = async (key: string) =>
  (await db.categories.toArray()).find((c) => c.catalogKey === key)!

async function book(key: string, cents: number, day = '01', month = NOW, note = '') {
  const c = await catByKey(key)
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date: `${month}-${day}`,
    categoryId: c.id,
    amountCents: cents,
    myAmountCents: cents,
    note,
  })
}

beforeEach(async () => {
  await db.wipe()
  await completeOnboarding(db, {
    country: 'CH',
    living: 'allein',
    hasCar: false,
    partnerSharePct: 50,
    persons: [],
    semesters: defaultSemesters('CH'),
    budgets: { lohn: 200000, miete: 80000, einkauf: 40000, ausgang: 10000, notgroschen: 20000 },
  })
})

async function setup() {
  render(<Monat />)
  await screen.findByRole('heading', { level: 1, name: 'Monat' })
  await screen.findByText('Miete')
  return userEvent.setup()
}
const rowOf = (name: string) => screen.getByText(name, { selector: 'span' }).closest('li')!

describe('Monat-Seite', () => {
  it('zeigt Restbudget und Ampel pro Kategorie, mit Text und nicht nur Farbe', async () => {
    await book('miete', 80000)
    await book('einkauf', 33000) // 82.5 % → knapp
    await book('ausgang', 12000) // 120 % → überschritten
    await setup()
    expect(within(rowOf('Einkauf zuhause')).getByText('Knapp')).toBeInTheDocument()
    expect(norm(rowOf('Einkauf zuhause').textContent)).toMatch(/Noch CHF 70\.00/)
    expect(within(rowOf('Ausgang / Kino')).getByText('Überschritten')).toBeInTheDocument()
    expect(norm(rowOf('Ausgang / Kino').textContent)).toMatch(/CHF 20\.00 drüber/)
    expect(within(rowOf('Miete')).getByText('Ausgeschöpft')).toBeInTheDocument() // genau 100 % = rot, aber nicht überschritten
    expect(within(rowOf('Miete')).queryByText('Überschritten')).not.toBeInTheDocument()
    expect(within(rowOf('Miete')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('Einnahmen und Sparen zeigen den Fortschritt statt der Ampel', async () => {
    await book('lohn', 100000)
    await book('notgroschen', 5000)
    await setup()
    expect(within(rowOf('Nettolohn / Nebenjob')).getByText('50 %')).toBeInTheDocument()
    expect(within(rowOf('Notgroschen')).getByText('25 %')).toBeInTheDocument()
    expect(within(rowOf('Nettolohn / Nebenjob')).queryByText('Knapp')).not.toBeInTheDocument()
  })

  it('Kopf: Plan, Ist und Prognose; Saldo = Einnahmen − Ausgaben − Sparen', async () => {
    await book('lohn', 200000)
    await book('miete', 80000)
    await setup()
    const table = screen.getByRole('table')
    const saldo = within(table).getByRole('row', { name: /Saldo/ })
    const cells = within(saldo)
      .getAllByRole('cell')
      .map((c) => norm(c.textContent))
    expect(cells[0]).toBe('CHF 500.00') // Plan: 2000 − 800 − 400 − 100 − 200
    expect(cells[1]).toBe("CHF 1'200.00") // Ist: 2000 − 800
    expect(within(table).getByRole('row', { name: /Einnahmen/ })).toHaveTextContent(/2'?000\.00/)
  })

  it('Monatswechsel: vergangener Monat zeigt «Ergebnis», künftiger hat keine Prognose', async () => {
    await book('miete', 80000, '01', addMonths(NOW, -1))
    const user = await setup()
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    expect(await screen.findByRole('columnheader', { name: 'Ergebnis' })).toBeInTheDocument()
    expect(norm(rowOf('Miete').textContent)).toMatch(/CHF 800\.00/)
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(await screen.findByRole('columnheader', { name: 'Prognose' })).toBeInTheDocument()
    const ausgaben = within(screen.getByRole('table')).getByRole('row', { name: /Ausgaben/ })
    expect(within(ausgaben).getAllByRole('cell')[2]).toHaveTextContent('–')
  })

  it('Vergleich mit Vormonat und Durchschnitt, grösste Ausgaben und Buchungsliste', async () => {
    await book('einkauf', 30000, '05', addMonths(NOW, -1))
    await book('einkauf', 50000, '05', NOW, 'Grosseinkauf')
    await book('mensa', 1000, '06', NOW, 'Kaffee')
    await setup()
    const card = screen.getByText('Ausgaben im Vergleich').closest('div')!
    expect(norm(card.textContent)).toMatch(/CHF 510\.00/)
    expect(norm(card.textContent)).toMatch(/Vormonat: CHF 300\.00 \(\+CHF 210\.00\)/)
    expect(norm(card.textContent)).toMatch(/Ø letzte 3 Monate: CHF 300\.00/)
    const top = screen.getByText('Grösste Ausgaben').closest('div')!
    const items = within(top)
      .getAllByRole('listitem')
      .map((li) => norm(li.textContent))
    expect(items[0]).toMatch(/Grosseinkauf.*CHF 500\.00/)
    expect(items[1]).toMatch(/Kaffee.*CHF 10\.00/)
    expect(screen.getByText(/Alle Buchungen im .* \(2\)/)).toBeInTheDocument()
  })

  it('ohne Daten erscheint ein verständlicher Hinweis', async () => {
    await db.budgets.clear()
    render(<Monat />)
    expect(await screen.findByText(/weder Budget noch Buchungen/)).toBeInTheDocument()
  })
})
