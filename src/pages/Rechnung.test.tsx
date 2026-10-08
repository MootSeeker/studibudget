import { readFileSync } from 'node:fs'
import axe from 'axe-core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { defaultSemesters } from '../domain/period'
import { buildSharedEqual } from '../domain/split'
import { Rechnung } from './Rechnung'

async function setup(withBank: boolean, country: 'CH' | 'DE' = 'CH') {
  await db.wipe()
  await completeOnboarding(db, {
    country: 'CH',
    living: 'wg',
    hasCar: false,
    partnerSharePct: 50,
    persons: ['Anna'],
    semesters: defaultSemesters('CH'),
    budgets: {},
  })
  const anna = (await db.persons.toArray())[0]
  const cat = (await db.categories.toArray())[0]
  const shared = buildSharedEqual(200000, 'me', ['me', anna.id])
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date: '2026-10-01',
    categoryId: cat.id,
    amountCents: 200000,
    myAmountCents: 100000,
    note: 'Miete',
    shared,
  } as never)
  if (withBank) {
    const s = (await db.settings.toArray())[0]
    await store.put('settings', {
      ...s,
      bank: {
        holder: 'Kevin Muster',
        street: 'Weg 1',
        zip: '8000',
        town: 'Zürich',
        country: 'CH',
        iban: 'CH9300762011623852957',
      },
    } as never)
  }
  if (country !== 'CH') {
    const s = (await db.settings.toArray())[0]
    await store.put('settings', { ...s, country } as never)
  }
  return anna.id
}
const renderAt = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/ausgleich/rechnung/${id}`]}>
      <Routes>
        <Route path="/ausgleich/rechnung/:personId" element={<Rechnung />} />
      </Routes>
    </MemoryRouter>,
  )

describe('Rechnung', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('zeigt Position, Total, Name und Bankverbindung', async () => {
    const id = await setup(true)
    renderAt(id)
    expect(await screen.findByText('Miete')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Total/ }).textContent).toMatch(/1.?000\.00/)
    expect(screen.getByText(/An: Anna/)).toBeInTheDocument()
    expect(screen.getAllByText(/Kevin Muster/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CH93 0076 2011 6238 5295 7/).length).toBeGreaterThan(0)
  })

  it('zeigt ohne Bankverbindung einen Hinweis mit Link und ändert keine Daten', async () => {
    const id = await setup(false)
    const before = await db.settlements.count()
    renderAt(id)
    expect(await screen.findByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/einstellungen',
    )
    expect(await db.settlements.count()).toBe(before)
  })

  it('öffnet den Druckdialog', async () => {
    const id = await setup(true)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderAt(id)
    ;(await screen.findByRole('button', { name: /Drucken oder als PDF/ })).click()
    expect(print).toHaveBeenCalled()
  })

  it('Navigation und Knöpfe fehlen im Ausdruck, die Seite ist auf A4 eingestellt (AK-6)', async () => {
    const id = await setup(true)
    renderAt(id)
    const bar = (await screen.findByRole('button', { name: /Drucken oder als PDF/ })).parentElement!
    expect(bar.className).toContain('print:hidden')
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/@media print\s*{[^}]*@page\s*{[^}]*size:\s*A4/s)
    const layout = readFileSync('src/components/Layout.tsx', 'utf8')
    expect(layout.match(/print:hidden/g)!.length).toBeGreaterThanOrEqual(4)
  })

  it('ist mit der Tastatur bedienbar (AK-8)', async () => {
    const id = await setup(true)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderAt(id)
    await screen.findByText('Miete')
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Zurück zum Ausgleich' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /Drucken oder als PDF/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(print).toHaveBeenCalled()
  })

  it.each([true, false])(
    'hat keine axe-Verstösse (Bankverbindung: %s) (AK-8)',
    async (withBank) => {
      const id = await setup(withBank)
      const { container } = renderAt(id)
      await screen.findByText('Miete')
      // Kontraste kann jsdom nicht berechnen; die übrigen Regeln (WCAG A/AA) gelten.
      const result = await axe.run(container, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        rules: { 'color-contrast': { enabled: false } },
      })
      expect(result.violations.map((v) => v.id)).toEqual([])
    },
  )

  describe('Zahlteil mit Swiss QR Code (Issue #106)', () => {
    it('AK-1: zeigt Empfangsschein und Zahlteil mit Währung, Betrag, Konto, Zahlbar an und durch', async () => {
      const id = await setup(true)
      const { container } = renderAt(id)
      const part = await screen.findByRole('region', { name: 'Zahlteil' })
      expect(container.querySelector('svg[role="img"]')).not.toBeNull()
      expect(part.textContent).toContain('Empfangsschein')
      expect(part.textContent).toContain('CH93 0076 2011 6238 5295 7')
      expect(part.textContent).toContain('Kevin Muster')
      expect(part.textContent).toMatch(/Zahlbar durch[\s\S]*Anna/)
      expect(part.textContent).toContain('CHF')
      expect(part.textContent).toMatch(/1.?000\.00/)
    })

    it('AK-5: bei Deutschland (EUR) kein Zahlteil, Hinweis nennt den Grund', async () => {
      const id = await setup(true, 'DE')
      renderAt(id)
      await screen.findByText('Miete')
      expect(screen.queryByRole('region', { name: 'Zahlteil' })).toBeNull()
      expect(screen.getByText(/nur für die Schweiz/)).toBeInTheDocument()
    })

    it('AK-5: ohne Bankverbindung kein Zahlteil, der Hinweis auf die Einstellungen bleibt', async () => {
      const id = await setup(false)
      renderAt(id)
      await screen.findByText('Miete')
      expect(screen.queryByRole('region', { name: 'Zahlteil' })).toBeNull()
      expect(screen.getByText(/noch keine Bankverbindung/)).toBeInTheDocument()
    })

    it('AK-4: bei Saldo 0 oder negativ kein Zahlteil', async () => {
      const id = await setup(true)
      await store.put('settlements', {
        id: newId(),
        deleted: false,
        date: '2026-10-02',
        personId: id,
        direction: 'ich_erhalte',
        amountCents: 100000,
        note: '',
      } as never)
      renderAt(id)
      await screen.findByText('Miete')
      expect(screen.queryByRole('region', { name: 'Zahlteil' })).toBeNull()
      expect(screen.getByText(/nichts zu zahlen/)).toBeInTheDocument()
    })
  })
})
