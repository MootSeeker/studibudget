import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { addMonths, currentMonth, defaultSemesters } from '../domain/period'
import { Statistik } from './Statistik'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")
const NOW = currentMonth()
const prev = (n: number) => addMonths(NOW, -n)
const catByKey = async (key: string) =>
  (await db.categories.toArray()).find((c) => c.catalogKey === key)!

async function book(key: string, cents: number, month: string, day = '05', mine = cents) {
  const c = await catByKey(key)
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date: `${month}-${day}`,
    categoryId: c.id,
    amountCents: cents,
    myAmountCents: mine,
    note: '',
  })
}
async function budget(key: string, cents: number, from: string) {
  const c = await catByKey(key)
  await store.put('budgets', {
    id: newId(),
    deleted: false,
    categoryId: c.id,
    validFrom: from,
    amountCents: cents,
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
    budgets: {},
  })
  await budget('miete', 80000, prev(5))
  await budget('einkauf', 40000, prev(5))
  await book('lohn', 200000, prev(2), '01')
  await book('lohn', 200000, prev(1), '01')
  await book('miete', 80000, prev(2), '02')
  await book('miete', 80000, prev(1), '02')
  await book('einkauf', 25000, prev(2))
  await book('einkauf', 60000, prev(1))
  await book('notgroschen', 10000, prev(1))
})

async function setup() {
  const user = userEvent.setup()
  render(<Statistik />)
  await screen.findByRole('heading', { level: 1, name: 'Statistik' })
  await user.selectOptions(screen.getByLabelText('Zeitraum'), 'Letzte 6 Monate')
  // Die Buchungen werden asynchron aus der Datenbank gelesen; erst wenn sie da sind, stimmen die Zahlen.
  await waitFor(() => expect(tile('Einnahmen')).toMatch(/CHF 4'000\.00/))
  return user
}
const tile = (label: string) =>
  norm(screen.getByText(label, { selector: 'dt' }).parentElement!.textContent)

describe('Statistik-Seite', () => {
  it('zeigt Kennzahlen für den gewählten Zeitraum', async () => {
    await setup()
    expect(tile('Einnahmen')).toMatch(/CHF 4'000\.00/)
    expect(tile('Ausgaben')).toMatch(/CHF 2'450\.00/) // 2×800 Miete + 250 + 600 Einkauf
    expect(tile('Gespart')).toMatch(/CHF 100\.00/)
    expect(tile('Saldo')).toMatch(/CHF 1'450\.00/) // 4000 − 2450 − 100
    expect(tile('Ø Ausgaben pro Monat')).toMatch(/CHF 408\.33/) // 2450 / 6
    expect(tile('Sparquote')).toMatch(/2,5 %|2\.5 %/)
  })

  it('teuerster Monat und Fixkostenanteil', async () => {
    await setup()
    expect(tile('Teuerster Monat')).toMatch(/CHF 1'400\.00/)
    expect(tile('Anteil Fixkosten')).toMatch(/\d+(,|\.)?\d* %/)
  })

  it('Ausgaben nach Bereich: Balken mit Betrag und Anteil, Kategorien klappen auf', async () => {
    const user = await setup()
    const bar = screen.getByRole('button', { name: /Lebensmittel/ })
    expect(norm(bar.textContent)).toMatch(/CHF 850\.00/)
    expect(bar).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Einkauf zuhause', { selector: 'span' })).not.toBeInTheDocument()
    await user.click(bar)
    expect(bar).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Einkauf zuhause', { selector: 'span' })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: (n) => norm(n) === 'Einkauf zuhause: CHF 850.00' }),
    ).toBeInTheDocument()
  })

  it('Verlauf pro Monat: ein Treffer-Bereich je Monat mit allen Werten, Tooltip bei Fokus, Legende und Tabelle', async () => {
    const user = await setup()
    const months = screen.getAllByRole('img', { name: /Einnahmen .*, Ausgaben .*, Saldo/ })
    expect(months).toHaveLength(6)
    const lastButOne = months[4]
    expect(norm(lastButOne.getAttribute('aria-label'))).toMatch(
      /Einnahmen CHF 2'000\.00, Ausgaben CHF 1'400\.00, Saldo CHF 500\.00/,
    )
    lastButOne.focus()
    expect(await screen.findByRole('status')).toHaveTextContent(/Einnahmen/)
    const legend = screen.getByRole('list', { name: 'Legende' })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Einnahmen', 'Ausgaben', 'Saldo'])
    const [, tableToggle] = screen.getAllByText('Als Tabelle anzeigen')
    await user.click(tableToggle)
    const table = tableToggle.closest('details')!.querySelector('table')!
    expect(within(table).getAllByRole('row')).toHaveLength(7) // Kopf + 6 Monate
  })

  it('Plan vs. Ist: Summe der Monatsbudgets, Abweichung mit Wort und Vorzeichen', async () => {
    await setup()
    const table = screen.getByRole('table', { name: /Plan und Ist/ })
    // Einkauf: Plan 6 × 400 = 2400, Ist 850 → darunter
    expect(norm(within(table).getByText('Einkauf zuhause').closest('tr')!.textContent)).toMatch(
      /CHF 2'400\.00.*CHF 850\.00.*−CHF 1'550\.00 darunter/,
    )
    // Miete: Plan 6 × 800, Ist 1600
    expect(norm(within(table).getByText('Miete').closest('tr')!.textContent)).toMatch(
      /CHF 4'800\.00.*CHF 1'600\.00.*−CHF 3'200\.00 darunter/,
    )
  })

  it('Kategorien ohne Budget zeigen Plan 0 und «drüber»', async () => {
    await book('mensa', 5000, prev(1))
    await setup()
    const mensa = within(screen.getByRole('table', { name: /Plan und Ist/ }))
      .getByText('Mensa / Mittagessen')
      .closest('tr')!
    expect(norm(mensa.textContent)).toMatch(/CHF 0\.00.*CHF 50\.00.*\+CHF 50\.00 drüber/)
  })

  it('Frei wählbar: ungültiger Bereich zeigt Hinweis statt Zahlen', async () => {
    const user = await setup()
    await user.selectOptions(screen.getByLabelText('Zeitraum'), 'Frei wählbar')
    const from = screen.getByLabelText('Von')
    fireEvent.change(from, { target: { value: addMonths(NOW, 3) } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Start muss vor dem Ende')
  })

  it('Zeitraum verschieben: vorheriger Zeitraum ohne Daten zeigt Nullen und leere Hinweise', async () => {
    const user = await setup()
    await user.click(screen.getByRole('button', { name: 'Vorheriger Zeitraum' }))
    await user.click(screen.getByRole('button', { name: 'Vorheriger Zeitraum' }))
    expect(tile('Einnahmen')).toMatch(/CHF 0\.00/)
    expect(screen.getByText('In diesem Zeitraum gibt es keine Ausgaben.')).toBeInTheDocument()
    expect(screen.getByText(/weder Budget noch Buchungen/)).toBeInTheDocument()
  })

  it('Semester ist die Vorgabe und nennt den Zeitraum', async () => {
    render(<Statistik />)
    await screen.findByRole('heading', { level: 1, name: 'Statistik' })
    expect(await screen.findByText(/semester \d{4}/i)).toBeInTheDocument()
  })

  describe('Vermögen (Issue #52)', () => {
    async function konto(monate: [string, number][]) {
      const accountId = newId()
      await store.put('accounts', {
        id: accountId,
        deleted: false,
        name: 'Sparkonto',
        kind: 'bank',
        include: true,
        order: 0,
      })
      for (const [month, amountCents] of monate)
        await store.put('accountBalances', {
          id: newId(),
          deleted: false,
          accountId,
          month,
          amountCents,
        })
    }

    it('ohne Kontostände steht ein Hinweis statt der Grafik', async () => {
      const user = await setup()
      await user.selectOptions(screen.getByLabelText('Zeitraum'), 'Letzte 6 Monate')
      expect(
        await screen.findByText(/mindestens zwei Monate, in denen alle gezählten Konten/),
      ).toBeInTheDocument()
    })

    it('zeigt die Veränderung zwischen erstem und letztem vollständigen Monat', async () => {
      await konto([
        [prev(3), 100000],
        [prev(1), 130000],
      ])
      const user = await setup()
      await user.selectOptions(screen.getByLabelText('Zeitraum'), 'Letzte 6 Monate')
      const abschnitt = (await screen.findByRole('heading', { name: 'Vermögen' })).closest(
        'section',
      )!
      await waitFor(() => expect(norm(abschnitt.textContent)).toMatch(/\+CHF 300\.00/))
    })
  })
})
