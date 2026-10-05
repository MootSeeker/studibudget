import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { base, cat, tx } from '../test/factories'
import type { AreaGroup } from '../domain/ledger'
import type { Car, Person, Template } from '../domain/types'
import { BookTemplatesDialog } from './BookTemplatesDialog'
import { MonthList } from './MonthList'
import { MonthSelect } from './MonthSelect'
import { MONTH_NAMES } from '../lib/months'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")

describe('MonthSelect', () => {
  it('bietet alle zwölf Monate an und meldet die Auswahl als Zahl 1–12', async () => {
    const onChange = vi.fn()
    render(<MonthSelect label="Start" value={3} onChange={onChange} />)
    const select = screen.getByLabelText('Start')
    expect(select).toHaveValue('3')
    expect(screen.getAllByRole('option')).toHaveLength(12)
    expect(MONTH_NAMES[2]).toBe('März')
    await userEvent.setup().selectOptions(select, 'Dezember')
    expect(onChange).toHaveBeenCalledWith(12)
  })
})

describe('MonthList', () => {
  const area = { ...base, id: 'a', name: 'Wohnen', order: 0, hidden: false }
  const category = cat('miete', 'ausgabe')
  const groups = (txs: ReturnType<typeof tx>[]): AreaGroup[] => [
    { area, total: 1000, categories: [{ category, total: 1000, txs }] } as unknown as AreaGroup,
  ]
  const person = { ...base, id: 'p1', name: 'Anna', active: true } as Person
  const car = { ...base, id: 'c1', name: 'Golf', archived: false, order: 0 } as Car

  it('ohne Buchungen steht ein Hinweis', () => {
    render(<MonthList groups={[]} country="CH" persons={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/noch keine Buchungen/)).toBeInTheDocument()
  })

  it('zeigt Tag, Notiz, Betrag und die Aktionen; Bearbeiten und Löschen melden die Buchung', async () => {
    const t = tx({
      id: 't1',
      date: '2026-10-05',
      categoryId: 'miete',
      myAmountCents: 1000,
      note: 'Miete',
    })
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <MonthList
        groups={groups([t])}
        country="CH"
        persons={[]}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('05.10.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bearbeiten Miete' }))
    expect(onEdit).toHaveBeenCalledWith(t)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Löschen Miete' }))
    expect(onDelete).toHaveBeenCalledWith(t)
  })

  it('ohne Notiz erscheint ein Strich und die Aktionen nennen die Kategorie', () => {
    const t = tx({ id: 't1', date: '2026-10-05', categoryId: 'miete', myAmountCents: 1000 })
    render(
      <MonthList
        groups={groups([t])}
        country="CH"
        persons={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bearbeiten miete' })).toBeInTheDocument()
  })

  it('geteilte Buchung: nennt Gesamtbetrag und wer bezahlt hat, unbekannte Personen als «unbekannt»', () => {
    const shared = (paidBy: string) => ({
      paidBy,
      parts: [
        { who: 'me', cents: 500 },
        { who: 'p1', cents: 500 },
      ],
    })
    render(
      <MonthList
        groups={groups([
          tx({
            id: 't1',
            date: '2026-10-05',
            categoryId: 'miete',
            amountCents: 1000,
            myAmountCents: 500,
            shared: shared('p1'),
          }),
          tx({
            id: 't2',
            date: '2026-10-06',
            categoryId: 'miete',
            amountCents: 1000,
            myAmountCents: 500,
            shared: shared('me'),
          }),
          tx({
            id: 't3',
            date: '2026-10-07',
            categoryId: 'miete',
            amountCents: 1000,
            myAmountCents: 500,
            shared: shared('weg'),
          }),
        ])}
        country="CH"
        persons={[person]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const text = norm(document.body.textContent)
    expect(text).toContain('von CHF 10.00, bezahlt von Anna')
    expect(text).toContain('bezahlt von mir')
    expect(text).toContain('bezahlt von unbekannt')
  })

  it('zeigt das Auto und kennzeichnet Entnahmen mit negativem Betrag', () => {
    render(
      <MonthList
        groups={groups([
          tx({
            id: 't1',
            date: '2026-10-05',
            categoryId: 'miete',
            myAmountCents: 2000,
            carId: 'c1',
          }),
          tx({
            id: 't2',
            date: '2026-10-06',
            categoryId: 'miete',
            myAmountCents: 3000,
            goalDirection: 'entnahme',
          }),
        ])}
        country="CH"
        persons={[]}
        cars={[car]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Golf')).toBeInTheDocument()
    expect(screen.getByText('Entnahme')).toBeInTheDocument()
    expect(norm(document.body.textContent)).toMatch(/[-\u2212]30\.00/)
  })
})

describe('BookTemplatesDialog', () => {
  const template = (id: string, categoryId: string, amountCents: number, note = ''): Template => ({
    ...base,
    id,
    categoryId,
    amountCents,
    note,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    active: true,
  })
  const categories = [cat('c-miete', 'ausgabe'), cat('c-handy', 'ausgabe')].map((c) => ({
    ...c,
    name: c.id === 'c-miete' ? 'Miete' : 'Handy',
  }))
  function setup(over: Partial<Parameters<typeof BookTemplatesDialog>[0]> = {}) {
    const props = {
      month: '2026-10',
      country: 'CH' as const,
      templates: [
        template('t1', 'c-miete', 80000, 'Miete Oktober'),
        template('t2', 'c-handy', 3990),
      ],
      categories,
      onBook: vi.fn().mockResolvedValue(undefined),
      onSkip: vi.fn().mockResolvedValue(undefined),
      onClose: vi.fn(),
      ...over,
    }
    render(<BookTemplatesDialog {...props} />)
    return { props, user: userEvent.setup() }
  }

  it('zeigt den Monat, die Vorlagen und die Summe', () => {
    setup()
    expect(
      screen.getByRole('dialog', { name: 'Fixkosten für Oktober 2026 buchen' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Betrag Miete')).toHaveValue('800.00')
    expect(norm(document.body.textContent)).toContain('Summe: CHF 839.90')
  })

  it('bucht die angehakten Vorlagen mit geändertem Betrag und getrimmter Notiz, dann schliesst es', async () => {
    const { props, user } = setup()
    await user.clear(screen.getByLabelText('Betrag Miete'))
    await user.type(screen.getByLabelText('Betrag Miete'), '820,50')
    await user.clear(screen.getByLabelText('Notiz Miete'))
    await user.type(screen.getByLabelText('Notiz Miete'), '  Okt  ')
    await user.click(screen.getByLabelText('Handy buchen')) // abwählen
    await user.click(screen.getByRole('button', { name: 'Buchen' }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    expect(props.onBook).toHaveBeenCalledWith([
      { template: props.templates[0], amountCents: 82050, note: 'Okt' },
    ])
  })

  it.each(['0', '-5', 'abc', ''])(
    'ungültiger Betrag «%s» wird gemeldet, nichts gebucht',
    async (amount) => {
      const { props, user } = setup()
      await user.clear(screen.getByLabelText('Betrag Handy'))
      if (amount) await user.type(screen.getByLabelText('Betrag Handy'), amount)
      await user.click(screen.getByRole('button', { name: 'Buchen' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Ungültiger Betrag bei «Handy»')
      expect(props.onBook).not.toHaveBeenCalled()
      expect(props.onClose).not.toHaveBeenCalled()
    },
  )

  it('ein abgewählter Eintrag mit ungültigem Betrag stört nicht', async () => {
    const { props, user } = setup()
    await user.clear(screen.getByLabelText('Betrag Handy'))
    await user.click(screen.getByLabelText('Handy buchen'))
    await user.click(screen.getByRole('button', { name: 'Buchen' }))
    await waitFor(() => expect(props.onBook).toHaveBeenCalled())
  })

  it('ohne angehakte Vorlage schliesst «Buchen» einfach', async () => {
    const { props, user } = setup()
    await user.click(screen.getByLabelText('Miete buchen'))
    await user.click(screen.getByLabelText('Handy buchen'))
    await user.click(screen.getByRole('button', { name: 'Buchen' }))
    expect(props.onBook).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalled()
  })

  it('ein Fehler beim Buchen wird angezeigt, der Dialog bleibt offen und lässt sich wiederholen', async () => {
    const { props, user } = setup({
      onBook: vi.fn().mockRejectedValue(new Error('Speichern ging schief')),
    })
    await user.click(screen.getByRole('button', { name: 'Buchen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Speichern ging schief')
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('Überspringen entfernt die Zeile, bei der letzten schliesst der Dialog', async () => {
    const { props, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Miete diesen Monat überspringen' }))
    await waitFor(() => expect(screen.queryByLabelText('Betrag Miete')).not.toBeInTheDocument())
    expect(props.onSkip).toHaveBeenCalledWith(['t1'])
    expect(props.onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Handy diesen Monat überspringen' }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
  })

  it('scheitert das Überspringen, bleibt die Zeile und der Fehler wird gezeigt', async () => {
    const { user } = setup({ onSkip: vi.fn().mockRejectedValue(new Error('Nicht möglich')) })
    await user.click(screen.getByRole('button', { name: 'Miete diesen Monat überspringen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nicht möglich')
    expect(screen.getByLabelText('Betrag Miete')).toBeInTheDocument()
  })

  it('«Abbrechen» schliesst, ohne zu buchen', async () => {
    const { props, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(props.onClose).toHaveBeenCalled()
    expect(props.onBook).not.toHaveBeenCalled()
  })

  it('unbekannte Kategorie wird als «Unbekannt» gezeigt', () => {
    setup({ templates: [template('t9', 'weg', 100)] })
    expect(screen.getByLabelText('Betrag Unbekannt')).toBeInTheDocument()
  })
})
