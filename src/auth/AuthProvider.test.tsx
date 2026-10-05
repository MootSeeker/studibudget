import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateDek } from '../crypto/keys'
import { db } from '../data/db'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { fakeSupabase, USER } from '../test/fakeSupabase'
import { AuthProvider, useAuth } from './AuthProvider'

const hold = vi.hoisted(() => ({ current: null as null | { client: unknown } }))
vi.mock('./supabase', () => ({
  get supabase() {
    return hold.current?.client ?? null
  },
}))
const flows = vi.hoisted(() => ({ login: vi.fn(), resetWithRecovery: vi.fn(), logout: vi.fn() }))
vi.mock('./flows', async (orig) => ({ ...(await orig<typeof import('./flows')>()), ...flows }))

let api: ReturnType<typeof useAuth>
function Probe() {
  const current = useAuth()
  useEffect(() => {
    api = current
  })
  return (
    <p>
      {current.state.status}|{current.state.email ?? '-'}|{current.state.notice ?? '-'}|
      {current.configured ? 'konfiguriert' : 'nicht konfiguriert'}
    </p>
  )
}
const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
const text = () => screen.getByText(/\|/).textContent

beforeEach(async () => {
  await db.wipe()
  vi.clearAllMocks()
  hold.current = fakeSupabase()
})

describe('AuthProvider: Sitzung und Schlüssel', { tags: ['negativ'] }, () => {
  it('Sitzung und lokaler Schlüssel zur selben E-Mail: angemeldet', async () => {
    await db.keystore.put({ id: 'dek', email: USER.email, key: await generateDek() })
    renderAuth()
    await waitFor(() => expect(text()).toBe(`in|${USER.email}|-|konfiguriert`))
  })
  it('Sitzung ohne lokalen Schlüssel (nach dem Bestätigungslink): abmelden und Hinweis zeigen', async () => {
    renderAuth()
    await waitFor(() => expect(text()).toContain('E-Mail bestätigt'))
    expect(text()).toMatch(/^out\|-\|/)
    expect(
      (hold.current as unknown as ReturnType<typeof fakeSupabase>).auth.signOut,
    ).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('Sitzung, aber Schlüssel einer anderen E-Mail: nicht angemeldet', async () => {
    await db.keystore.put({ id: 'dek', email: 'andere@example.com', key: await generateDek() })
    renderAuth()
    await waitFor(() => expect(text()).toMatch(/^out\|/))
  })
  it('ohne Sitzung: abgemeldet, ohne Hinweis', async () => {
    ;(hold.current as unknown as ReturnType<typeof fakeSupabase>).state.session = false
    renderAuth()
    await waitFor(() => expect(text()).toBe('out|-|-|konfiguriert'))
  })
  it('das Ereignis PASSWORD_RECOVERY schaltet in den Wiederherstellungsmodus', async () => {
    renderAuth()
    await waitFor(() => expect(text()).toMatch(/^out\|/))
    act(() =>
      (hold.current as unknown as ReturnType<typeof fakeSupabase>).emit('PASSWORD_RECOVERY'),
    )
    await waitFor(() => expect(text()).toMatch(new RegExp(`^recovery\\|${USER.email}`)))
  })
  it('beim Verlassen wird der Auth-Hörer abgemeldet', async () => {
    const { unmount } = renderAuth()
    await waitFor(() => expect(text()).toMatch(/^out\|/))
    unmount()
    expect(
      (hold.current as unknown as ReturnType<typeof fakeSupabase>).unsubscribe,
    ).toHaveBeenCalled()
  })
})

describe('AuthProvider: Datenschutz beim Konto- und Gerätewechsel', { tags: ['negativ'] }, () => {
  const seedPerson = () =>
    store.put('persons', { id: newId(), deleted: false, name: 'Fremd', active: true })

  it('Anmeldung mit einer anderen E-Mail löscht die lokalen Daten des vorigen Kontos', async () => {
    await db.keystore.put({ id: 'dek', email: 'vorher@example.com', key: await generateDek() })
    await seedPerson()
    flows.login.mockResolvedValue({ dek: await generateDek(), user: USER })
    ;(hold.current as unknown as ReturnType<typeof fakeSupabase>).state.session = false
    renderAuth()
    await waitFor(() => expect(text()).toMatch(/^out\|/))
    await act(() => api.login(USER.email, 'egal'))
    expect(await db.persons.count()).toBe(0)
    expect((await db.keystore.get('dek'))?.email).toBe(USER.email)
    expect(text()).toBe(`in|${USER.email}|-|konfiguriert`)
  })
  it('Anmeldung mit derselben E-Mail behält die lokalen Daten', async () => {
    await db.keystore.put({ id: 'dek', email: USER.email, key: await generateDek() })
    await seedPerson()
    flows.login.mockResolvedValue({ dek: await generateDek(), user: USER })
    renderAuth()
    await waitFor(() => expect(text()).toMatch(/^in\|/))
    await act(() => api.login(USER.email, 'egal'))
    expect(await db.persons.count()).toBe(1)
  })
  it('Abmelden löscht alle lokalen Daten und den Schlüssel', async () => {
    await db.keystore.put({ id: 'dek', email: USER.email, key: await generateDek() })
    await seedPerson()
    renderAuth()
    await waitFor(() => expect(text()).toMatch(/^in\|/))
    await act(() => api.logout())
    expect(await db.persons.count()).toBe(0)
    expect(await db.keystore.count()).toBe(0)
    expect(text()).toBe('out|-|-|konfiguriert')
  })
  it('Wiederherstellung ohne bekannte E-Mail (abgelaufener Link) wird abgelehnt', async () => {
    ;(hold.current as unknown as ReturnType<typeof fakeSupabase>).state.session = false
    renderAuth()
    await waitFor(() => expect(text()).toMatch(/^out\|/))
    await expect(api.completeRecovery('CODE', 'Neues-Passwort-123')).rejects.toMatchObject({
      code: 'session',
    })
    expect(flows.resetWithRecovery).not.toHaveBeenCalled()
  })
})

describe('AuthProvider ohne Server', { tags: ['negativ'] }, () => {
  it('ist abgemeldet, meldet «nicht konfiguriert» und lehnt jede Aktion ab', async () => {
    hold.current = null
    renderAuth()
    await waitFor(() => expect(text()).toBe('out|-|-|nicht konfiguriert'))
    // Manche Aktionen werfen sofort statt ein Promise abzulehnen; beides ist für die Oberfläche gleich.
    const rejects = (f: () => unknown) =>
      expect((async () => f())()).rejects.toThrow(/nicht konfiguriert/)
    await rejects(() => api.login('a@b.ch', 'x'))
    await rejects(() => api.register('a@b.ch', 'x'))
    await rejects(() => api.logout())
  })
})
