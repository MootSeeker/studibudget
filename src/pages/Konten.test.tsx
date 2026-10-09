import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { addMonths, defaultSemesters } from '../domain/period'
import { Konten } from './Konten'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")
const NOW = '2026-10' // feste Uhr in beforeEach: 15. Oktober 2026 (Herbstsemester 2026/27)
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
  vi.useFakeTimers({ toFake: ['Date'] }) // nur die Uhr; Timer bleiben echt (waitFor)
  vi.setSystemTime(new Date('2026-10-15T12:00:00'))
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

afterEach(() => vi.useRealTimers())

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

  it('AK-1: Verlauf erscheint mit dem ersten Stand und zeigt Konto- und Gesamtlinie', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Neues Konto'), 'Privat')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await screen.findByLabelText('Name Konto Privat')
    expect(screen.getByText(/Sobald du einen Stand erfasst hast/)).toBeInTheDocument()
    setBalance('Privat', addMonths(NOW, -1), '1000')
    await waitFor(() =>
      expect(screen.queryByText(/Sobald du einen Stand erfasst hast/)).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('checkbox', { name: 'Gesamtvermögen' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Privat' })).toBeChecked()
    setBalance('Privat', NOW, '1500')
    await waitFor(() =>
      expect(
        screen.getByRole('img', {
          name: (n) => norm(n).startsWith(`${name(NOW)}: Gesamtvermögen CHF 1'500.00; Privat CHF`),
        }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('img', {
        name: (n) =>
          norm(n).startsWith(
            `${name(addMonths(NOW, -2))}: Gesamtvermögen keine Angaben; Privat keine Angabe`,
          ),
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

describe('Zeitraum (Issue #112)', () => {
  const kontoPrivat = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Neues Konto'), 'Privat')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await screen.findByLabelText('Name Konto Privat')
  }
  const monate = () =>
    Array.from(
      screen
        .getByRole('region', { name: 'Kontostände pro Monatsende' })
        .querySelectorAll('tbody th'),
    ).map((th) => th.textContent)

  it('AK-1 (#112): Auswahl Zeitraum hat genau sechs Einträge', async () => {
    const user = await setup()
    expect(screen.queryByLabelText('Zeitraum')).not.toBeInTheDocument()
    await kontoPrivat(user)
    const select = screen.getByLabelText('Zeitraum')
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Semester', 'Halbjahr', 'Year to date', 'Jahr', '5 Jahre', 'Max. Aufnahme'])
  })

  it('AK-5 (#112): beim ersten Öffnen ist Semester gewählt', async () => {
    const user = await setup()
    await kontoPrivat(user)
    expect(screen.getByLabelText('Zeitraum')).toHaveDisplayValue('Semester')
    expect(
      screen.getByText('Herbstsemester 2026/27 · August 2026 bis Januar 2027'),
    ).toBeInTheDocument()
    expect(monate()).toEqual([
      'August 2026',
      'September 2026',
      'Oktober 2026',
      'November 2026',
      'Dezember 2026',
      'Januar 2027',
    ])
  })

  it('AK-2 (#112): Tabelle und Verlauf zeigen die Monate des gewählten Zeitraums', async () => {
    const user = await setup()
    await kontoPrivat(user)
    await user.selectOptions(screen.getByLabelText('Zeitraum'), '5 Jahre')
    setBalance('Privat', '2024-03', '100')
    setBalance('Privat', NOW, '200')
    await waitFor(() =>
      expect(screen.getByLabelText(`Stand Privat ${name('2024-03')}`)).toHaveValue('100.00'),
    )
    await waitFor(() =>
      expect(screen.getByLabelText(`Stand Privat ${name(NOW)}`)).toHaveValue('200.00'),
    )
    const faelle: [string, string, string, number][] = [
      ['Semester', 'August 2026', 'Januar 2027', 6],
      ['Halbjahr', 'Juli 2026', 'Dezember 2026', 6],
      ['Year to date', 'Januar 2026', 'Oktober 2026', 10],
      ['Jahr', 'Januar 2026', 'Dezember 2026', 12],
      ['5 Jahre', 'November 2021', 'Oktober 2026', 60],
      ['Max. Aufnahme', 'März 2024', 'Oktober 2026', 32],
    ]
    for (const [eintrag, von, bis, anzahl] of faelle) {
      await user.selectOptions(screen.getByLabelText('Zeitraum'), eintrag)
      const m = monate()
      expect(m, eintrag).toHaveLength(anzahl)
      expect(m[0], eintrag).toBe(von)
      expect(m[anzahl - 1], eintrag).toBe(bis)
      expect(
        screen.getByLabelText(`Vermögensverlauf pro Monatsende, ${von} bis ${bis}`),
      ).toBeInTheDocument()
    }
  })

  it(
    'AK-3 (#112): Pfeile verschieben den Zeitraum ohne doppelte oder fehlende Monate',
    { tags: ['regression'] },
    async () => {
      const user = await setup()
      await kontoPrivat(user)
      await user.click(screen.getByRole('button', { name: 'Vorheriger Zeitraum' }))
      expect(
        screen.getByText('Frühjahrssemester 2026 · Februar 2026 bis Juli 2026'),
      ).toBeInTheDocument()
      expect(monate()).toHaveLength(6)
      await user.click(screen.getByRole('button', { name: 'Nächster Zeitraum' }))
      await user.click(screen.getByRole('button', { name: 'Nächster Zeitraum' }))
      expect(
        screen.getByText('Frühjahrssemester 2027 · Februar 2027 bis Juli 2027'),
      ).toBeInTheDocument()
      await user.selectOptions(screen.getByLabelText('Zeitraum'), 'Year to date')
      expect(screen.getByText('Year to date · Januar 2026 bis Oktober 2026')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Vorheriger Zeitraum' }))
      expect(screen.getByText('Year to date · März 2025 bis Dezember 2025')).toBeInTheDocument()
      expect(monate()).toHaveLength(10)
      await user.selectOptions(screen.getByLabelText('Zeitraum'), '5 Jahre')
      await user.click(screen.getByRole('button', { name: 'Vorheriger Zeitraum' }))
      expect(screen.getByText('5 Jahre · November 2016 bis Oktober 2021')).toBeInTheDocument()
      expect(monate()).toHaveLength(60)
    },
  )
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
