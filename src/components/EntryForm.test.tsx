import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EntryDraft } from '../domain/entry'
import type { Area, Category, Person, Settings } from '../domain/types'
import { EntryForm, type EntryFormProps } from './EntryForm'

const base = { deleted: false, updatedAt: '' }
const settings: Settings = {
  ...base,
  id: 's',
  country: 'CH',
  living: 'wg',
  hasCar: false,
  myPartnerSharePct: 50,
  semesters: [],
  ampel: { yellowPct: 80, redPct: 100 },
  theme: 'system',
  backupReminderDays: 30,
  lastBackupAt: null,
  onboardingDone: true,
}
const areas: Area[] = [{ ...base, id: 'a', name: 'Lebensmittel', order: 0, hidden: false }]
const categories: Category[] = [
  {
    ...base,
    id: 'c',
    areaId: 'a',
    name: 'Einkauf',
    type: 'ausgabe',
    fix: false,
    rolloverFrom: null,
    hidden: false,
    order: 0,
  },
]
const person = (id: string, name: string): Person => ({ ...base, id, name, active: true })

function props(over: Partial<EntryFormProps> = {}): EntryFormProps {
  return {
    settings,
    categories,
    areas,
    persons: [person('anna', 'Anna')],
    goals: [],
    defaultDate: '2026-10-03',
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Betrag/), '90')
  await user.selectOptions(screen.getByLabelText('Kategorie'), 'Einkauf')
  await user.click(screen.getByLabelText('Gemeinsame Ausgabe'))
  await user.click(screen.getByRole('button', { name: 'Speichern' }))
}
const lastDraft = (onSubmit: EntryFormProps['onSubmit']) =>
  vi.mocked(onSubmit).mock.calls.at(-1)![0] as EntryDraft

describe('EntryForm: Beteiligte bei gemeinsamen Ausgaben', () => {
  it('Standard: ich und alle aktiven Personen', async () => {
    const p = props()
    render(<EntryForm {...p} />)
    await fillAndSubmit(userEvent.setup())
    expect(
      lastDraft(p.onSubmit)
        .shared!.parts.map((x) => x.who)
        .sort(),
    ).toEqual(['anna', 'me'])
    expect(lastDraft(p.onSubmit).myAmountCents).toBe(4500)
  })

  it(
    'Personen, die erst nach dem Öffnen geladen werden, sind trotzdem beteiligt (Regression)',
    { tags: ['regression'] },
    async () => {
      const p = props({ persons: [] })
      const { rerender } = render(<EntryForm {...p} />)
      rerender(<EntryForm {...p} persons={[person('anna', 'Anna')]} />) // Personen kommen nachträglich
      await fillAndSubmit(userEvent.setup())
      expect(
        lastDraft(p.onSubmit)
          .shared!.parts.map((x) => x.who)
          .sort(),
      ).toEqual(['anna', 'me'])
      expect(lastDraft(p.onSubmit).myAmountCents).toBe(4500)
    },
  )

  it('eine später hinzugekommene Person ist ebenfalls beteiligt, solange man die Auswahl nicht selbst geändert hat', async () => {
    const p = props()
    const { rerender } = render(<EntryForm {...p} />)
    rerender(<EntryForm {...p} persons={[person('anna', 'Anna'), person('ben', 'Ben')]} />)
    await fillAndSubmit(userEvent.setup())
    expect(lastDraft(p.onSubmit).shared!.parts).toHaveLength(3)
    expect(lastDraft(p.onSubmit).myAmountCents).toBe(3000)
  })

  it('eigene Auswahl bleibt bestehen, auch wenn weitere Personen dazukommen', async () => {
    const user = userEvent.setup()
    const p = props({ persons: [person('anna', 'Anna'), person('ben', 'Ben')] })
    const { rerender } = render(<EntryForm {...p} />)
    await user.type(screen.getByLabelText(/Betrag/), '90')
    await user.selectOptions(screen.getByLabelText('Kategorie'), 'Einkauf')
    await user.click(screen.getByLabelText('Gemeinsame Ausgabe'))
    await user.click(screen.getByLabelText('Ben')) // Ben nicht beteiligt
    rerender(
      <EntryForm
        {...p}
        persons={[person('anna', 'Anna'), person('ben', 'Ben'), person('cleo', 'Cleo')]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(
      lastDraft(p.onSubmit)
        .shared!.parts.map((x) => x.who)
        .sort(),
    ).toEqual(['anna', 'me'])
    expect(lastDraft(p.onSubmit).myAmountCents).toBe(4500)
  })
})
