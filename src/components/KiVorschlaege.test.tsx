import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { store } from '../data/store'
import { defaultSemesters } from '../domain/period'
import type { Category } from '../domain/types'
import { KI_HINWEIS_KEY, KiVorschlaege } from './KiVorschlaege'

beforeEach(async () => {
  await db.wipe()
  localStorage.clear()
  await completeOnboarding(db, {
    country: 'CH',
    living: 'wg',
    hasCar: false,
    partnerSharePct: 50,
    persons: ['Anna'],
    semesters: defaultSemesters('CH'),
    budgets: {},
  })
})

async function setup(bestaetigt = true) {
  if (bestaetigt) localStorage.setItem(KI_HINWEIS_KEY, '1')
  const cats = (await db.categories.toArray()).filter((c) => !c.deleted) as Category[]
  const einkauf = cats.find((c) => c.name === 'Einkauf zuhause')!
  render(<KiVorschlaege categories={cats} />)
  return { user: userEvent.setup(), einkauf }
}

async function einfuegen(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByLabelText('Vorschlagstext'))
  await user.paste(text)
  await user.click(screen.getByRole('button', { name: 'Vorschläge prüfen' }))
}

const block = (eintraege: unknown[]) => JSON.stringify({ studibudgetVorschlaege: 1, eintraege })
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const E = {
  id: U1,
  date: '2026-10-09',
  amountCents: 1850,
  categoryName: 'Einkauf zuhause',
  note: 'Mittagessen',
}

describe('KiVorschlaege', () => {
  it('AK-1: Hinweis muss vor dem Einfügen bestätigt werden', async () => {
    const { user } = await setup(false)
    expect(
      screen.getByText(/nicht von der Verschlüsselung von StudiBudget geschützt/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Vorschlagstext')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Verstanden' }))
    expect(screen.getByLabelText('Vorschlagstext')).toBeInTheDocument()
    expect(localStorage.getItem(KI_HINWEIS_KEY)).toBe('1')
  })

  it('AK-1: bestätigter Hinweis erscheint nicht noch einmal', async () => {
    await setup(true)
    expect(screen.getByLabelText('Vorschlagstext')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verstanden' })).toBeNull()
  })

  it('AK-2: zeigt jeden Eintrag als Vorschlag und bucht nichts', async () => {
    const { user, einkauf } = await setup()
    await einfuegen(user, block([E, { ...E, id: U2, note: 'Znacht' }]))
    const v1 = within(await screen.findByRole('listitem', { name: 'Vorschlag 1' }))
    expect(screen.getByRole('listitem', { name: 'Vorschlag 2' })).toBeInTheDocument()
    expect(v1.getByLabelText('Datum')).toHaveValue('2026-10-09')
    expect(v1.getByLabelText('Betrag')).toHaveValue('18.50')
    expect(v1.getByLabelText('Kategorie')).toHaveValue(einkauf.id)
    expect(v1.getByLabelText('Notiz')).toHaveValue('Mittagessen')
    expect(await db.transactions.count()).toBe(0)
  })

  it('AK-3: bestätigter Vorschlag wird mit seiner id über store gebucht', async () => {
    const { user, einkauf } = await setup()
    await einfuegen(user, block([E]))
    const v1 = within(await screen.findByRole('listitem', { name: 'Vorschlag 1' }))
    await user.clear(v1.getByLabelText('Betrag'))
    await user.type(v1.getByLabelText('Betrag'), '20.00')
    await user.clear(v1.getByLabelText('Notiz'))
    await user.type(v1.getByLabelText('Notiz'), 'Znacht')
    await user.click(v1.getByRole('button', { name: 'Buchen' }))
    expect(await db.transactions.count()).toBe(1)
    const t = (await db.transactions.get(U1))!
    expect(t.amountCents).toBe(2000)
    expect(t.myAmountCents).toBe(2000)
    expect(t.note).toBe('Znacht')
    expect(t.date).toBe('2026-10-09')
    expect(t.categoryId).toBe(einkauf.id)
    expect(t.updatedAt).toBeTruthy()
    expect(await db.outbox.count()).toBeGreaterThan(0)
    expect(screen.queryByRole('listitem', { name: 'Vorschlag 1' })).toBeNull()
    expect(screen.getByText('1 gebucht')).toBeInTheDocument()
  })

  it('AK-4: verworfener Vorschlag wird nicht gebucht', async () => {
    const { user } = await setup()
    await einfuegen(user, block([E]))
    const v1 = within(await screen.findByRole('listitem', { name: 'Vorschlag 1' }))
    await user.click(v1.getByRole('button', { name: 'Verwerfen' }))
    expect(screen.queryByRole('listitem', { name: 'Vorschlag 1' })).toBeNull()
    expect(await db.transactions.count()).toBe(0)
  })

  it('AK-5: zeigt pro ungültigem Eintrag den Grund und bucht ihn nicht', async () => {
    const { user } = await setup()
    await einfuegen(user, block([E, { ...E, id: U2, amountCents: 0 }]))
    await screen.findByRole('listitem', { name: 'Vorschlag 1' })
    expect(
      screen.getByText('Eintrag 2: Der Betrag muss eine ganze Zahl grösser 0 sein (in Rappen).'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'Vorschlag 2' })).toBeNull()
    await user.click(
      within(screen.getByRole('listitem', { name: 'Vorschlag 1' })).getByRole('button', {
        name: 'Buchen',
      }),
    )
    expect(await db.transactions.count()).toBe(1)
    expect(await db.transactions.get(U2)).toBeUndefined()
  })

  it('AK-5: zeigt den Fehler bei unlesbarem Text', async () => {
    const { user } = await setup()
    await einfuegen(user, 'hallo')
    expect(await screen.findByRole('alert')).toHaveTextContent('Kein Vorschlagstext gefunden')
    expect(screen.queryByRole('listitem', { name: 'Vorschlag 1' })).toBeNull()
  })

  it('AK-6: zweites Einfügen markiert gebuchte Einträge als schon erfasst', async () => {
    const { user } = await setup()
    await einfuegen(user, block([E]))
    await user.click(
      within(await screen.findByRole('listitem', { name: 'Vorschlag 1' })).getByRole('button', {
        name: 'Buchen',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Vorschläge prüfen' }))
    expect(await screen.findByText('Eintrag 1: schon erfasst')).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'Vorschlag 1' })).toBeNull()
    expect(await db.transactions.count()).toBe(1)
  })

  it('AK-6: gelöschte Buchung mit derselben id wird nicht zurückgeholt', async () => {
    const cats = (await db.categories.toArray()).filter((c) => !c.deleted)
    const einkauf = cats.find((c) => c.name === 'Einkauf zuhause')!
    await store.put('transactions', {
      id: U1,
      deleted: false,
      date: '2026-10-09',
      categoryId: einkauf.id,
      amountCents: 1850,
      myAmountCents: 1850,
      note: 'x',
    })
    await store.remove('transactions', U1)
    const { user } = await setup()
    await einfuegen(user, block([E]))
    expect(await screen.findByText('Eintrag 1: schon erfasst')).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'Vorschlag 1' })).toBeNull()
    expect((await db.transactions.get(U1))?.deleted).toBe(true)
  })
})
