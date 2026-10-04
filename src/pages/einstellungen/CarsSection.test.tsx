import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { completeOnboarding } from '../../data/onboarding'
import { SETTINGS_ID } from '../../data/seed'
import { defaultSemesters } from '../../domain/period'
import { CarsSection } from './Sections'

beforeEach(async () => {
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
})

async function setup() {
  const settings = (await db.settings.get(SETTINGS_ID))!
  const user = userEvent.setup()
  render(<CarsSection settings={settings} />)
  await screen.findByLabelText('Neues Auto')
  return user
}
const live = async () => (await db.cars.toArray()).filter((c) => !c.deleted)

describe('Autos in den Einstellungen', () => {
  it('legt Autos an, lehnt Doppelte ab und archiviert', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Neues Auto'), 'Golf')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await screen.findByLabelText('Name Golf')
    await user.type(screen.getByLabelText('Neues Auto'), ' golf ')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('gibt es schon')
    expect(await live()).toHaveLength(1)
    await user.click(screen.getByLabelText('archiviert'))
    await waitFor(async () => expect((await live())[0].archived).toBe(true))
  })

  it('erscheint nicht ohne Auto in den Einstellungen', async () => {
    const settings = { ...(await db.settings.get(SETTINGS_ID))!, hasCar: false }
    const { container } = render(<CarsSection settings={settings} />)
    expect(container).toBeEmptyDOMElement()
  })
})
