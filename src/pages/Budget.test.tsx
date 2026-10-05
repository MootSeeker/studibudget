import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

/** Öffnet die Budget-Seite im gewünschten Reiter; die Bereiche werden aufgeklappt, damit ihre Felder da sind. */
async function setup(ansicht: 'monat' | 'kategorien' | 'fixkosten' | 'datei' = 'monat') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[ansicht === 'monat' ? '/budget' : `/budget?ansicht=${ansicht}`]}>
      <Budget />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Budget' })
  if (ansicht === 'monat' || ansicht === 'kategorien') {
    // Erst wenn die Bereiche geladen sind, weiss «Alle aufklappen», was es aufklappen soll.
    await screen.findByRole('button', { name: /Haushalt/ })
    await user.click(await screen.findByRole('button', { name: 'Alle aufklappen' }))
  }
  if (ansicht === 'monat') await screen.findByLabelText('Monatsbudget Miete')
  return user
}
/** Öffnet die Bearbeitung einer Kategorie (Reiter «Kategorien»). */
const bearbeiten = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(await screen.findByRole('button', { name: `Kategorie bearbeiten ${name}` }))
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
    const user = await setup('kategorien')
    const strom = await catByKey('strom')
    await bearbeiten(user, 'Strom')
    const row = screen.getByLabelText('Name Strom').closest('li')!
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

    await user.click(screen.getByRole('button', { name: 'Kategorien' }))
    await user.click(await screen.findByRole('button', { name: 'Alle aufklappen' }))
    await bearbeiten(user, 'Strom')
    const row = () => screen.getByLabelText('Name Strom').closest('li')!
    await user.click(within(row()).getByRole('button', { name: 'Ausblenden' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Kategorie bearbeiten Strom' }),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: 'Monatsbudget' }))
    await waitFor(() => expect(summary('Ausgaben')).toMatch(/0\.00/))

    await user.click(screen.getByRole('button', { name: 'Kategorien' }))
    await user.click(screen.getByLabelText('Ausgeblendete Kategorien anzeigen'))
    await user.click(await screen.findByRole('button', { name: 'Alle aufklappen' }))
    await bearbeiten(user, 'Strom')
    await user.click(within(row()).getByRole('button', { name: 'Einblenden' }))
    await user.click(screen.getByRole('button', { name: 'Monatsbudget' }))
    await waitFor(() => expect(summary('Ausgaben')).toMatch(/50\.00/))
  })

  it('legt eine neue Kategorie an, benennt um und lehnt Doppelte ab', async () => {
    const user = await setup('kategorien')
    await user.type(screen.getByLabelText('Neue Kategorie in Haushalt'), 'Katzenfutter')
    await user.click(
      within(screen.getByLabelText('Neue Kategorie in Haushalt').closest('form')!).getByRole(
        'button',
        { name: 'Hinzufügen' },
      ),
    )
    await bearbeiten(user, 'Katzenfutter')
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
    const user = await setup('kategorien')
    const strom = await catByKey('strom')
    const internet = await catByKey('internet')
    await bearbeiten(user, 'Strom')
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
    const user = await setup('kategorien')
    await user.type(screen.getByLabelText('Neuer Bereich'), 'Haustier')
    await user.click(screen.getByRole('button', { name: 'Bereich anlegen' }))
    await screen.findByRole('button', { name: /Haustier/ })
    await user.click(screen.getByRole('button', { name: 'Alle aufklappen' }))
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
    const user = await setup('fixkosten')
    await user.click(await screen.findByText(/Fixkosten-Vorlagen \(1\)/))
    await user.click(screen.getByRole('button', { name: 'Pausieren' }))
    await screen.findByText('pausiert')
    expect((await db.templates.toArray())[0].active).toBe(false)
  })

  describe('Budget exportieren und importieren (Issue #30)', () => {
    const alive = async () => (await db.budgets.toArray()).filter((b) => !b.deleted)

    async function mitBudget() {
      const miete = await catByKey('miete')
      await store.put('budgets', {
        id: 'b-miete',
        deleted: false,
        categoryId: miete.id,
        validFrom: addMonths(NOW, -1),
        amountCents: 80000,
      })
      const user = await setup('datei')
      // Die Seite liest Budget und Kategorien asynchron; erst wenn sie da sind, darf es losgehen.
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Budget exportieren' })).toBeEnabled(),
      )
      await new Promise((r) => setTimeout(r, 300))
      return user
    }

    it('ohne Budgetwerte ist der Export gesperrt; Zurücksetzen gibt es hier nicht mehr', async () => {
      await setup('datei')
      expect(screen.getByRole('button', { name: 'Budget exportieren' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: /zurücksetzen/i })).not.toBeInTheDocument()
    })

    it('Import ersetzt das Budget und nennt, was nicht passte', async () => {
      const user = await mitBudget()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const datei = {
        app: 'studibudget',
        kind: 'budget',
        schemaVersion: 1,
        exportedAt: '2026-10-05T00:00:00Z',
        items: [
          { name: 'Einkauf zuhause', type: 'ausgabe', validFrom: '2026-01', amountCents: 40000 },
          { name: 'Gibt es nicht', type: 'ausgabe', validFrom: '2026-01', amountCents: 100 },
        ],
      }
      await user.upload(
        screen.getByLabelText('Budget-Datei wählen'),
        new File([JSON.stringify(datei)], 'budget.json', { type: 'application/json' }),
      )
      expect(
        await screen.findByText(/1 Budgetwerte übernommen\..*Gibt es nicht/),
      ).toBeInTheDocument()
      const rest = await alive()
      expect(rest).toHaveLength(1)
      expect(rest[0].amountCents).toBe(40000)
      expect(rest[0].categoryId).toBe((await catByKey('einkauf')).id)
      confirm.mockRestore()
    })

    it('eine ungültige Datei ändert nichts und zeigt den Grund', async () => {
      const user = await mitBudget()
      await user.upload(
        screen.getByLabelText('Budget-Datei wählen'),
        new File(['kein json'], 'budget.json', { type: 'application/json' }),
      )
      expect(await screen.findByRole('alert')).toHaveTextContent('kein gültiges JSON')
      expect(await alive()).toHaveLength(1)
    })

    it('Export lädt eine Datei mit den Werten herunter', async () => {
      const user = await mitBudget()
      let blob: Blob | undefined
      URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
        blob = b as Blob
        return 'blob:test'
      })
      URL.revokeObjectURL = vi.fn()
      const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      await user.click(screen.getByRole('button', { name: 'Budget exportieren' }))
      expect(await screen.findByText('Das Budget wurde heruntergeladen.')).toBeInTheDocument()
      const inhalt = JSON.parse(await blob!.text())
      expect(inhalt.items).toEqual([
        { name: 'Miete', type: 'ausgabe', validFrom: addMonths(NOW, -1), amountCents: 80000 },
      ])
      klick.mockRestore()
    })
  })

  describe('Reiter und Bereiche (Issue #84)', () => {
    it('zeigt pro Bereich Anzahl und Summe im Kopf und startet eingeklappt', async () => {
      const user = userEvent.setup()
      const miete = await catByKey('miete')
      await store.put('budgets', {
        id: crypto.randomUUID(),
        deleted: false,
        categoryId: miete.id,
        validFrom: NOW,
        amountCents: 80000,
      })
      render(
        <MemoryRouter initialEntries={['/budget']}>
          <Budget />
        </MemoryRouter>,
      )
      const kopf = await screen.findByRole('button', { name: /Wohnen/ })
      expect(kopf).toHaveAttribute('aria-expanded', 'false')
      await waitFor(() => expect(norm(kopf.textContent)).toMatch(/\d+ Kategorien · CHF 800\.00/))
      expect(screen.queryByLabelText('Monatsbudget Miete')).not.toBeInTheDocument()
      await user.click(kopf)
      expect(await screen.findByLabelText('Monatsbudget Miete')).toHaveValue('800.00')
    })

    it('«Alle zuklappen» schliesst alles, und der Stand bleibt nach dem Neuladen', async () => {
      const user = await setup()
      await user.click(screen.getByRole('button', { name: 'Alle zuklappen' }))
      expect(screen.queryByLabelText('Monatsbudget Miete')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /Wohnen/ }))
      expect(await screen.findByLabelText('Monatsbudget Miete')).toBeInTheDocument()

      // Neu laden: nur «Wohnen» ist noch offen
      document.body.innerHTML = ''
      render(
        <MemoryRouter initialEntries={['/budget']}>
          <Budget />
        </MemoryRouter>,
      )
      expect(await screen.findByLabelText('Monatsbudget Miete')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Lebensmittel/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    })

    it('Reiter wechseln den Inhalt und stehen in der Adresse', async () => {
      const user = await setup()
      expect(screen.getByRole('button', { name: 'Monatsbudget' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await user.click(screen.getByRole('button', { name: 'Fixkosten' }))
      expect(await screen.findByText(/Fixkosten-Vorlagen/)).toBeInTheDocument()
      expect(screen.queryByLabelText('Monatsbudget Miete')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Datei' }))
      expect(await screen.findByRole('button', { name: 'Budget exportieren' })).toBeInTheDocument()
    })

    it('Kategorien: Bearbeiten klappt die Steuerzeile auf und zu', async () => {
      const user = await setup('kategorien')
      expect(screen.queryByLabelText('Name Strom')).not.toBeInTheDocument()
      await bearbeiten(user, 'Strom')
      expect(screen.getByLabelText('Name Strom')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Kategorie bearbeiten Strom' }))
      expect(screen.queryByLabelText('Name Strom')).not.toBeInTheDocument()
    })
  })
})
