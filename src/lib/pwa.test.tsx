import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from '../components/UpdateBanner'
import { createPwaStore } from './pwa'

/** Ein künstlicher Service-Worker-Anbieter, der «neue Version» auf Knopfdruck meldet. */
function fakeRegister() {
  let notify: () => void = () => {}
  const reload = vi.fn().mockResolvedValue(undefined)
  const register = vi.fn((onNeedRefresh: () => void) => {
    notify = onNeedRefresh
    return reload
  })
  return { register, reload, newVersion: () => notify() }
}

describe('PWA-Store', () => {
  it('registriert genau einmal, auch bei mehrfachem Start', () => {
    const store = createPwaStore()
    const f = fakeRegister()
    store.start(f.register, true)
    store.start(f.register, true)
    expect(f.register).toHaveBeenCalledTimes(1)
  })
  it('tut nichts, wenn nicht aktiviert (Entwicklungsserver, kein Browser-Support)', () => {
    const store = createPwaStore()
    const f = fakeRegister()
    store.start(f.register, false)
    expect(f.register).not.toHaveBeenCalled()
    expect(store.updateAvailable()).toBe(false)
  })
  it('meldet eine neue Version und lädt sie erst auf Aufforderung', async () => {
    const store = createPwaStore()
    const f = fakeRegister()
    const seen = vi.fn()
    store.subscribe(seen)
    store.start(f.register, true)
    expect(store.updateAvailable()).toBe(false)
    f.newVersion()
    expect(store.updateAvailable()).toBe(true)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(f.reload).not.toHaveBeenCalled() // nie heimlich
    await store.applyUpdate()
    expect(f.reload).toHaveBeenCalledWith(true)
  })
  it('ein Fehler bei der Registrierung bringt die App nicht zum Absturz', () => {
    const store = createPwaStore()
    expect(() =>
      store.start(() => {
        throw new Error('kaputt')
      }, true),
    ).not.toThrow()
    expect(store.updateAvailable()).toBe(false)
  })
})

describe('UpdateBanner', () => {
  it('erscheint erst bei neuer Version; der Knopf löst die Aktualisierung aus', async () => {
    const store = createPwaStore()
    const f = fakeRegister()
    store.start(f.register, true)
    render(<UpdateBanner store={store} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => f.newVersion())
    expect(await screen.findByText(/neue Version von StudiBudget/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Jetzt aktualisieren' }))
    expect(f.reload).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Jetzt aktualisieren' })).toBeDisabled()
  })
})
