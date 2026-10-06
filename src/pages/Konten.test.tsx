import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { addMonths, currentMonth, defaultSemesters } from '../domain/period'
import { Konten } from './Konten'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")
const NOW = currentMonth()
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]
const name = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

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
})

async function setup() {
  const user = userEvent.setup()
  render(<Konten />)
  await screen.findByRole('heading', { level: 1, name: /Konten/ })
  return user
}
const setBalance = (account: string, month: string, value: string) => {
  const input = screen.getByLabelText(`Stand ${account} ${name(month)}`)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
const totalOf = (month: string) =>
  norm(
    screen.getByText(name(month), { selector: 'th' }).closest('tr')!.lastElementChild!.textContent,
  )

describe('Konten', () => {
  it('Vorschläge übernehmen legt fünf Konten an', async () => {
    const user = await setup()
    await user.click(screen.getByRole('button', { name: 'Vorschläge übernehmen' }))
    await screen.findByLabelText('Name Konto Privatkonto')
    expect((await db.accounts.toArray()).map((a) => a.name).sort()).toEqual([
      'Bargeld',
      'Depot',
      'Kreditkarte',
      'Privatkonto',
      'Sparkonto',
    ])
    expect((await db.accounts.toArray()).find((a) => a.name === 'Kreditkarte')!.kind).toBe('schuld')
  })

  it('Stände eintragen: Gesamt summiert, Schulden werden abgezogen, leer = unbekannt', async () => {
    const user = await setup()
    await user.click(screen.getByRole('button', { name: 'Vorschläge übernehmen' }))
    await screen.findByLabelText('Name Konto Privatkonto')
    setBalance('Privatkonto', NOW, '1000')
    setBalance('Sparkonto', NOW, "5'000")
    await waitFor(() => expect(totalOf(NOW)).toMatch(/CHF 6'000\.00/))
    expect(totalOf(NOW)).toMatch(/unvollständig/) // Bargeld, Kreditkarte, Depot fehlen noch
    setBalance('Bargeld', NOW, '0') // 0 ist eine Angabe
    setBalance('Kreditkarte', NOW, '250')
    setBalance('Depot', NOW, '1500')
    await waitFor(() => expect(totalOf(NOW)).toMatch(/CHF 7'250\.00/)) // 1000 + 5000 + 0 − 250 + 1500
    expect(totalOf(NOW)).not.toMatch(/unvollständig/)
    const karte = (await db.accounts.toArray()).find((a) => a.name === 'Kreditkarte')!
    expect(
      (await db.accountBalances.toArray()).find((b) => b.accountId === karte.id)!.amountCents,
    ).toBe(-25000)
    expect(screen.getByLabelText(`Stand Kreditkarte ${name(NOW)}`)).toHaveValue('250.00') // Anzeige positiv
  })

  it('Stand als Rechnung: 1000+500 speichert 1500 (#88)', async () => {
    const user = await setup()
    await user.click(screen.getByRole('button', { name: 'Vorschläge übernehmen' }))
    await screen.findByLabelText('Name Konto Privatkonto')
    setBalance('Privatkonto', NOW, '1000+500')
    await waitFor(() => expect(totalOf(NOW)).toMatch(/CHF 1'500\.00/))
    setBalance('Privatkonto', NOW, '1000/0')
    expect(await screen.findByRole('alert')).toHaveTextContent('kein gültiger Betrag')
  })

  it('Feld leeren löscht die Angabe, ungültige Eingabe zeigt einen Fehler', async () => {
    const user = await setup()
    await user.click(screen.getByRole('button', { name: 'Vorschläge übernehmen' }))
    await screen.findByLabelText('Name Konto Privatkonto')
    setBalance('Privatkonto', NOW, '100')
    await waitFor(() => expect(totalOf(NOW)).toMatch(/CHF 100\.00/))
    setBalance('Privatkonto', NOW, '')
    await waitFor(() => expect(totalOf(NOW)).toBe('–'))
    setBalance('Privatkonto', NOW, 'abc')
    expect(await screen.findByRole('alert')).toHaveTextContent('kein gültiger Betrag')
  })

  it('nicht gezählte Konten gehen nicht ins Gesamtvermögen ein', async () => {
    const user = await setup()
    await user.click(screen.getByRole('button', { name: 'Vorschläge übernehmen' }))
    await screen.findByLabelText('Name Konto Privatkonto')
    setBalance('Privatkonto', NOW, '100')
    setBalance('Depot', NOW, '900')
    await user.click(
      within(screen.getByLabelText('Name Konto Depot').closest('li')!).getByLabelText(
        'im Gesamtvermögen',
      ),
    )
    await waitFor(() => expect(screen.getByText('(nicht gezählt)')).toBeInTheDocument())
  })

  it('Vermögensverlauf braucht zwei vollständige Monate, zeigt dann das Diagramm mit Werten', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Neues Konto'), 'Privat')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await screen.findByLabelText('Name Konto Privat')
    expect(screen.getByText(/mindestens zwei Monate/)).toBeInTheDocument()
    setBalance('Privat', addMonths(NOW, -1), '1000')
    setBalance('Privat', NOW, '1500')
    await waitFor(() =>
      expect(screen.queryByText(/mindestens zwei Monate/)).not.toBeInTheDocument(),
    )
    const pt = screen.getByRole('img', {
      name: (n) => norm(n).includes(`${name(NOW)}: Gesamtvermögen CHF 1'500.00`),
    })
    expect(pt).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: (n) => norm(n).startsWith(`${name(addMonths(NOW, -2))}: keine Angaben`),
      }),
    ).toBeInTheDocument()
  })

  it('Konto löschen entfernt es samt Ständen', async () => {
    window.confirm = () => true
    const user = await setup()
    await user.type(screen.getByLabelText('Neues Konto'), 'Privat')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await screen.findByLabelText('Name Konto Privat')
    setBalance('Privat', NOW, '10')
    await waitFor(async () => expect(await db.accountBalances.count()).toBe(1))
    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    await waitFor(() =>
      expect(screen.queryByLabelText('Name Konto Privat')).not.toBeInTheDocument(),
    )
    expect((await db.accountBalances.toArray()).every((b) => b.deleted)).toBe(true)
  })
})

describe('Sparziele', () => {
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string,
    target: string,
    date = '',
    start = '',
  ) => {
    await user.type(screen.getByLabelText('Name'), name)
    await user.type(screen.getByLabelText('Zielbetrag'), target)
    if (date)
      fireEvent.change(screen.getByLabelText('Zieldatum (optional)'), { target: { value: date } })
    if (start) await user.type(screen.getByLabelText('Anfangsbestand (optional)'), start)
    await user.click(screen.getByRole('button', { name: 'Sparziel anlegen' }))
  }
  const saveTx = async (
    goalId: string,
    cents: number,
    dir: 'einzahlung' | 'entnahme' = 'einzahlung',
  ) => {
    const cat = (await db.categories.toArray()).find((c) => c.catalogKey === 'notgroschen')!
    await store.put('transactions', {
      id: newId(),
      deleted: false,
      date: `${NOW}-05`,
      categoryId: cat.id,
      amountCents: cents,
      myAmountCents: cents,
      note: '',
      goalId,
      goalDirection: dir,
    })
  }

  it('legt ein Ziel an und zeigt Fortschritt aus Spar-Buchungen (Entnahmen zählen negativ)', async () => {
    const user = await setup()
    await fill(user, 'Ferien', '1000', '', '100')
    const card = (await screen.findByLabelText('Name Sparziel Ferien')).closest('li')!
    expect(norm(card.textContent)).toMatch(/CHF 100\.00 von CHF 1'000\.00/)
    const goal = (await db.goals.toArray())[0]
    await saveTx(goal.id, 30000)
    await saveTx(goal.id, 5000, 'entnahme')
    await waitFor(() => expect(norm(card.textContent)).toMatch(/CHF 350\.00 von CHF 1'000\.00/))
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '35')
    expect(norm(card.textContent)).toMatch(/Noch CHF 650\.00/)
  })

  it('mit Zieldatum: nötige Monatsrate bis zum Zielmonat', async () => {
    const user = await setup()
    const target = addMonths(NOW, 3) // Zielmonat inklusive: heute + 3 Monate = 4 Raten
    await fill(user, 'Reise', '1000', `${target}-15`)
    const card = (await screen.findByLabelText('Name Sparziel Reise')).closest('li')!
    expect(norm(card.textContent)).toMatch(/nötig: CHF 250\.00 pro Monat bis /)
  })

  it('erreichtes und überfälliges Ziel', async () => {
    const user = await setup()
    await fill(user, 'Alt', '100', `${addMonths(NOW, -2)}-01`)
    const alt = (await screen.findByLabelText('Name Sparziel Alt')).closest('li')!
    expect(alt).toHaveTextContent('Zieldatum vorbei, noch')
    const goal = (await db.goals.toArray())[0]
    await saveTx(goal.id, 10000)
    await waitFor(() => expect(alt).toHaveTextContent('Ziel erreicht'))
  })

  it('Fehler bei ungültigen Angaben; Archivieren blendet aus', async () => {
    const user = await setup()
    await fill(user, 'X', 'abc')
    expect(await screen.findByRole('alert')).toHaveTextContent('gültige Beträge')
    await user.clear(screen.getByLabelText('Zielbetrag'))
    await user.clear(screen.getByLabelText('Name'))
    await fill(user, 'Technik', '800')
    const card = (await screen.findByLabelText('Name Sparziel Technik')).closest('li')!
    await user.click(within(card).getByRole('button', { name: 'Archivieren' }))
    await waitFor(() =>
      expect(screen.queryByLabelText('Name Sparziel Technik')).not.toBeInTheDocument(),
    )
    await user.click(screen.getByLabelText('Archivierte anzeigen'))
    expect(await screen.findByLabelText('Name Sparziel Technik')).toBeInTheDocument()
  })
})
