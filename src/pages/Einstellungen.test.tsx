import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { store } from '../data/store'
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
    <MemoryRouter initialEntries={['/einstellungen?bereich=konto']}>
      <Einstellungen />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Konto' })
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

describe('Einstellungen: Daten zurücksetzen (Issue #30)', () => {
  async function mitDaten() {
    const miete = (await db.categories.toArray()).find((c) => c.catalogKey === 'miete')!
    await store.put('transactions', {
      id: 'reset-t1',
      deleted: false,
      date: '2026-03-01',
      categoryId: miete.id,
      amountCents: 80000,
      myAmountCents: 80000,
      note: 'Miete',
    })
    await store.put('accounts', {
      id: 'reset-k1',
      deleted: false,
      name: 'Konto',
      kind: 'bank',
      include: true,
      order: 0,
    })
    await store.put('accountBalances', {
      id: 'reset-ks1',
      deleted: false,
      accountId: 'reset-k1',
      month: '2026-03',
      amountCents: 100,
    })
  }

  async function dialog() {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/einstellungen?bereich=daten']}>
        <Einstellungen />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Zurücksetzen …' }))
    const d = await screen.findByRole('dialog', { name: 'Daten zurücksetzen' })
    await within(d).findByRole('checkbox', { name: /Buchungen \(\d+\)/ })
    return { user, d: within(d) }
  }

  it('löscht die gewählten Buchungen erst nach dem Klick auf den Löschen-Knopf', async () => {
    await mitDaten()
    const { user, d } = await dialog()
    expect(d.getByRole('button', { name: 'Löschen' })).toBeDisabled()
    await user.click(d.getByRole('checkbox', { name: /Buchungen/ }))
    expect(d.getByText(/Es werden 1 Eintrag gelöscht\./)).toBeInTheDocument()
    await user.click(d.getByRole('button', { name: '1 Eintrag löschen' }))
    expect(await screen.findByRole('status')).toHaveTextContent('1 Eintrag gelöscht.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await db.transactions.get('reset-t1'))?.deleted).toBe(true)
    expect((await db.accounts.get('reset-k1'))?.deleted).toBe(false)
  })

  it('Konten ziehen ihre Kontostände mit', async () => {
    await mitDaten()
    const { user, d } = await dialog()
    await user.click(d.getByRole('checkbox', { name: /^Konten/ }))
    const stand = d.getByRole('checkbox', { name: /Kontostände/ })
    expect(stand).toBeChecked()
    expect(stand).toBeDisabled()
    await user.click(d.getByRole('button', { name: '2 Einträge löschen' }))
    await screen.findByText('2 Einträge gelöscht.')
    expect((await db.accountBalances.get('reset-ks1'))?.deleted).toBe(true)
  })

  it('Abbrechen und Esc schliessen den Dialog, ohne etwas zu löschen', async () => {
    await mitDaten()
    const { user, d } = await dialog()
    await user.click(d.getByRole('checkbox', { name: /Buchungen/ }))
    await user.click(d.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zurücksetzen …' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Zurücksetzen …' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await db.transactions.get('reset-t1'))?.deleted).toBe(false)
  })

  it('bietet vorher ein Backup an', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user, d } = await dialog()
    await user.click(d.getByRole('button', { name: 'Backup herunterladen' }))
    expect(await d.findByText('Das Backup wurde heruntergeladen.')).toBeInTheDocument()
    expect(klick).toHaveBeenCalledOnce()
    klick.mockRestore()
  })

  it('nennt Buchungen, die ihre Vorlage oder ihr Sparziel verlieren', async () => {
    const cats = await db.categories.toArray()
    const miete = cats.find((c) => c.catalogKey === 'miete')!
    const sparen = cats.find((c) => c.type === 'sparen')!
    await store.put('templates', {
      id: 'reset-v1',
      deleted: false,
      categoryId: miete.id,
      amountCents: 80000,
      note: '',
      months: [3],
      active: true,
    })
    await store.put('goals', {
      id: 'reset-z1',
      deleted: false,
      name: 'Velo',
      targetCents: 100,
      targetDate: null,
      startCents: 0,
      archived: false,
    })
    for (const [id, extra] of [
      ['reset-a', { categoryId: miete.id, templateId: 'reset-v1', templateMonth: '2026-03' }],
      ['reset-b', { categoryId: sparen.id, goalId: 'reset-z1', goalDirection: 'einzahlung' }],
    ] as const)
      await store.put('transactions', {
        id,
        deleted: false,
        date: '2026-03-01',
        amountCents: 100,
        myAmountCents: 100,
        note: '',
        ...extra,
      })
    const { user, d } = await dialog()
    await user.click(d.getByRole('checkbox', { name: /Fixkosten-Vorlagen/ }))
    await user.click(d.getByRole('checkbox', { name: /Sparziele/ }))
    expect(
      d.getByText('1 Buchungen aus Vorlagen bleiben als normale Buchungen.'),
    ).toBeInTheDocument()
    expect(d.getByText(/1 Sparbuchungen bleiben als normale Sparbuchungen/)).toBeInTheDocument()
    await user.click(d.getByRole('checkbox', { name: /Fixkosten-Vorlagen/ }))
    expect(d.queryByText(/aus Vorlagen bleiben/)).not.toBeInTheDocument()
  })

  it('ein Fehler beim Löschen lässt den Dialog offen und zeigt den Grund', async () => {
    await mitDaten()
    const { user, d } = await dialog()
    const tx = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Speicher voll'))
    await user.click(d.getByRole('checkbox', { name: /Buchungen/ }))
    await user.click(d.getByRole('button', { name: '1 Eintrag löschen' }))
    expect(await d.findByRole('alert')).toHaveTextContent('Speicher voll')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(d.getByRole('button', { name: '1 Eintrag löschen' })).toBeEnabled()
    tx.mockRestore()
    expect((await db.transactions.get('reset-t1'))?.deleted).toBe(false)
  })

  it('ein Fehler beim Backup wird im Dialog gemeldet', async () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error('Kein Download möglich')
    })
    const { user, d } = await dialog()
    await user.click(d.getByRole('button', { name: 'Backup herunterladen' }))
    expect(await d.findByRole('alert')).toHaveTextContent('Kein Download möglich')
  })

  it('Tab bleibt im Dialog', async () => {
    const { user, d } = await dialog()
    const backup = d.getByRole('button', { name: 'Backup herunterladen' })
    const abbrechen = d.getByRole('button', { name: 'Abbrechen' })
    abbrechen.focus()
    await user.tab()
    expect(backup).toHaveFocus()
    await user.tab({ shift: true })
    expect(abbrechen).toHaveFocus()
  })
})

describe('Einstellungen: Reiter', () => {
  const zeige = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Einstellungen />
      </MemoryRouter>,
    )

  it('startet im Reiter «Haushalt» und zeigt nur dessen Abschnitte', async () => {
    zeige('/einstellungen')
    expect(
      await screen.findByRole('heading', { name: 'Land und Wohnsituation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Haushalt' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: 'Backup' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Konto' })).not.toBeInTheDocument()
  })

  it('ein unbekannter Reiter in der Adresse gilt als erster', async () => {
    zeige('/einstellungen?bereich=gibtsnicht')
    expect(
      await screen.findByRole('heading', { name: 'Land und Wohnsituation' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['darstellung', 'Darstellung und Ampel'],
    ['daten', 'Backup'],
    ['konto', 'Konto'],
  ])('Reiter «%s» zeigt «%s»', async (id, heading) => {
    zeige(`/einstellungen?bereich=${id}`)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Land und Wohnsituation' }),
    ).not.toBeInTheDocument()
  })

  it('ein Klick auf den Reiter wechselt den Inhalt', async () => {
    const user = userEvent.setup()
    zeige('/einstellungen')
    await user.click(await screen.findByRole('button', { name: 'Daten' }))
    expect(await screen.findByRole('heading', { name: 'Backup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Daten' })).toHaveAttribute('aria-current', 'page')
  })
})
