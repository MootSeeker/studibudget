import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { completeOnboarding } from '../../data/onboarding'
import { SETTINGS_ID } from '../../data/seed'
import { defaultSemesters } from '../../domain/period'
import { PersonsSection } from './Sections'

beforeEach(async () => {
  await db.wipe()
  await completeOnboarding(db, {
    country: 'CH',
    living: 'wg',
    hasCar: false,
    partnerSharePct: 50,
    persons: ['Anna', 'Ben'],
    semesters: defaultSemesters('CH'),
    budgets: {},
  })
})

async function setup() {
  const settings = (await db.settings.get(SETTINGS_ID))!
  const user = userEvent.setup()
  render(<PersonsSection settings={settings} />)
  await screen.findByLabelText('Name Anna')
  return user
}
const names = async () =>
  (await db.persons.toArray())
    .filter((p) => !p.deleted)
    .map((p) => p.name)
    .sort()

describe('Personen in den Einstellungen', () => {
  it('lehnt eine zweite Person mit gleichem Namen ab (Gross-/Kleinschreibung egal)', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Neue Person'), ' ANNA ')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('«ANNA» gibt es schon')
    expect(await names()).toEqual(['Anna', 'Ben'])
  })

  it('legt eine neue Person an und löscht danach den Fehler', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Neue Person'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await screen.findByRole('alert')
    await user.clear(screen.getByLabelText('Neue Person'))
    await user.type(screen.getByLabelText('Neue Person'), 'Cleo')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await waitFor(async () => expect(await names()).toEqual(['Anna', 'Ben', 'Cleo']))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Umbenennen auf einen vorhandenen Namen wird abgelehnt und das Feld zeigt wieder den alten Namen', async () => {
    const user = await setup()
    const field = screen.getByLabelText('Name Ben')
    await user.clear(field)
    await user.type(field, 'anna')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('«anna» gibt es schon')
    expect(field).toHaveValue('Ben')
    expect(await names()).toEqual(['Anna', 'Ben'])
  })

  it('Umbenennen auf einen freien Namen klappt', async () => {
    const user = await setup()
    const field = screen.getByLabelText('Name Ben')
    await user.clear(field)
    await user.type(field, 'Benno')
    await user.tab()
    await waitFor(async () => expect(await names()).toEqual(['Anna', 'Benno']))
  })

  it('der eigene Name zählt beim Umbenennen nicht als Duplikat (nur Gross-/Kleinschreibung ändern)', async () => {
    const user = await setup()
    const field = screen.getByLabelText('Name Ben')
    await user.clear(field)
    await user.type(field, 'BEN')
    await user.tab()
    await waitFor(async () => expect(await names()).toEqual(['Anna', 'BEN']))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
