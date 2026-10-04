import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { newId } from '../data/seed'
import { store } from '../data/store'
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

  it('Auto: Auswahl nur bei Auto-Kategorien, mit einem Auto vorgewählt', async () => {
    await db.wipe()
    await completeOnboarding(db, {
      country: 'CH',
      living: 'allein',
      hasCar: true,
      partnerSharePct: 50,
      persons: [],
      semesters: defaultSemesters('CH'),
      budgets: {},
    })
    const golf = newId()
    await store.put('cars', { id: golf, deleted: false, name: 'Golf', archived: false, order: 0 })
    const { user, pick } = await setup()
    await screen.findByRole('option', { name: 'Parkplatz' })
    await pick('Kategorie', 'Miete')
    expect(screen.queryByLabelText('Auto')).not.toBeInTheDocument()
    await pick('Kategorie', 'Parkplatz')
    await waitFor(() => expect(screen.getByLabelText('Auto')).toHaveValue(golf))
    await user.type(screen.getByLabelText(/Betrag/), '80')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText('Gespeichert.')
    expect((await db.transactions.toArray())[0].carId).toBe(golf)
  })

  it('Auto: mit zwei Autos ist nichts vorgewählt, «kein bestimmtes» ist möglich', async () => {
    await db.wipe()
    await completeOnboarding(db, {
      country: 'CH',
      living: 'allein',
      hasCar: true,
      partnerSharePct: 50,
      persons: [],
      semesters: defaultSemesters('CH'),
      budgets: {},
    })
    for (const [i, name] of ['Golf', 'Vespa'].entries())
      await store.put('cars', { id: newId(), deleted: false, name, archived: false, order: i })
    const { user, pick } = await setup()
    await screen.findByRole('option', { name: 'Parkplatz' })
    await pick('Kategorie', 'Parkplatz')
    const auto = await screen.findByLabelText('Auto')
    await waitFor(() => expect(auto).toHaveValue(''))
    await user.selectOptions(auto, 'Vespa')
    await user.type(screen.getByLabelText(/Betrag/), '20')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText('Gespeichert.')
    const vespa = (await db.cars.toArray()).find((c) => c.name === 'Vespa')!
    expect((await db.transactions.toArray())[0].carId).toBe(vespa.id)
  })

  async function makeTemplate(key: string, cents: number) {
    const cat = (await db.categories.toArray()).find((c) => c.catalogKey === key)!
    const id = newId()
    await store.put('templates', {
      id,
      deleted: false,
      categoryId: cat.id,
      amountCents: cents,
      note: '',
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      active: true,
    })
    return id
  }

  it('Fixkosten lassen sich auch für einen künftigen Monat buchen', async () => {
    await makeTemplate('miete', 80000)
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    const banner = (await screen.findByText(/Fixkosten für .* buchen\?/)).closest('div')!
    await user.click(within(banner).getByRole('button', { name: 'Prüfen und buchen' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Buchen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const [tx] = await db.transactions.toArray()
    expect(tx.templateMonth).toBe(tx.date.slice(0, 7))
    expect(tx.templateMonth! > new Date().toISOString().slice(0, 7)).toBe(true)
  })

  it('«Überspringen» blendet eine Fixkost nur für diesen Monat aus; Aufheben in den Vorlagen', async () => {
    const id = await makeTemplate('miete', 80000)
    await makeTemplate('handy', 5000)
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    await user.click(await screen.findByRole('button', { name: 'Prüfen und buchen' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Miete diesen Monat überspringen',
      }),
    )
    await waitFor(async () => expect((await db.templates.get(id))!.skipMonths).toHaveLength(1))
    expect(await screen.findByText(/\(1 offen\)/)).toBeInTheDocument()
    const skipped = (await db.templates.get(id))!.skipMonths![0]
    // Im übernächsten Monat ist die Vorlage weiter fällig.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }))
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(await screen.findByText(/\(2 offen\)/)).toBeInTheDocument()
    expect(skipped).toMatch(/^\d{4}-\d{2}$/)
  })

  it('«Alle überspringen» und Löschen einer Vorlagenbuchung mit Nachfrage', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const id = await makeTemplate('miete', 80000)
    const { user } = await setup()
    await user.click(await screen.findByRole('button', { name: 'Alle überspringen' }))
    await waitFor(async () => expect((await db.templates.get(id))!.skipMonths).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText(/buchen\?/)).not.toBeInTheDocument())

    // Gebuchte Vorlagen-Buchung löschen und «auch überspringen» bestätigen.
    await db.templates.update(id, { skipMonths: [] })
    await user.click(await screen.findByRole('button', { name: 'Prüfen und buchen' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Buchen' }))
    await user.click(await screen.findByRole('button', { name: /Löschen/ }))
    await waitFor(async () => expect((await db.templates.get(id))!.skipMonths).toHaveLength(1))
    expect(screen.queryByText(/buchen\?/)).not.toBeInTheDocument()
  })
})
