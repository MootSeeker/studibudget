import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { completeOnboarding } from '../../data/onboarding'
import { SETTINGS_ID } from '../../data/seed'
import { defaultSemesters } from '../../domain/period'
import { BankSection } from './BankSection'

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
  render(<BankSection settings={settings} />)
  await screen.findByLabelText('IBAN')
  return user
}
const saved = async () => (await db.settings.get(SETTINGS_ID))!.bank
const speichern = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Bankverbindung speichern' }))

describe('Bankverbindung in den Einstellungen (Issue #104)', () => {
  it('AK-1: zeigt die sechs Felder, alle leer und freiwillig', async () => {
    await setup()
    for (const label of ['Kontoinhaber/in', 'Strasse und Nr.', 'PLZ', 'Ort', 'IBAN']) {
      const field = screen.getByLabelText(label)
      expect(field).toHaveValue('')
      expect(field).not.toBeRequired()
    }
    expect(screen.getByLabelText('Land der Bank')).toHaveValue('CH')
    expect(await saved()).toBeUndefined()
  })

  it('AK-8: jedes Feld hat eine Beschriftung, der Speichern-Knopf ist mit der Tastatur bedienbar', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Kontoinhaber/in'), 'Anna Muster')
    screen.getByRole('button', { name: 'Bankverbindung speichern' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(async () => expect((await saved())?.holder).toBe('Anna Muster'))
  })

  it('AK-3: speichert die IBAN normalisiert und zeigt sie in Vierergruppen', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Kontoinhaber/in'), 'Anna Muster')
    await user.type(screen.getByLabelText('Strasse und Nr.'), 'Seestrasse 12')
    await user.type(screen.getByLabelText('PLZ'), '8000')
    await user.type(screen.getByLabelText('Ort'), 'Zürich')
    await user.type(screen.getByLabelText('IBAN'), 'ch93 0076 2011 6238 5295 7')
    await speichern(user)
    await waitFor(async () => expect((await saved())?.iban).toBe('CH9300762011623852957'))
    expect(await saved()).toEqual({
      holder: 'Anna Muster',
      street: 'Seestrasse 12',
      zip: '8000',
      town: 'Zürich',
      country: 'CH',
      iban: 'CH9300762011623852957',
    })
    expect(screen.getByLabelText('IBAN')).toHaveValue('CH93 0076 2011 6238 5295 7')
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert')
  })

  it('AK-2: eine ungültige IBAN wird abgelehnt, nichts wird gespeichert, der Text bleibt stehen', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Kontoinhaber/in'), 'Anna Muster')
    await user.type(screen.getByLabelText('IBAN'), 'CH94 0076 2011 6238 5295 7')
    await speichern(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('IBAN')
    expect(await saved()).toBeUndefined()
    expect(screen.getByLabelText('IBAN')).toHaveValue('CH94 0076 2011 6238 5295 7')
    // Korrigieren und erneut speichern räumt den Fehler weg
    await user.clear(screen.getByLabelText('IBAN'))
    await user.type(screen.getByLabelText('IBAN'), 'CH93 0076 2011 6238 5295 7')
    await speichern(user)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect((await saved())?.iban).toBe('CH9300762011623852957')
  })

  it('AK-2: eine deutsche IBAN wird abgelehnt', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('IBAN'), 'DE89 3704 0044 0532 0130 00')
    await speichern(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Schweiz')
    expect(await saved()).toBeUndefined()
  })

  it('AK-4: alle Felder leeren und speichern entfernt die Bankverbindung', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Kontoinhaber/in'), 'Anna Muster')
    await user.type(screen.getByLabelText('IBAN'), 'CH93 0076 2011 6238 5295 7')
    await speichern(user)
    await waitFor(async () => expect(await saved()).toBeDefined())
    await user.clear(screen.getByLabelText('Kontoinhaber/in'))
    await user.clear(screen.getByLabelText('IBAN'))
    await speichern(user)
    await waitFor(async () => expect(await saved()).toBeUndefined())
  })

  it('AK-4: ein einzelnes Feld leeren lässt die übrigen stehen', async () => {
    const user = await setup()
    await user.type(screen.getByLabelText('Kontoinhaber/in'), 'Anna Muster')
    await user.type(screen.getByLabelText('Ort'), 'Zürich')
    await speichern(user)
    await waitFor(async () => expect((await saved())?.town).toBe('Zürich'))
    await user.clear(screen.getByLabelText('Ort'))
    await speichern(user)
    await waitFor(async () => expect((await saved())?.town).toBe(''))
    expect((await saved())?.holder).toBe('Anna Muster')
  })

  it('AK-7: der Hinweis nennt Zweck, Verschlüsselung und die unverschlüsselte Backup-Datei', async () => {
    await setup()
    const hinweis = screen.getByTestId('bank-hinweis')
    expect(hinweis).toHaveTextContent(/nur für Rechnungen/)
    expect(hinweis).toHaveTextContent(/nur verschlüsselt synchronisiert/)
    expect(hinweis).toHaveTextContent(/Backup-Datei stehen sie unverschlüsselt/)
  })
})
