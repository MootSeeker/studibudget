import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './data/db'
import { completeOnboarding } from './data/onboarding'
import { defaultSemesters } from './domain/period'
import App from './App'
import { SyncProvider } from './sync/SyncProvider'
import { PAGES } from './pages'

describe('App', () => {
  beforeEach(async () => {
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

  it('zeigt alle sieben Seiten in der Navigation', () => {
    render(
      <SyncProvider>
        <App />
      </SyncProvider>,
    )
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    for (const p of PAGES) {
      expect(nav).toHaveTextContent(p.label)
    }
    expect(PAGES).toHaveLength(7)
  })

  it('leitet auf die Eingabe-Seite weiter', async () => {
    render(
      <SyncProvider>
        <App />
      </SyncProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Eingabe' })).toBeInTheDocument()
  })
})
