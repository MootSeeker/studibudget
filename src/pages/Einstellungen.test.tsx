import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { defaultSemesters } from '../domain/period'
import { Einstellungen } from './Einstellungen'

const auth = {
  state: { status: 'in', email: 'anna@example.com', notice: null },
  changePassword: vi.fn(),
  renewRecoveryKey: vi.fn(),
  deleteAccount: vi.fn(),
  logout: vi.fn(),
}
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }))

beforeEach(async () => {
  vi.clearAllMocks()
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

/** Das Formular, zu dem ein Knopf gehört (zwei Formulare tragen dieselbe Feld-Beschriftung). */
const formOf = (button: string) =>
  within(screen.getByRole('button', { name: button }).closest('form')!)

async function open(name: string) {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <Einstellungen />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Land und Wohnsituation' })
  await user.click(screen.getByText(name, { selector: 'summary' }))
  return user
}

describe('Einstellungen: Konto', () => {
  it(
    'jedes Feld hat eine eigene ID, auch wenn zwei dieselbe Beschriftung tragen (Regression #51)',
    { tags: ['regression'] },
    async () => {
      const user = await open('Konto löschen')
      await user.click(
        screen.getByText('Neuen Wiederherstellungsschlüssel erzeugen', { selector: 'summary' }),
      )
      const ids = [...document.querySelectorAll('input[id]')].map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
      const deleteBox = screen
        .getByRole('button', { name: 'Konto endgültig löschen' })
        .closest('form')!
      const field = within(deleteBox).getByLabelText('Passwort zur Bestätigung')
      expect(deleteBox.contains(field)).toBe(true)
    },
  )

  it('zeigt die angemeldete E-Mail', async () => {
    await open('Passwort ändern')
    expect(screen.getByText('anna@example.com')).toBeInTheDocument()
  })

  it('Passwort ändern: übergibt altes und neues Passwort, meldet Erfolg und leert die Felder', async () => {
    auth.changePassword.mockResolvedValue(undefined)
    const user = await open('Passwort ändern')
    await user.type(screen.getByLabelText('Aktuelles Passwort'), 'Altes-Passwort-123')
    await user.type(screen.getByLabelText('Neues Passwort'), 'Neues-Passwort-456')
    await user.click(screen.getByRole('button', { name: 'Passwort ändern' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Passwort geändert.')
    expect(auth.changePassword).toHaveBeenCalledWith('Altes-Passwort-123', 'Neues-Passwort-456')
    expect(screen.getByLabelText('Aktuelles Passwort')).toHaveValue('')
  })

  it('Passwort ändern: ein Fehler wird angezeigt, kein Erfolg gemeldet', async () => {
    auth.changePassword.mockRejectedValue(new Error('Das Passwort stimmt nicht.'))
    const user = await open('Passwort ändern')
    await user.type(screen.getByLabelText('Aktuelles Passwort'), 'falsch')
    await user.type(screen.getByLabelText('Neues Passwort'), 'Neues-Passwort-456')
    await user.click(screen.getByRole('button', { name: 'Passwort ändern' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Passwort stimmt nicht.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('neuer Wiederherstellungsschlüssel wird einmal angezeigt', async () => {
    auth.renewRecoveryKey.mockResolvedValue('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG')
    const user = await open('Neuen Wiederherstellungsschlüssel erzeugen')
    await user.type(
      formOf('Neuen Schlüssel erzeugen').getByLabelText('Passwort zur Bestätigung'),
      'Mein-Passwort-123',
    )
    await user.click(screen.getByRole('button', { name: 'Neuen Schlüssel erzeugen' }))
    expect(await screen.findByText('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG')).toBeInTheDocument()
  })

  it('Konto löschen: ohne Bestätigung im Dialog wird nichts gelöscht', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = await open('Konto löschen')
    await user.type(
      formOf('Konto endgültig löschen').getByLabelText('Passwort zur Bestätigung'),
      'Mein-Passwort-123',
    )
    await user.click(screen.getByRole('button', { name: 'Konto endgültig löschen' }))
    await waitFor(() => expect(window.confirm).toHaveBeenCalled())
    expect(auth.deleteAccount).not.toHaveBeenCalled()
  })

  it('Konto löschen: nach Bestätigung wird gelöscht, ein Fehler wird angezeigt', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    auth.deleteAccount.mockRejectedValue(new Error('Keine Verbindung zum Server.'))
    const user = await open('Konto löschen')
    await user.type(
      formOf('Konto endgültig löschen').getByLabelText('Passwort zur Bestätigung'),
      'Mein-Passwort-123',
    )
    await user.click(screen.getByRole('button', { name: 'Konto endgültig löschen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Keine Verbindung')
    expect(auth.deleteAccount).toHaveBeenCalledWith('Mein-Passwort-123')
  })

  it('Abmelden ruft logout auf', async () => {
    const user = await open('Passwort ändern')
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    expect(auth.logout).toHaveBeenCalled()
  })
})
