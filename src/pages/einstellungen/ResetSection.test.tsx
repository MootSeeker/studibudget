import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { completeOnboarding } from '../../data/onboarding'
import { SETTINGS_ID } from '../../data/seed'
import { store } from '../../data/store'
import { defaultSemesters } from '../../domain/period'
import { ResetSection } from './ResetSection'

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

const CUTOFF = /Nur Einträge vor diesem Monat löschen \(freiwillig\)/

describe('Daten zurücksetzen: Stichtag (Issue #189)', () => {
  it('AK-2: Vorschau passt sich dem Stichtag an', async () => {
    for (const [id, date] of [
      ['cut-a', '2024-12-31'],
      ['cut-b', '2025-01-01'],
    ])
      await store.put('transactions', {
        id,
        deleted: false,
        date,
        categoryId: 'x',
        amountCents: 100,
        myAmountCents: 100,
        note: '',
      })
    const settings = (await db.settings.get(SETTINGS_ID))!
    const user = userEvent.setup()
    render(<ResetSection settings={settings} />)
    await user.click(screen.getByRole('button', { name: 'Zurücksetzen …' }))
    const d = within(await screen.findByRole('dialog', { name: 'Daten zurücksetzen' }))
    const buchungen = await d.findByRole('checkbox', { name: /Buchungen \(\d+\)/ })

    expect(d.queryByLabelText(CUTOFF)).not.toBeInTheDocument()
    await user.click(buchungen)
    expect(d.getByText(/Es werden 2 Einträge gelöscht\./)).toBeInTheDocument()

    const feld = d.getByLabelText(CUTOFF)
    fireEvent.change(feld, { target: { value: '2025-01' } })
    expect(d.getByText(/Es werden 1 Eintrag gelöscht\./)).toBeInTheDocument()
  })
})
