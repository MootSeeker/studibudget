import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { completeOnboarding } from '../../data/onboarding'
import { SETTINGS_ID } from '../../data/seed'
import { store } from '../../data/store'
import { defaultSemesters } from '../../domain/period'
import { AmpelSection, DisplaySection, HousingSection, SemesterSection } from './Sections'

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
  document.documentElement.removeAttribute('data-theme')
})
const settings = async () => (await db.settings.get(SETTINGS_ID))!
const liveCategories = async () => (await db.categories.toArray()).filter((c) => !c.hidden)

describe('Land und Wohnsituation', () => {
  it('«Änderung prüfen» ist gesperrt, solange nichts geändert ist', async () => {
    render(<HousingSection settings={await settings()} />)
    expect(await screen.findByRole('button', { name: 'Änderung prüfen' })).toBeDisabled()
  })

  it('zeigt vorab, was sich an den Kategorien ändert, und übernimmt erst nach Bestätigung', async () => {
    const user = userEvent.setup()
    const before = (await liveCategories()).length
    render(<HousingSection settings={await settings()} />)
    await user.selectOptions(screen.getByLabelText('Wohnsituation'), 'allein')
    await user.click(screen.getByRole('button', { name: 'Änderung prüfen' }))
    const summary = await screen.findByRole('region', { name: 'Änderungen an den Kategorien' })
    expect(summary).toBeInTheDocument()
    expect((await settings()).living).toBe('wg') // noch nichts passiert
    expect((await liveCategories()).length).toBe(before)
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }))
    await waitFor(async () => expect((await settings()).living).toBe('allein'))
    expect(
      screen.queryByRole('region', { name: 'Änderungen an den Kategorien' }),
    ).not.toBeInTheDocument()
  })

  it('«Abbrechen» verwirft die Prüfung ohne Änderung', async () => {
    const user = userEvent.setup()
    render(<HousingSection settings={await settings()} />)
    await user.click(screen.getByLabelText('Ich habe ein Auto'))
    await user.click(screen.getByRole('button', { name: 'Änderung prüfen' }))
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))
    expect(await screen.findByRole('button', { name: 'Änderung prüfen' })).toBeInTheDocument()
    expect((await settings()).hasCar).toBe(false)
  })

  it('beim Landeswechsel warnt ein Hinweis, Beträge werden nicht umgerechnet; die Semester folgen dem neuen Land', async () => {
    const user = userEvent.setup()
    render(<HousingSection settings={await settings()} />)
    await user.selectOptions(screen.getByLabelText('Land'), 'DE')
    expect(screen.getByRole('note')).toHaveTextContent('nicht umgerechnet')
    await user.click(screen.getByRole('button', { name: 'Änderung prüfen' }))
    await user.click(await screen.findByRole('button', { name: 'Übernehmen' }))
    await waitFor(async () => expect((await settings()).country).toBe('DE'))
    expect((await settings()).semesters).toEqual(defaultSemesters('DE'))
  })
})

describe('Semester', () => {
  it('Namen und Monate ändern und speichern', async () => {
    const user = userEvent.setup()
    render(<SemesterSection settings={await settings()} />)
    const name = screen.getByLabelText('Name Semester 1')
    await user.clear(name)
    await user.type(name, 'Frühling')
    await user.selectOptions(screen.getByLabelText('Start Semester 1'), 'September')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.')
    const [first] = (await settings()).semesters
    expect(first).toMatchObject({ name: 'Frühling', startMonth: 9 })
  })
  it('«Auf Vorgabe zurücksetzen» stellt die Semester des Landes wieder her und blendet «Gespeichert» aus', async () => {
    const user = userEvent.setup()
    render(<SemesterSection settings={await settings()} />)
    await user.type(screen.getByLabelText('Name Semester 1'), 'X')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByRole('status')
    await user.click(screen.getByRole('button', { name: 'Auf Vorgabe zurücksetzen' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name Semester 1')).toHaveValue(defaultSemesters('CH')[0].name)
  })

  it('AK-1: Semester mit leerem Namen wird nicht gespeichert', async () => {
    const user = userEvent.setup()
    render(<SemesterSection settings={await settings()} />)
    await user.clear(screen.getByLabelText('Name Semester 1'))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Semester 1: Der Name fehlt.')).toBeInTheDocument()
    expect((await settings()).semesters).toEqual(defaultSemesters('CH'))
  })

  it('AK-2: Überlappung sperrt das Speichern', async () => {
    const user = userEvent.setup()
    render(<SemesterSection settings={await settings()} />)
    await user.selectOptions(screen.getByLabelText('Ende Semester 1'), 'Februar')
    expect(await screen.findByText(/Der Februar gehört zu mehreren Semestern/)).toHaveTextContent(
      'Februar',
    )
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await settings()).semesters).toEqual(defaultSemesters('CH'))
  })

  it('AK-3: Lücke zeigt Hinweis und speichert', async () => {
    const user = userEvent.setup()
    render(<SemesterSection settings={await settings()} />)
    await user.selectOptions(screen.getByLabelText('Ende Semester 1'), 'Dezember')
    expect(await screen.findByRole('note')).toHaveTextContent('Januar')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.')
    expect((await settings()).semesters[0]).toMatchObject({ endMonth: 12 })
  })

  it('AK-1: Semester hinzufügen und entfernen', async () => {
    const user = userEvent.setup()
    render(<SemesterSection settings={await settings()} />)
    await user.click(screen.getByRole('button', { name: 'Semester hinzufügen' }))
    expect(screen.getAllByLabelText(/^Name Semester \d$/)).toHaveLength(3)
    expect(screen.getByLabelText('Name Semester 3')).toHaveValue('Semester 3')
    await user.click(screen.getByRole('button', { name: 'Semester hinzufügen' }))
    expect(screen.getAllByLabelText(/^Name Semester \d$/)).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Semester hinzufügen' })).not.toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Semester 1 entfernen' }))
    }
    expect(screen.getAllByLabelText(/^Name Semester \d$/)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /entfernen/ })).not.toBeInTheDocument()
    expect((await settings()).semesters).toEqual(defaultSemesters('CH'))
  })

  it(
    'AK-1: Landwechsel zeigt neue Semester (Regression #184)',
    { tags: ['regression'] },
    async () => {
      const { rerender } = render(<SemesterSection settings={await settings()} />)
      await store.patch('settings', SETTINGS_ID, { semesters: defaultSemesters('DE') })
      rerender(<SemesterSection settings={await settings()} />)
      await waitFor(() =>
        expect(screen.getByLabelText('Name Semester 1')).toHaveValue('Wintersemester'),
      )
    },
  )

  it('AK-2: ungespeicherte Änderung wird nicht still überschrieben', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<SemesterSection settings={await settings()} />)
    await user.type(screen.getByLabelText('Name Semester 1'), 'X')
    await store.patch('settings', SETTINGS_ID, { semesters: defaultSemesters('DE') })
    rerender(<SemesterSection settings={await settings()} />)
    expect(
      await screen.findByText('Die gespeicherten Semester haben sich geändert.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    expect(screen.getByLabelText('Name Semester 1')).toHaveValue('HerbstsemesterX')
  })

  it('AK-1: zeigt «Nicht gespeichert»', async () => {
    const user = userEvent.setup()
    render(<SemesterSection settings={await settings()} />)
    await user.type(screen.getByLabelText('Name Semester 1'), 'X')
    expect(screen.getByText('Nicht gespeichert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByRole('status')
    expect(screen.queryByText('Nicht gespeichert')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Die gespeicherten Semester haben sich geändert.'),
    ).not.toBeInTheDocument()
  })
})

describe('Darstellung', () => {
  it('die Darstellung wird sofort angewendet und gespeichert', async () => {
    const user = userEvent.setup()
    render(<DisplaySection settings={await settings()} />)
    await user.selectOptions(screen.getByLabelText('Darstellung'), 'dark')
    await waitFor(async () => expect((await settings()).theme).toBe('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('Ampel', () => {
  it.each([
    ['Gelb gleich Rot', '80', '80'],
    ['Gelb 0', '0', '100'],
    ['Rot unter Gelb', '90', '50'],
  ])('lehnt ab: %s', async (_n, yellow, red) => {
    const user = userEvent.setup()
    render(<AmpelSection settings={await settings()} />)
    const y = screen.getByLabelText('Ampel gelb ab (%)')
    const r = screen.getByLabelText('Ampel rot ab (%)')
    await user.clear(y)
    await user.type(y, yellow)
    await user.clear(r)
    await user.type(r, red)
    await user.click(screen.getByRole('button', { name: 'Ampel speichern' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gelb muss über 0 und kleiner als Rot sein',
    )
    expect((await settings()).ampel).toEqual({ yellowPct: 80, redPct: 100 })
  })
  it('speichert gültige Schwellen und meldet es', async () => {
    const user = userEvent.setup()
    render(<AmpelSection settings={await settings()} />)
    const y = screen.getByLabelText('Ampel gelb ab (%)')
    await user.clear(y)
    await user.type(y, '70')
    await user.click(screen.getByRole('button', { name: 'Ampel speichern' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.')
    expect((await settings()).ampel.yellowPct).toBe(70)
  })
  it('AK-3: Ampel folgt gespeicherten Werten', async () => {
    const { rerender } = render(<AmpelSection settings={await settings()} />)
    await store.patch('settings', SETTINGS_ID, {
      ampel: { ...(await settings()).ampel, yellowPct: 60 },
    })
    rerender(<AmpelSection settings={await settings()} />)
    await waitFor(() => expect(screen.getByLabelText('Ampel gelb ab (%)')).toHaveValue(60))
  })
})
