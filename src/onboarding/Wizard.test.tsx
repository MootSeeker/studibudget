import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OnboardingInput } from '../data/onboarding'
import { Wizard } from './Wizard'

function setup() {
  const onFinish = vi.fn<(i: OnboardingInput) => Promise<void>>().mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(<Wizard onFinish={onFinish} />)
  return { onFinish, user, next: () => user.click(screen.getByRole('button', { name: 'Weiter' })) }
}

describe('Wizard', () => {
  it('führt in vier Schritten durch und liefert die Eingaben (CH, WG, Budget)', async () => {
    const { onFinish, user, next } = setup()
    expect(screen.getByText(/Schritt 1 von 4/)).toBeInTheDocument()
    await next()
    await user.click(screen.getByRole('radio', { name: /^WG/ }))
    await user.type(screen.getByLabelText('Mitbewohner/in 1'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Person hinzufügen' }))
    await user.type(screen.getByLabelText('Mitbewohner/in 2'), 'Ben')
    await next()
    expect(screen.getByLabelText('Name Semester 1')).toHaveValue('Herbstsemester')
    await next()
    await user.type(screen.getByLabelText('Budget Miete'), "1'200.50")
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1))
    const input = onFinish.mock.calls[0][0]
    expect(input).toMatchObject({
      country: 'CH',
      living: 'wg',
      hasCar: false,
      persons: ['Anna', 'Ben'],
    })
    expect(input.budgets).toEqual({ miete: 120050 })
    expect(input.semesters[0]).toMatchObject({ startMonth: 8, endMonth: 1 })
  })

  it('Deutschland setzt die deutschen Semester und Kategorien', async () => {
    const { onFinish, user, next } = setup()
    await user.click(screen.getByLabelText(/Deutschland/))
    await next()
    await next()
    expect(screen.getByLabelText('Name Semester 1')).toHaveValue('Wintersemester')
    await next()
    expect(screen.getByLabelText('Budget Rundfunkbeitrag')).toBeInTheDocument()
    expect(screen.queryByLabelText('Budget SERAFE')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    await waitFor(() =>
      expect(onFinish.mock.calls[0][0]).toMatchObject({ country: 'DE', budgets: {} }),
    )
  })

  it('WG ohne Mitbewohner/in lässt sich nicht weiter', async () => {
    const { user, next } = setup()
    await next()
    await user.click(screen.getByRole('radio', { name: /^WG/ }))
    await next()
    expect(screen.getByRole('alert')).toHaveTextContent('mindestens eine Mitbewohnerin')
    expect(screen.getByText(/Schritt 2 von 4/)).toBeInTheDocument()
  })

  it('Partner/in: Anteil wird geprüft und übernommen', async () => {
    const { onFinish, user, next } = setup()
    await next()
    await user.click(screen.getByRole('radio', { name: /^Mit Partner/ }))
    await user.type(screen.getByLabelText('Name von Partner/in'), 'Mia')
    const pct = screen.getByLabelText(/Dein Anteil/)
    await user.clear(pct)
    await user.type(pct, '140')
    await next()
    expect(screen.getByRole('alert')).toHaveTextContent('zwischen 0 und 100')
    await user.clear(pct)
    await user.type(pct, '60')
    await next()
    await next()
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    await waitFor(() =>
      expect(onFinish.mock.calls[0][0]).toMatchObject({
        living: 'partner',
        partnerSharePct: 60,
        persons: ['Mia'],
      }),
    )
  })

  it('ungültiger Betrag wird abgelehnt, Zurück funktioniert', async () => {
    const { onFinish, user, next } = setup()
    await next()
    await next()
    await next()
    await user.type(screen.getByLabelText('Budget Strom'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    expect(screen.getByRole('alert')).toHaveTextContent('kein gültiger Betrag')
    expect(onFinish).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(screen.getByText(/Schritt 3 von 4/)).toBeInTheDocument()
  })

  it('Fehler beim Speichern wird angezeigt und man kann es erneut versuchen', async () => {
    const onFinish = vi
      .fn()
      .mockRejectedValueOnce(new Error('Speichern fehlgeschlagen'))
      .mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Wizard onFinish={onFinish} />)
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Speichern fehlgeschlagen')
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(2))
  })
})
