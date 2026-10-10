import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashInboxToken, unwrapInboxPrivateKey } from '../../crypto/inbox'
import { generateDek } from '../../crypto/keys'
import { db } from '../../data/db'
import type { InboxApi } from '../../sync/inbox'
import { PosteingangSection } from './PosteingangSection'

beforeEach(async () => {
  await db.wipe()
  await db.keystore.put({ id: 'dek', email: 'anna@example.com', key: await generateDek() })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function fakeApi(): InboxApi & {
  connect: ReturnType<typeof vi.fn>
  revoke: ReturnType<typeof vi.fn>
} {
  return {
    list: vi.fn(async () => []),
    remove: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    revoke: vi.fn(async () => {}),
  } as InboxApi & { connect: ReturnType<typeof vi.fn>; revoke: ReturnType<typeof vi.fn> }
}

async function einrichten(api: InboxApi) {
  render(<PosteingangSection api={api} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Verbindung einrichten' }))
  await screen.findByLabelText('Token')
  return user
}

describe('PosteingangSection (#157)', () => {
  it('AK-1: Verbindung einrichten zeigt öffentlichen Schlüssel und Token', async () => {
    const api = fakeApi()
    await einrichten(api)
    const token = (screen.getByLabelText('Token') as HTMLInputElement).value
    const publicKey = (screen.getByLabelText('Öffentlicher Schlüssel') as HTMLInputElement).value
    expect(token).toMatch(/^sbi1_[A-Za-z0-9_-]{43}$/)
    const rows = await db.inboxConnections.toArray()
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.publicKey).toBe(publicKey)
    expect(api.connect).toHaveBeenCalledWith(row.id, await hashInboxToken(token))
    expect(JSON.stringify(rows)).not.toContain(token)
    const dek = (await db.keystore.get('dek'))!.key
    await expect(unwrapInboxPrivateKey(dek, row.id, row.wrappedPrivateKey)).resolves.toBeDefined()
    const outbox = await db.outbox.toArray()
    expect(outbox.some((o) => o.table === 'inboxConnections')).toBe(true)
  })

  it('AK-1: ohne Server gibt es keine Verbindung', () => {
    render(<PosteingangSection api={null} />)
    expect(screen.getByText('Der Posteingang braucht ein Konto mit Sync.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verbindung einrichten' })).toBeNull()
  })

  it('AK-5: Widerrufen meldet den Widerruf an den Server und entfernt die Verbindung', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const api = fakeApi()
    const user = await einrichten(api)
    const id = (await db.inboxConnections.toArray())[0].id
    await user.click(
      within(screen.getByRole('listitem', { name: `Verbindung ${id.slice(0, 8)}` })).getByRole(
        'button',
        { name: 'Widerrufen' },
      ),
    )
    expect(api.revoke).toHaveBeenCalledWith(id)
    expect((await db.inboxConnections.get(id))!.deleted).toBe(true)
    expect(await screen.findByText('Keine Verbindung eingerichtet.')).toBeInTheDocument()
  })

  it('AK-5: scheitert der Widerruf am Server, bleibt die Verbindung', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const api = fakeApi()
    const user = await einrichten(api)
    const id = (await db.inboxConnections.toArray())[0].id
    api.revoke.mockRejectedValueOnce(new Error('netz'))
    await user.click(
      within(screen.getByRole('listitem', { name: `Verbindung ${id.slice(0, 8)}` })).getByRole(
        'button',
        { name: 'Widerrufen' },
      ),
    )
    expect(
      await screen.findByText(
        'Der Widerruf ist fehlgeschlagen. Bitte prüfe die Internetverbindung.',
      ),
    ).toBeInTheDocument()
    expect((await db.inboxConnections.get(id))!.deleted).toBe(false)
  })
})
