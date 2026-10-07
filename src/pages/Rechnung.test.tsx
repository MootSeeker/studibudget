import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { defaultSemesters } from '../domain/period'
import { buildSharedEqual } from '../domain/split'
import { Rechnung } from './Rechnung'

async function setup(withBank: boolean) {
  await db.wipe()
  await completeOnboarding(db, {
    country: 'CH',
    living: 'wg',
    hasCar: false,
    partnerSharePct: 50,
    persons: ['Anna'],
    semesters: defaultSemesters('CH'),
    budgets: {},
  })
  const anna = (await db.persons.toArray())[0]
  const cat = (await db.categories.toArray())[0]
  const shared = buildSharedEqual(200000, 'me', ['me', anna.id])
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date: '2026-10-01',
    categoryId: cat.id,
    amountCents: 200000,
    myAmountCents: 100000,
    note: 'Miete',
    shared,
  } as never)
  if (withBank) {
    const s = (await db.settings.toArray())[0]
    await store.put('settings', {
      ...s,
      bank: {
        holder: 'Kevin Muster',
        street: 'Weg 1',
        zip: '8000',
        town: 'Zürich',
        country: 'CH',
        iban: 'CH9300762011623852957',
      },
    } as never)
  }
  return anna.id
}
const renderAt = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/ausgleich/rechnung/${id}`]}>
      <Routes>
        <Route path="/ausgleich/rechnung/:personId" element={<Rechnung />} />
      </Routes>
    </MemoryRouter>,
  )

describe('Rechnung', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('zeigt Position, Total, Name und Bankverbindung', async () => {
    const id = await setup(true)
    renderAt(id)
    expect(await screen.findByText('Miete')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Total/ }).textContent).toMatch(/1.?000\.00/)
    expect(screen.getByText(/An: Anna/)).toBeInTheDocument()
    expect(screen.getByText(/Kevin Muster/)).toBeInTheDocument()
    expect(screen.getByText(/CH93 0076 2011 6238 5295 7/)).toBeInTheDocument()
  })

  it('zeigt ohne Bankverbindung einen Hinweis mit Link und ändert keine Daten', async () => {
    const id = await setup(false)
    const before = await db.settlements.count()
    renderAt(id)
    expect(await screen.findByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/einstellungen',
    )
    expect(await db.settlements.count()).toBe(before)
  })

  it('öffnet den Druckdialog', async () => {
    const id = await setup(true)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderAt(id)
    ;(await screen.findByRole('button', { name: /Drucken oder als PDF/ })).click()
    expect(print).toHaveBeenCalled()
  })
})
