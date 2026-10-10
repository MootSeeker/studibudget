import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Category } from '../domain/types'
import type { Proposal } from '../domain/proposals'
import { ProposalList } from './ProposalList'

function cat(id: string, name: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    name,
    areaId: 'a1',
    type: 'ausgabe',
    fix: false,
    rolloverFrom: null,
    hidden: false,
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...extra,
  } as Category
}

const CATS = [cat('k1', 'Essen'), cat('k2', 'Kleider', { hidden: true })]
const U1 = '11111111-1111-4111-8111-111111111111'
const P: Proposal = {
  id: U1,
  date: '2026-10-09',
  amountCents: 1850,
  categoryId: 'k1',
  categoryName: 'Essen',
  note: 'Mittagessen',
}

function setup() {
  const onConfirm = vi.fn(async () => {})
  const onDiscard = vi.fn()
  render(
    <ProposalList proposals={[P]} categories={CATS} onConfirm={onConfirm} onDiscard={onDiscard} />,
  )
  return { user: userEvent.setup(), onConfirm, onDiscard }
}

describe('ProposalList', () => {
  it('AK-2: bietet nur sichtbare Kategorien an', () => {
    setup()
    const item = within(screen.getByRole('listitem', { name: 'Vorschlag 1' }))
    const auswahl = item.getByLabelText('Kategorie')
    expect(within(auswahl).getByRole('option', { name: 'Essen' })).toBeInTheDocument()
    expect(within(auswahl).queryByRole('option', { name: 'Kleider' })).toBeNull()
  })

  it('AK-3: Buchen gibt die geänderte Buchung weiter', async () => {
    const { user, onConfirm } = setup()
    const item = within(screen.getByRole('listitem', { name: 'Vorschlag 1' }))
    await user.clear(item.getByLabelText('Betrag'))
    await user.type(item.getByLabelText('Betrag'), '20.00')
    await user.click(item.getByRole('button', { name: 'Buchen' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ id: U1, amountCents: 2000, note: 'Mittagessen' }),
    )
  })

  it('AK-3: ungültige Änderung wird nicht gebucht', async () => {
    const { user, onConfirm } = setup()
    const item = within(screen.getByRole('listitem', { name: 'Vorschlag 1' }))
    await user.clear(item.getByLabelText('Betrag'))
    await user.click(item.getByRole('button', { name: 'Buchen' }))
    expect(item.getByRole('alert')).toHaveTextContent('Bitte gib einen gültigen Betrag ein.')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('AK-4: Verwerfen meldet die id', async () => {
    const { user, onConfirm, onDiscard } = setup()
    const item = within(screen.getByRole('listitem', { name: 'Vorschlag 1' }))
    await user.click(item.getByRole('button', { name: 'Verwerfen' }))
    expect(onDiscard).toHaveBeenCalledWith(U1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
