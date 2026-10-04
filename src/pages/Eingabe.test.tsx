import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { defaultSemesters } from '../domain/period'
import { Eingabe } from './Eingabe'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")

beforeEach(async () => {
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
})
afterEach(() => vi.restoreAllMocks())

async function setup() {
  const user = userEvent.setup()
  render(<Eingabe />)
  await screen.findByRole('form', { name: 'Neue Buchung' })
  // Die Kategorien werden asynchron gelesen; erst dann lässt sich eine auswählen.
  await screen.findByRole('option', { name: 'Einkauf zuhause' })
  const pick = async (label: string, option: string) =>
    user.selectOptions(screen.getByLabelText(label), option)
  const form = () => within(screen.getByRole('form'))
  return { user, pick, form }
}

describe('Eingabe-Seite', () => {
  it('erfasst eine Ausgabe, zeigt sie gruppiert mit Zwischensumme und leert das Formular', async () => {
    const { user, pick } = await setup()
    await user.type(screen.getByLabelText(/Betrag/), '23.50')
    await pick('Kategorie', 'Einkauf zuhause')
    await user.type(screen.getByLabelText(/Notiz/), 'Migros')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Migros')).toBeInTheDocument()
    const lebensmittel = screen.getByText('Lebensmittel').closest('details')!
    expect(norm(lebensmittel.textContent)).toMatch(/Lebensmittel\s*CHF 23\.50/)
    expect(screen.getByLabelText(/Betrag/)).toHaveValue('')
    expect(await db.outbox.count()).toBeGreaterThan(0)
    expect(await db.transactions.count()).toBe(1)
  })

  it('meldet fehlende Angaben, ohne zu speichern', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('alert')).toHaveTextContent('gültigen Betrag')
    await user.type(screen.getByLabelText(/Betrag/), '5')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Kategorie')
    expect(await db.transactions.count()).toBe(0)
  })

  it('WG: gemeinsame Ausgabe 90.00 mit Anna → mein Anteil 45.00, Anzeige «von … bezahlt von …»', async () => {
    const { user, pick } = await setup()
    await user.type(screen.getByLabelText(/Betrag/), '90')
    await pick('Kategorie', 'Einkauf zuhause')
    await user.click(screen.getByLabelText('Gemeinsame Ausgabe'))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText(/bezahlt von mir/)
    const [tx] = await db.transactions.toArray()
    expect(tx).toMatchObject({ amountCents: 9000, myAmountCents: 4500 })
    expect(tx.shared!.parts).toHaveLength(2)
    expect(norm(screen.getByText(/bezahlt von mir/).closest('li')!.textContent)).toMatch(
      /CHF 45\.00/,
    )
  })

  it('Einnahmen zeigen nur Einnahme-Kategorien und fließen in die Summe', async () => {
    const { user, pick } = await setup()
    await user.click(screen.getByLabelText('Einnahme'))
    await user.type(screen.getByLabelText(/Betrag/), '1500')
    await pick('Kategorie', 'Nettolohn / Nebenjob')
    expect(within(screen.getByLabelText('Kategorie')).queryByText('Miete')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText('Einnahmen', { selector: 'summary span' })
    expect(
      norm(screen.getByText('Einnahmen', { selector: 'dt' }).nextElementSibling!.textContent),
    ).toMatch(/1'?500\.00/)
  })

  it('bearbeitet eine Buchung', async () => {
    const { user, pick } = await setup()
    await user.type(screen.getByLabelText(/Betrag/), '10')
    await pick('Kategorie', 'Mensa / Mittagessen')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await user.click(await screen.findByRole('button', { name: /Bearbeiten/ }))
    const amount = await screen.findByDisplayValue('10.00')
    await user.clear(amount)
    await user.type(amount, '12.30')
    await user.click(screen.getByRole('button', { name: 'Änderung speichern' }))
    await waitFor(async () => expect((await db.transactions.toArray())[0].amountCents).toBe(1230))
    expect(await db.transactions.count()).toBe(1)
    await screen.findByRole('form', { name: 'Neue Buchung' })
  })

  it('löscht eine Buchung nach Bestätigung (Grabstein bleibt für den Sync)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, pick } = await setup()
    await user.type(screen.getByLabelText(/Betrag/), '10')
    await pick('Kategorie', 'Mensa / Mittagessen')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await user.click(await screen.findByRole('button', { name: /Löschen/ }))
    await screen.findByText(/noch keine Buchungen/)
    expect((await db.transactions.toArray())[0].deleted).toBe(true)
  })

  it('Fixkosten-Vorlage: einmal anlegen, im Vormonat buchen, danach nicht mehr offen', async () => {
    const { user, pick } = await setup()
    await user.type(screen.getByLabelText(/Betrag/), '800')
    await pick('Kategorie', 'Miete')
    await user.type(screen.getByLabelText(/Notiz/), 'Miete WG')
    await user.click(screen.getByLabelText(/Wiederholen/))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText('Miete WG')
    expect(await db.templates.count()).toBe(1)
    expect(screen.queryByText(/buchen\?/)).not.toBeInTheDocument() // diesen Monat bereits gebucht

    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    const banner = (await screen.findByText(/Fixkosten für .* buchen\?/)).closest('div')!
    expect(banner).toHaveTextContent(/Fixkosten für .* buchen\? \(1 offen\)/)
    await user.click(within(banner).getByRole('button', { name: 'Prüfen und buchen' }))
    const dialog = screen.getByRole('dialog')
    const betrag = within(dialog).getByLabelText('Betrag Miete')
    expect(betrag).toHaveValue('800.00')
    await user.clear(betrag)
    await user.type(betrag, '820')
    await user.click(within(dialog).getByRole('button', { name: 'Buchen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText(/buchen\? \(/)).not.toBeInTheDocument())
    const all = await db.transactions.toArray()
    expect(all).toHaveLength(2)
    expect(all.find((t) => t.templateMonth && t.amountCents === 82000)).toMatchObject({
      templateId: (await db.templates.toArray())[0].id,
    })
  })

  it('Doppelklick auf «Buchen» erzeugt keine doppelten Buchungen', async () => {
    const { user, pick } = await setup()
    await user.type(screen.getByLabelText(/Betrag/), '50')
    await pick('Kategorie', 'Handyabo')
    await user.click(screen.getByLabelText(/Wiederholen/))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText('Gespeichert.')
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    await user.click(await screen.findByRole('button', { name: 'Prüfen und buchen' }))
    const buchen = within(screen.getByRole('dialog')).getByRole('button', { name: 'Buchen' })
    await user.dblClick(buchen)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await db.transactions.count()).toBe(2)
  })

  it('Wiederholen mit Intervall «Jährlich»: Vorlage mit einem Fälligkeitsmonat, Hinweis erscheint im Banner nicht', async () => {
    const { user, pick } = await setup()
    await user.type(screen.getByLabelText(/Betrag/), '600')
    await pick('Kategorie', 'Hausrat / Haftpflicht')
    await user.click(screen.getByLabelText(/Wiederholen/))
    await user.selectOptions(screen.getByLabelText('Intervall'), 'Jährlich')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText('Gespeichert.')
    const [tpl] = await db.templates.toArray()
    const tx = (await db.transactions.toArray())[0]
    expect(tpl.months).toEqual([Number(tx.date.slice(5, 7))])
    expect(tx.templateId).toBe(tpl.id)
    // Im Vormonat ist die jährliche Vorlage nicht fällig.
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    await screen.findByText(/noch keine Buchungen/)
    expect(screen.queryByText(/buchen\?/)).not.toBeInTheDocument()
  })
})
