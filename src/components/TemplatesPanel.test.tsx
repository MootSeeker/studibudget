import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveQuery } from 'dexie-react-hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { buildSharedEqual } from '../domain/split'
import type { Car, Category, Template } from '../domain/types'
import { base } from '../test/factories'
import { TemplatesPanel } from './TemplatesPanel'

const category = (id: string, name: string, areaId = 'a1', catalogKey?: string): Category => ({
  ...base,
  id,
  areaId,
  name,
  type: 'ausgabe',
  fix: true,
  rolloverFrom: null,
  hidden: false,
  order: 0,
  ...(catalogKey ? { catalogKey } : {}),
})
const categories = [category('c1', 'Miete')]
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** Wie auf der Budget-Seite: Die Vorlagen kommen live aus der Datenbank, Änderungen erscheinen sofort. */
function Live(props: { categories: Category[]; cars: Car[] }) {
  const templates = useLiveQuery(() => db.templates.toArray(), [])?.filter((t) => !t.deleted) ?? []
  return (
    <TemplatesPanel
      templates={templates}
      categories={props.categories}
      country="CH"
      cars={props.cars}
    />
  )
}

async function setup(t: Partial<Template> = {}, cars: Car[] = [], cats = categories) {
  await db.wipe()
  const id = newId()
  const template: Omit<Template, 'updatedAt'> = {
    id,
    deleted: false,
    categoryId: 'c1',
    amountCents: 80000,
    note: 'Miete',
    months: ALL,
    active: true,
    ...t,
  }
  await store.put('templates', template)
  const user = userEvent.setup()
  render(<Live categories={cats} cars={cars} />)
  await user.click(await screen.findByText(/Fixkosten-Vorlagen \(1\)/)) // wartet, bis die Vorlage geladen ist
  const current = () => db.templates.get(id) as Promise<Template>
  return { user, current, id }
}
beforeEach(() => vi.restoreAllMocks())

describe('TemplatesPanel', () => {
  it('ohne Vorlagen steht ein Hinweis', async () => {
    render(<TemplatesPanel templates={[]} categories={categories} country="CH" />)
    expect(screen.getByText(/Noch keine Vorlagen/)).toBeInTheDocument()
  })

  it('Betrag ändern: speichert neu, bei gemeinsamen Kosten werden die Anteile mit angepasst', async () => {
    const { user, current } = await setup({ shared: buildSharedEqual(80000, 'me', ['me', 'p1']) })
    const box = screen.getByLabelText('Betrag Vorlage Miete')
    await user.clear(box)
    await user.type(box, '900')
    await user.tab()
    await waitFor(async () => expect((await current()).amountCents).toBe(90000))
    const t = await current()
    expect(t.shared!.parts.reduce((s, p) => s + p.cents, 0)).toBe(90000)
  })

  it.each(['0', '-5', 'abc'])('ungültiger Betrag «%s» ändert nichts', async (value) => {
    const { user, current } = await setup()
    const box = screen.getByLabelText('Betrag Vorlage Miete')
    await user.clear(box)
    await user.type(box, value)
    await user.tab()
    expect((await current()).amountCents).toBe(80000)
  })

  it('Notiz ändern wird getrimmt gespeichert', async () => {
    const { user, current } = await setup()
    const box = screen.getByLabelText('Notiz Vorlage Miete')
    await user.clear(box)
    await user.type(box, '  Neu  ')
    await user.tab()
    await waitFor(async () => expect((await current()).note).toBe('Neu'))
  })

  it('Monate schalten um; der letzte Monat lässt sich nicht abwählen', async () => {
    const { user, current } = await setup({ months: [1, 2] })
    const group = screen.getByRole('group', { name: 'Monate Miete' })
    await user.click(within(group).getByRole('button', { name: 'Mär' }))
    await waitFor(async () => expect((await current()).months).toEqual([1, 2, 3]))
    await user.click(within(group).getByRole('button', { name: 'Jan' }))
    await user.click(within(group).getByRole('button', { name: 'Feb' }))
    await user.click(within(group).getByRole('button', { name: 'Mär' }))
    await waitFor(async () => expect((await current()).months).toEqual([3]))
    await waitFor(() =>
      expect(within(group).getByRole('button', { name: 'Mär' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })

  it('Intervall wählen setzt die passenden Monate ab dem bisherigen Startmonat', async () => {
    const { user, current } = await setup({ months: [3, 6, 9, 12] })
    expect(screen.getByLabelText('Intervall Miete')).toHaveValue('3')
    await user.selectOptions(screen.getByLabelText('Intervall Miete'), 'Halbjährlich')
    await waitFor(async () => expect((await current()).months).toEqual([3, 9]))
  })

  it('eine eigene Monatsauswahl hat die Option «Eigene Auswahl»', async () => {
    await setup({ months: [1, 2, 5] })
    expect(screen.getByLabelText('Intervall Miete')).toHaveValue('eigene')
    expect(screen.getByRole('option', { name: 'Eigene Auswahl' })).toBeInTheDocument()
  })

  it('«In Rückstellung einrechnen» gibt es nur bei seltenen Kosten und schaltet noReserve', async () => {
    const monthly = await setup()
    expect(screen.queryByLabelText('In Rückstellung einrechnen')).not.toBeInTheDocument()
    void monthly
  })
  it('bei seltenen Kosten lässt sich die Rückstellung abschalten', async () => {
    const { user, current } = await setup({ months: [6] })
    await user.click(screen.getByLabelText('In Rückstellung einrechnen'))
    await waitFor(async () => expect((await current()).noReserve).toBe(true))
  })

  it('übersprungene Monate stehen da und lassen sich wieder aufheben', async () => {
    const { user, current } = await setup({ skipMonths: ['2026-10', '2026-11'] })
    expect(screen.getByText(/Übersprungen/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Überspringen aufheben 2026-10 Miete' }))
    await waitFor(async () => expect((await current()).skipMonths).toEqual(['2026-11']))
  })

  it('pausieren und fortsetzen', async () => {
    const { user, current } = await setup()
    await user.click(screen.getByRole('button', { name: 'Pausieren' }))
    await waitFor(async () => expect((await current()).active).toBe(false))
    expect(await screen.findByText('pausiert')).toBeInTheDocument()
  })

  it('löschen nur nach Bestätigung', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, current } = await setup()
    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(confirm).toHaveBeenCalled()
    expect((await current()).deleted).toBe(false)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    await waitFor(async () => expect((await current()).deleted).toBe(true))
  })

  it('Auto-Auswahl nur für Auto-Vorlagen: zuweisen und wieder lösen', async () => {
    const car: Car = { ...base, id: 'car1', name: 'Golf', archived: false, order: 0 }
    const archived: Car = { ...base, id: 'car2', name: 'Alter Opel', archived: true, order: 1 }
    const cats = [category('c1', 'Versicherung', 'auto', 'auto_versicherung')]
    const { user, current } = await setup({}, [car, archived], cats)
    const select = screen.getByLabelText('Auto Versicherung')
    expect(screen.queryByRole('option', { name: 'Alter Opel' })).not.toBeInTheDocument()
    await user.selectOptions(select, 'Golf')
    await waitFor(async () => expect((await current()).carId).toBe('car1'))
    await user.selectOptions(select, 'Kein bestimmtes Auto')
    await waitFor(async () => expect((await current()).carId).toBeUndefined())
  })

  it('bei einer normalen Kategorie gibt es keine Auto-Auswahl', async () => {
    const car: Car = { ...base, id: 'car1', name: 'Golf', archived: false, order: 0 }
    await setup({}, [car])
    expect(screen.queryByLabelText(/^Auto /)).not.toBeInTheDocument()
  })
})
