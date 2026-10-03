import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding, type OnboardingInput } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { defaultSemesters } from '../domain/period'
import { buildSharedEqual, buildSharedPartner } from '../domain/split'
import { Ausgleich } from './Ausgleich'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")

const wg: OnboardingInput = {
  country: 'CH',
  living: 'wg',
  hasCar: false,
  partnerSharePct: 50,
  persons: ['Anna', 'Ben'],
  semesters: defaultSemesters('CH'),
  budgets: {},
}

async function onboard(input: OnboardingInput = wg) {
  await db.wipe()
  await completeOnboarding(db, input)
}
const personId = async (name: string) =>
  (await db.persons.toArray()).find((p) => p.name === name)!.id
async function book(
  total: number,
  paidBy: 'me' | string,
  who: string[],
  note = '',
  date = '2026-10-01',
) {
  const cat =
    (await db.categories.toArray()).find(
      (c) => c.catalogKey === 'einkauf' || c.catalogKey === 'kostgeld',
    ) ?? (await db.categories.toArray())[0]
  const shared = buildSharedEqual(total, paidBy, who)
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date,
    categoryId: cat.id,
    amountCents: total,
    myAmountCents: shared.parts.find((p) => p.who === 'me')?.cents ?? 0,
    note,
    shared,
  })
}

async function setup() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <Ausgleich />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Ausgleich' })
  return user
}
const card = (name: string) => screen.getByText(name, { selector: 'p.font-medium' }).closest('li')!

beforeEach(() => onboard())

describe('Salden', () => {
  it('Anna schuldet mir, ich schulde Ben, ausgeglichene Personen werden so benannt', async () => {
    const [anna, ben] = [await personId('Anna'), await personId('Ben')]
    await book(9000, 'me', ['me', anna, ben]) // Anna +30, Ben +30
    await book(4000, ben, ['me', ben]) // Ben −20 → +10
    await setup()
    await waitFor(() =>
      expect(norm(card('Anna').textContent)).toMatch(/Anna schuldet dir CHF 30\.00\./),
    )
    expect(norm(card('Ben').textContent)).toMatch(/Ben schuldet dir CHF 10\.00\./)
    await book(2000, anna, ['me', anna]) // Anna −10 → +20
    await waitFor(() => expect(norm(card('Anna').textContent)).toMatch(/schuldet dir CHF 20\.00/))
  })

  it('«Du schuldest …» und «ausgeglichen»', async () => {
    const anna = await personId('Anna')
    await book(6000, anna, ['me', anna])
    await setup()
    await waitFor(() =>
      expect(norm(card('Anna').textContent)).toMatch(/Du schuldest Anna CHF 30\.00\./),
    )
    expect(norm(card('Ben').textContent)).toMatch(/Mit Ben bist du ausgeglichen\./)
    expect(
      within(card('Ben')).queryByRole('button', { name: /ausgleichen/ }),
    ).not.toBeInTheDocument()
  })

  it('Partner/in mit 60/40: sie schuldet mir ihren Anteil', async () => {
    await onboard({ ...wg, living: 'partner', persons: ['Mia'], partnerSharePct: 60 })
    const mia = await personId('Mia')
    const cat = (await db.categories.toArray())[0]
    const shared = buildSharedPartner(10000, 'me', mia, 60)
    await store.put('transactions', {
      id: newId(),
      deleted: false,
      date: '2026-10-01',
      categoryId: cat.id,
      amountCents: 10000,
      myAmountCents: 6000,
      note: '',
      shared,
    })
    await setup()
    await waitFor(() =>
      expect(norm(card('Mia').textContent)).toMatch(/Mia schuldet dir CHF 40\.00\./),
    )
  })

  it('inaktive Person erscheint nur, solange noch etwas offen ist', async () => {
    const anna = await personId('Anna')
    await book(4000, 'me', ['me', anna])
    const a = (await db.persons.toArray()).find((p) => p.id === anna)!
    const { updatedAt: _u, ...rest } = a
    await store.put('persons', { ...rest, active: false })
    await setup()
    await waitFor(() => expect(norm(card('Anna').textContent)).toMatch(/inaktiv/))
    expect(screen.queryByText('Ben', { selector: 'p.font-medium' })).toBeTruthy() // aktiv, ausgeglichen
  })
})

describe('inaktive Personen ohne offenen Betrag', () => {
  it('sind ausgeblendet', async () => {
    const anna = (await db.persons.toArray()).find((p) => p.name === 'Anna')!
    const { updatedAt: _u, ...rest } = anna
    await store.put('persons', { ...rest, active: false })
    await setup()
    await screen.findByText('Ben', { selector: 'p.font-medium' })
    expect(screen.queryByText('Anna', { selector: 'p.font-medium' })).not.toBeInTheDocument()
  })
})

describe('Ausgleichszahlung', () => {
  it('«Ausgleichen» füllt das Formular vor; Speichern gleicht den Saldo aus', async () => {
    const anna = await personId('Anna')
    await book(6000, 'me', ['me', anna]) // Anna schuldet 30
    const user = await setup()
    await user.click(await screen.findByRole('button', { name: 'Anna ausgleichen' }))
    const form = within(screen.getByRole('form', { name: 'Ausgleichszahlung erfassen' }))
    expect(form.getByLabelText('Person')).toHaveValue(anna)
    expect(form.getByLabelText('Was ist passiert?')).toHaveValue('ich_erhalte')
    expect(form.getByLabelText(/Betrag/)).toHaveValue('30.00')
    expect(norm(form.getByText(/Danach:/).textContent)).toMatch(/Mit Anna bist du ausgeglichen/)
    await user.click(form.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(norm(card('Anna').textContent)).toMatch(/ausgeglichen/))
    const [s] = await db.settlements.toArray()
    expect(s).toMatchObject({
      personId: anna,
      direction: 'ich_erhalte',
      amountCents: 3000,
      deleted: false,
    })
    expect(await screen.findByText(/Du hast von Anna CHF 30\.00 erhalten/)).toBeInTheDocument()
  })

  it('ich schulde Ben: Vorschlag «Ich habe Geld bezahlt»; Teilzahlung lässt einen Rest', async () => {
    const ben = await personId('Ben')
    await book(8000, ben, ['me', ben]) // ich schulde 40
    const user = await setup()
    await user.click(await screen.findByRole('button', { name: 'Ben ausgleichen' }))
    const form = within(screen.getByRole('form', { name: 'Ausgleichszahlung erfassen' }))
    expect(form.getByLabelText('Was ist passiert?')).toHaveValue('ich_zahle')
    const amount = form.getByLabelText(/Betrag/)
    await user.clear(amount)
    await user.type(amount, '15')
    expect(norm(form.getByText(/Danach:/).textContent)).toMatch(/Du schuldest Ben CHF 25\.00/)
    await user.click(form.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(norm(card('Ben').textContent)).toMatch(/Du schuldest Ben CHF 25\.00/),
    )
  })

  it('Überzahlung kehrt den Saldo um (und die Vorschau zeigt es vorher)', async () => {
    const anna = await personId('Anna')
    await book(6000, 'me', ['me', anna]) // Anna schuldet 30
    const user = await setup()
    const form = within(screen.getByRole('form', { name: 'Ausgleichszahlung erfassen' }))
    await user.selectOptions(form.getByLabelText('Person'), 'Anna')
    await user.type(form.getByLabelText(/Betrag/), '50')
    expect(norm(form.getByText(/Danach:/).textContent)).toMatch(/Du schuldest Anna CHF 20\.00/)
  })

  it('prüft die Eingaben', async () => {
    const user = await setup()
    const form = within(screen.getByRole('form', { name: 'Ausgleichszahlung erfassen' }))
    await user.click(form.getByRole('button', { name: 'Speichern' }))
    expect(form.getByRole('alert')).toHaveTextContent('Person')
    await user.selectOptions(form.getByLabelText('Person'), 'Anna')
    await user.click(form.getByRole('button', { name: 'Speichern' }))
    expect(form.getByRole('alert')).toHaveTextContent('gültigen Betrag')
    await user.type(form.getByLabelText(/Betrag/), '0')
    await user.click(form.getByRole('button', { name: 'Speichern' }))
    expect(form.getByRole('alert')).toHaveTextContent('grösser als 0')
    expect(await db.settlements.count()).toBe(0)
  })

  it('Löschen einer Zahlung stellt den Saldo wieder her', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const anna = await personId('Anna')
    await book(6000, 'me', ['me', anna])
    await store.put('settlements', {
      id: newId(),
      deleted: false,
      date: '2026-10-05',
      personId: anna,
      direction: 'ich_erhalte',
      amountCents: 3000,
      note: '',
    })
    const user = await setup()
    await waitFor(() => expect(norm(card('Anna').textContent)).toMatch(/ausgeglichen/))
    await user.click(
      screen.getByRole('button', { name: /Ausgleichszahlung vom 05\.10\.2026 löschen/ }),
    )
    await waitFor(() =>
      expect(norm(card('Anna').textContent)).toMatch(/Anna schuldet dir CHF 30\.00/),
    )
    expect((await db.settlements.toArray())[0].deleted).toBe(true)
  })
})

describe('Gemeinsame Buchungen', () => {
  it('listet nur geteilte Buchungen mit Wirkung, filterbar nach Person', async () => {
    const [anna, ben] = [await personId('Anna'), await personId('Ben')]
    await book(6000, 'me', ['me', anna], 'Putzmittel')
    await book(9000, ben, ['me', ben], 'Pizza')
    const cat = (await db.categories.toArray())[0]
    await store.put('transactions', {
      id: newId(),
      deleted: false,
      date: '2026-10-02',
      categoryId: cat.id,
      amountCents: 999,
      myAmountCents: 999,
      note: 'Privat',
    })
    const user = await setup()
    await screen.findByText(/Putzmittel/)
    expect(screen.getByText(/Pizza/)).toBeInTheDocument()
    expect(screen.queryByText(/Privat/)).not.toBeInTheDocument()
    expect(norm(screen.getByText(/Putzmittel/).closest('li')!.textContent)).toMatch(
      /Bezahlt von dir.*Anna schuldet dir CHF 30\.00/,
    )
    expect(norm(screen.getByText(/Pizza/).closest('li')!.textContent)).toMatch(
      /Bezahlt von Ben.*du schuldest Ben CHF 45\.00/,
    )
    await user.selectOptions(screen.getByLabelText('Gemeinsame Buchungen filtern'), 'Anna')
    expect(screen.queryByText(/Pizza/)).not.toBeInTheDocument()
    expect(screen.getByText(/Putzmittel/)).toBeInTheDocument()
  })
})

describe('ohne geteilte Kosten', () => {
  it('bei «allein» gibt es nur einen Hinweis mit Link zu den Einstellungen', async () => {
    await onboard({ ...wg, living: 'allein', persons: [] })
    render(
      <MemoryRouter>
        <Ausgleich />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/nur, wenn du in einer WG oder mit Partner/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/einstellungen',
    )
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
})
