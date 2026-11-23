import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { LogoutSection } from './LogoutSection'

// Abmelden mit ausstehenden Änderungen (#170).
const auth = { logout: vi.fn().mockResolvedValue(undefined) }
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => auth }))
const sync = { flush: vi.fn() }
vi.mock('../../sync/SyncProvider', () => ({ useSyncOptional: () => sync }))

async function pending(n: number) {
  for (let i = 0; i < n; i++) await db.outbox.add({ table: 'transactions', recordId: String(i) })
}

beforeEach(async () => {
  vi.clearAllMocks()
  await db.wipe()
})

describe('Abmelden (#170)', () => {
  it('AK-3/AK-4: ohne ausstehende Änderungen wird ohne Rückfrage abgemeldet', async () => {
    const user = userEvent.setup()
    render(<LogoutSection />)
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('AK-1/AK-4: mit ausstehenden Änderungen erst ein Hinweis mit der Anzahl, «Trotzdem abmelden» meldet ab', async () => {
    await pending(2)
    const user = userEvent.setup()
    render(<LogoutSection />)
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('2 Änderungen sind noch nicht hochgeladen')
    expect(auth.logout).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Trotzdem abmelden' }))
    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1))
  })

  it('AK-2: «Zuerst synchronisieren» meldet nach erfolgreichem Upload ab', async () => {
    await pending(1)
    sync.flush.mockImplementation(async () => {
      await db.outbox.clear()
    })
    const user = userEvent.setup()
    render(<LogoutSection />)
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      '1 Änderung ist noch nicht hochgeladen',
    )
    await user.click(screen.getByRole('button', { name: 'Zuerst synchronisieren' }))
    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1))
    expect(sync.flush).toHaveBeenCalledTimes(1)
  })

  it('AK-2: misslingt der Upload, wird nicht abgemeldet und ein Fehler erscheint', async () => {
    await pending(1)
    sync.flush.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<LogoutSection />)
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    await user.click(await screen.findByRole('button', { name: 'Zuerst synchronisieren' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hochladen hat nicht geklappt: 1 Änderung ist noch ausstehend.',
    )
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('«Abbrechen» schliesst den Hinweis ohne Abmelden', async () => {
    await pending(1)
    const user = userEvent.setup()
    render(<LogoutSection />)
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
  })
})
