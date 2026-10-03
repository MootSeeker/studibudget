import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { store } from '../data/store'
import { currentMonth, addMonths, defaultSemesters } from '../domain/period'
import { Budget } from './Budget'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")
const NOW = currentMonth()

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

async function setup() {
  const user = userEvent.setup()
  render(<Budget />)
  await screen.findByRole('heading', { level: 1, name: 'Budget' })
  await screen.findByLabelText('Monatsbudget Miete')
  return user
}
const catByKey = async (key: string) =>
  (await db.categories.toArray()).find((c) => c.catalogKey === key)!
const summary = (label: string) =>
  norm(screen.getByText(label, { selector: 'dt' }).nextElementSibling!.textContent)

describe('Budget-Seite', () => {
  it('setzt ein Monatsbudget und aktualisiert die Summen', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Monatsbudget Miete'), '800')
    await user.tab()
    await waitFor(async () => expect(await db.budgets.count()).toBe(1))
    const [b] = await db.budgets.toArray()
    expect(b).toMatchObject({
      amountCents: 80000,
      validFrom: NOW,
      categoryId: (await catByKey('miete')).id,
    })
    await waitFor(() => expect(summary('Ausgaben')).toMatch(/800\.00/))
    expect(summary('Bleibt übrig')).toMatch(/-800\.00/)
  })

  it('Änderung im selben Monat überschreibt, in einem späteren Monat legt sie einen neuen Eintrag an', async () => {
    const user = await setup()
    const input = () => screen.getByLabelText('Monatsbudget Miete')
    await user.type(input(), '800')
    await user.tab()
    await waitFor(async () => expect(await db.budgets.count()).toBe(1))
    await user.clear(input())
    await user.type(input(), '850')
    await user.tab()
    await waitFor(async () => expect((await db.budgets.toArray())[0].amountCents).toBe(85000))
    expect(await db.budgets.count()).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    await waitFor(() => expect(input()).toHaveValue('850.00')) // gilt weiter
    await user.clear(input())
    await user.type(input(), '900')
    await user.tab()
    await waitFor(async () => expect(await db.budgets.count()).toBe(2))
    expect((await db.budgets.toArray()).map((x) => [x.validFrom, x.amountCents]).sort()).toEqual([
      [NOW, 85000],
      [addMonths(NOW, 1), 90000],
    ])

    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    await waitFor(() => expect(input()).toHaveValue('850.00')) // früher bleibt unverändert
  })

  it('der Entwurf eines Feldes wandert nicht in einen anderen Monat mit', async () => {
    // Folgemonat hat einen eigenen Eintrag mit demselben Wert (800), den das Feld im Startmonat vor der Änderung zeigt.
    const miete = await catByKey('miete')
    await store.put('budgets', {
      id: crypto.randomUUID(),
      deleted: false,
      categoryId: miete.id,
      validFrom: NOW,
      amountCents: 80000,
    })
    await store.put('budgets', {
      id: crypto.randomUUID(),
      deleted: false,
      categoryId: miete.id,
      validFrom: addMonths(NOW, 1),
      amountCents: 80000,
    })
    const user = await setup()
    const input = () => screen.getByLabelText('Monatsbudget Miete')
    await waitFor(() => expect(input()).toHaveValue('800.00'))
    await user.clear(input())
    await user.type(input(), '850')
    await user.tab()
    await waitFor(async () =>
      expect(
        (await db.budgets.toArray()).some((b) => b.validFrom === NOW && b.amountCents === 85000),
      ).toBe(true),
    )
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    await waitFor(() => expect(input()).toHaveValue('800.00')) // eigener Wert des Folgemonats, nicht der getippte Text
    await new Promise((r) => setTimeout(r, 200))
    expect(input()).toHaveValue('800.00')
  })

  it('ungültiger Betrag zeigt einen Fehler und speichert nichts', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Monatsbudget Miete'), 'abc')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('gültigen Betrag')
    expect(await db.budgets.count()).toBe(0)
  })

  it('Fixkosten und Übertrag lassen sich umschalten', async () => {
    const user = await setup()
    const strom = await catByKey('strom')
    const row = screen.getByLabelText('Monatsbudget Strom').closest('li')!
    await user.click(within(row).getByLabelText('Fixkosten'))
    await waitFor(async () => expect((await db.categories.get(strom.id))!.fix).toBe(true))
    await user.click(within(row).getByLabelText(/Rest übertragen/))
    await waitFor(async () => expect((await db.categories.get(strom.id))!.rolloverFrom).toBe(NOW))
    // Das Häkchen folgt dem gespeicherten Stand; erst wenn die Seite ihn zeigt, ist ein zweiter Klick ein «Ausschalten».
    await waitFor(() => expect(within(row).getByLabelText(/Rest übertragen/)).toBeChecked())
    await user.click(within(row).getByLabelText(/Rest übertragen/))
    await waitFor(async () => expect((await db.categories.get(strom.id))!.rolloverFrom).toBeNull())
  })

  it('blendet Kategorien aus (aus der Summe) und wieder ein', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Monatsbudget Strom'), '50')
    await user.tab()
    await waitFor(() => expect(summary('Ausgaben')).toMatch(/50\.00/))
    const row = () => screen.getByLabelText('Monatsbudget Strom').closest('li')!
    await user.click(within(row()).getByRole('button', { name: 'Ausblenden' }))
    await waitFor(() =>
      expect(screen.queryByLabelText('Monatsbudget Strom')).not.toBeInTheDocument(),
    )
    expect(summary('Ausgaben')).toMatch(/0\.00/)
    await user.click(screen.getByLabelText('Ausgeblendete Kategorien anzeigen'))
    await user.click(within(row()).getByRole('button', { name: 'Einblenden' }))
    await waitFor(() => expect(summary('Ausgaben')).toMatch(/50\.00/))
  })

  it('legt eine neue Kategorie an, benennt um und lehnt Doppelte ab', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Neue Kategorie in Haushalt'), 'Katzenfutter')
    await user.click(
      within(screen.getByLabelText('Neue Kategorie in Haushalt').closest('form')!).getByRole(
        'button',
        { name: 'Hinzufügen' },
      ),
    )
    const name = await screen.findByLabelText('Name Katzenfutter')
    await user.clear(name)
    await user.type(name, 'Tierbedarf')
    await user.tab()
    await waitFor(async () =>
      expect((await db.categories.toArray()).some((c) => c.name === 'Tierbedarf')).toBe(true),
    )
    await user.type(screen.getByLabelText('Neue Kategorie in Haushalt'), 'tierbedarf')
    await user.click(
      within(screen.getByLabelText('Neue Kategorie in Haushalt').closest('form')!).getByRole(
        'button',
        { name: 'Hinzufügen' },
      ),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('schon')
  })

  it('verschiebt Kategorien nach unten und in einen anderen Bereich', async () => {
    const user = await setup()
    const strom = await catByKey('strom')
    const internet = await catByKey('internet')
    await user.click(screen.getByRole('button', { name: 'Strom nach unten' }))
    await waitFor(async () =>
      expect((await db.categories.get(strom.id))!.order).toBeGreaterThan(
        (await db.categories.get(internet.id))!.order,
      ),
    )
    const freizeit = (await db.areas.toArray()).find((a) => a.name === 'Freizeit')!
    await within(screen.getByLabelText('Bereich Strom')).findByRole('option', { name: 'Freizeit' })
    await user.selectOptions(screen.getByLabelText('Bereich Strom'), 'Freizeit')
    await waitFor(async () => expect((await db.categories.get(strom.id))!.areaId).toBe(freizeit.id))
  })

  it('legt einen Bereich an und benennt einen um', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Neuer Bereich'), 'Haustier')
    await user.click(screen.getByRole('button', { name: 'Bereich anlegen' }))
    await screen.findByLabelText('Bereich umbenennen Haustier')
    const wohnen = screen.getByLabelText('Bereich umbenennen Wohnen')
    await user.clear(wohnen)
    await user.type(wohnen, 'Zuhause')
    await user.tab()
    await screen.findByLabelText('Bereich umbenennen Zuhause')
  })

  it('verwaltet Fixkosten-Vorlagen (pausieren)', async () => {
    const miete = await catByKey('miete')
    await store.put('templates', {
      id: crypto.randomUUID(),
      deleted: false,
      categoryId: miete.id,
      amountCents: 80000,
      note: 'Miete',
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      active: true,
    })
    const user = await setup()
    await user.click(await screen.findByText(/Fixkosten-Vorlagen \(1\)/))
    await user.click(screen.getByRole('button', { name: 'Pausieren' }))
    await screen.findByText('pausiert')
    expect((await db.templates.toArray())[0].active).toBe(false)
  })
})
