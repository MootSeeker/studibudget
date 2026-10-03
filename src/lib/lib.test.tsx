import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallSection } from '../pages/einstellungen/InstallSection'
import { isStoragePersisted, requestPersistentStorage } from './storage'

const setStorage = (storage: unknown) =>
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })
afterEach(() => {
  setStorage(undefined)
  vi.restoreAllMocks()
})

describe('dauerhafter Speicher', () => {
  it('fragt nach, wenn noch nicht zugesichert, und meldet das Ergebnis', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    setStorage({ persist, persisted: vi.fn().mockResolvedValue(false) })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)
  })
  it('fragt nicht erneut, wenn schon zugesichert', async () => {
    const persist = vi.fn()
    setStorage({ persist, persisted: vi.fn().mockResolvedValue(true) })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })
  it('abgelehnt ist false; ohne Unterstützung oder bei Fehler null (kein Absturz)', async () => {
    setStorage({
      persist: vi.fn().mockResolvedValue(false),
      persisted: vi.fn().mockResolvedValue(false),
    })
    expect(await requestPersistentStorage()).toBe(false)
    setStorage(undefined)
    expect(await requestPersistentStorage()).toBeNull()
    expect(await isStoragePersisted()).toBeNull()
    setStorage({
      persist: vi.fn().mockRejectedValue(new Error('x')),
      persisted: vi.fn().mockRejectedValue(new Error('x')),
    })
    expect(await requestPersistentStorage()).toBeNull()
    expect(await isStoragePersisted()).toBeNull()
  })
})

describe('App installieren', () => {
  const fireInstallPrompt = () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(e)
    })
    return { prompt, e }
  }

  it('zeigt erst nach dem Browser-Ereignis einen Installieren-Knopf; ein Klick öffnet die Browser-Abfrage', async () => {
    render(<InstallSection />)
    expect(screen.queryByRole('button', { name: 'App installieren' })).not.toBeInTheDocument()
    const { prompt, e } = fireInstallPrompt()
    expect(e.defaultPrevented).toBe(true)
    await userEvent.click(await screen.findByRole('button', { name: 'App installieren' }))
    expect(prompt).toHaveBeenCalledTimes(1)
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'App installieren' })).not.toBeInTheDocument(),
    )
  })

  it('nach der Installation steht da, dass sie installiert ist', async () => {
    render(<InstallSection />)
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(await screen.findByText('StudiBudget ist als App installiert.')).toBeInTheDocument()
  })

  it('ohne Ereignis gibt es einen allgemeinen Hinweis statt eines toten Knopfes', () => {
    render(<InstallSection />)
    expect(screen.getByText(/Im Browser-Menü findest du/)).toBeInTheDocument()
  })
})
