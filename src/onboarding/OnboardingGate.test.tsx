import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingGate } from './OnboardingGate'

const h = {
  settings: undefined as unknown,
  sync: {
    hasSynced: false,
    status: { state: 'syncing', skipped: 0 },
    pending: 0,
    syncNow: vi.fn(),
  } as Record<string, unknown>,
}
vi.mock('../data/hooks', () => ({ useSettings: () => h.settings }))
vi.mock('../sync/SyncProvider', () => ({ useSync: () => h.sync }))
vi.mock('../theme', () => ({ applyTheme: vi.fn() }))

beforeEach(() => {
  h.settings = null
  h.sync = {
    hasSynced: false,
    status: { state: 'syncing', skipped: 0 },
    pending: 0,
    syncNow: vi.fn(),
  }
})

describe('OnboardingGate', () => {
  it('zeigt die App, wenn die Einrichtung abgeschlossen ist', () => {
    h.settings = { onboardingDone: true, theme: 'dark' }
    render(<OnboardingGate>APP</OnboardingGate>)
    expect(screen.getByText('APP')).toBeInTheDocument()
  })
  it('wartet auf den ersten Abgleich, bevor der Assistent erscheint (sonst würde ein neues Gerät neu einrichten)', () => {
    render(<OnboardingGate>APP</OnboardingGate>)
    expect(screen.getByText('Deine Daten werden geladen …')).toBeInTheDocument()
    expect(screen.queryByText('Willkommen bei StudiBudget')).not.toBeInTheDocument()
  })
  it('ohne Verbindung gibt es keinen Assistenten, sondern «Nochmals versuchen»', () => {
    h.sync = { ...h.sync, status: { state: 'offline', skipped: 0 } }
    render(<OnboardingGate>APP</OnboardingGate>)
    expect(screen.getByRole('button', { name: 'Nochmals versuchen' })).toBeInTheDocument()
    expect(screen.queryByText('Willkommen bei StudiBudget')).not.toBeInTheDocument()
  })
  it('nach dem Abgleich ohne Einstellungen erscheint der Assistent', () => {
    h.sync = { ...h.sync, hasSynced: true, status: { state: 'idle', skipped: 0, lastSyncAt: 1 } }
    render(<OnboardingGate>APP</OnboardingGate>)
    expect(screen.getByText('Willkommen bei StudiBudget')).toBeInTheDocument()
  })
  it('zeigt «Lädt», solange die lokalen Daten gelesen werden', () => {
    h.settings = undefined
    render(<OnboardingGate>APP</OnboardingGate>)
    expect(screen.getByText('Lädt …')).toBeInTheDocument()
  })
})
