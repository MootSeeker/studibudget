import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { defaultSemesters } from '../domain/period'
import { SyncProvider } from '../sync/SyncProvider'

beforeEach(async () => {
  window.location.hash = '#/eingabe'
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

const setup = async () => {
  const user = userEvent.setup()
  render(
    <SyncProvider>
      <App />
    </SyncProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Eingabe' })
  return user
}

describe('Layout', () => {
  it('Menü-Knopf auf dem Handy: öffnet und schliesst, meldet den Zustand und schliesst nach der Auswahl', async () => {
    const user = await setup()
    const toggle = screen.getByRole('button', { name: 'Menü' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'hauptnavigation')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Menü schliessen' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.click(screen.getByRole('link', { name: 'Budget' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Budget' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menü' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Sprunglink setzt den Fokus auf den Inhalt (und ändert die Adresse nicht)', async () => {
    const user = await setup()
    const before = window.location.hash
    await user.click(screen.getByRole('button', { name: 'Zum Inhalt springen' }))
    expect(screen.getByRole('main')).toHaveFocus()
    expect(window.location.hash).toBe(before)
  })

  it('Sprunglink ist per Tastatur der erste Halt', async () => {
    const user = await setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Zum Inhalt springen' })).toHaveFocus()
  })

  it('der Seitentitel folgt der Seite', async () => {
    const user = await setup()
    expect(document.title).toBe('Eingabe – StudiBudget')
    await user.click(screen.getByRole('link', { name: 'Statistik' }))
    await screen.findByRole('heading', { level: 1, name: 'Statistik' })
    expect(document.title).toBe('Statistik – StudiBudget')
  })

  it('Datenschutz und Impressum sind aus der App heraus erreichbar, mit eigenem Titel', async () => {
    const user = await setup()
    await user.click(screen.getByRole('link', { name: 'Datenschutz' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Datenschutz' }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Datenschutz – StudiBudget')
    await user.click(screen.getByRole('link', { name: 'Impressum' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument()
    expect(document.title).toBe('Impressum – StudiBudget')
  })

  it('die Hauptnavigation hat alle Seiten und kennzeichnet die aktuelle', async () => {
    await setup()
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(nav).toHaveTextContent('Einstellungen')
    expect(screen.getByRole('link', { name: 'Eingabe' })).toHaveAttribute('aria-current', 'page')
  })
})
