import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupReminder } from '../../components/BackupReminder'
import { MAX_BACKUP_BYTES, exportBackup } from '../../data/backup'
import { db } from '../../data/db'
import { useSettings } from '../../data/hooks'
import { completeOnboarding } from '../../data/onboarding'
import { newId, SETTINGS_ID } from '../../data/seed'
import { store } from '../../data/store'
import { defaultSemesters } from '../../domain/period'
import { BackupSection } from './BackupSection'

const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

function Harness() {
  const s = useSettings()
  return s ? <BackupSection settings={s} /> : null
}

async function seed(extra: { note: string }[] = []) {
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
  const cat = (await db.categories.toArray())[0]
  for (const e of extra)
    await store.put('transactions', {
      id: newId(),
      deleted: false,
      date: '2026-10-02',
      categoryId: cat.id,
      amountCents: 1000,
      myAmountCents: 1000,
      note: e.note,
    })
}
const settings = async () => (await db.settings.get(SETTINGS_ID))!
const setSettings = async (patch: object) => {
  const { updatedAt: _u, ...rest } = await settings()
  await store.put('settings', { ...rest, ...patch })
}

let blobs: Blob[] = []
let clicked: { download: string }[] = []
beforeEach(() => {
  blobs = []
  clicked = []
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), 'blob:test'))
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ download: this.download })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Backup herunterladen', () => {
  it('erzeugt eine JSON-Datei mit Datum im Namen, merkt sich den Zeitpunkt und zeigt ihn an', async () => {
    await seed([{ note: 'Kaffee' }])
    const user = userEvent.setup()
    render(<Harness />)
    expect(await screen.findByText('Noch kein Backup erstellt.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Backup herunterladen' }))
    await screen.findByText('Das Backup wurde heruntergeladen.')
    expect(clicked[0].download).toMatch(/^studibudget-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = JSON.parse(await blobs[0].text())
    expect(parsed).toMatchObject({ app: 'studibudget', schemaVersion: 1 })
    expect(parsed.data.transactions).toHaveLength(1)
    expect(parsed.data.transactions[0].note).toBe('Kaffee')
    expect((await settings()).lastBackupAt).not.toBeNull()
    expect(await screen.findByText(/Letztes Backup: .* \(heute\)/)).toBeInTheDocument()
  })

  it('erstellt keine Datei, die sich nicht wieder einspielen liesse, und sagt warum', async () => {
    await seed([{ note: 'x' }])
    const [tx] = await db.transactions.toArray()
    const { updatedAt: _u, ...rest } = tx
    await store.put('transactions', { ...rest, categoryId: crypto.randomUUID() }) // verweist auf keine Kategorie
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(await screen.findByRole('button', { name: 'Backup herunterladen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /nicht erstellt.*Unstimmigkeit.*unbekannte Kategorie/,
    )
    expect(clicked).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    expect((await settings()).lastBackupAt).toBeNull() // gilt nicht als gesichert
  })

  it('die Erinnerung lässt sich einstellen', async () => {
    await seed()
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(await screen.findByLabelText('Erinnerung'), 'Alle 7 Tage')
    await waitFor(async () => expect((await settings()).backupReminderDays).toBe(7))
  })
})

describe('Backup einspielen', () => {
  const file = (content: string, name = 'backup.json') =>
    new File([content], name, { type: 'application/json' })

  async function backupOfOtherState() {
    await seed([{ note: 'aus dem Backup 1' }, { note: 'aus dem Backup 2' }])
    return JSON.stringify(await exportBackup(db))
  }

  it('zeigt vor dem Einspielen den Inhalt, ersetzt nach Bestätigung alle Daten', async () => {
    const backupText = await backupOfOtherState()
    await seed([{ note: 'aktuell A' }, { note: 'aktuell B' }, { note: 'aktuell C' }])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Harness />)
    await user.upload(await screen.findByLabelText('Backup einspielen'), file(backupText))
    const preview = await screen.findByRole('region', { name: 'Inhalt des Backups' })
    expect(norm(preview.textContent)).toContain('2 Buchungen')
    expect(norm(preview.textContent)).toContain('backup.json')
    expect((await db.transactions.toArray()).filter((t) => !t.deleted)).toHaveLength(3) // noch nichts verändert
    await user.click(
      within(preview).getByRole('button', { name: 'Alle Daten durch dieses Backup ersetzen' }),
    )
    await screen.findByText('Das Backup wurde eingespielt.')
    const notes = (await db.transactions.toArray())
      .filter((t) => !t.deleted)
      .map((t) => t.note)
      .sort()
    expect(notes).toEqual(['aus dem Backup 1', 'aus dem Backup 2'])
    expect(screen.queryByRole('region', { name: 'Inhalt des Backups' })).not.toBeInTheDocument()
  })

  it('ohne Bestätigung bleibt alles unverändert', async () => {
    const backupText = await backupOfOtherState()
    await seed([{ note: 'aktuell A' }])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<Harness />)
    await user.upload(await screen.findByLabelText('Backup einspielen'), file(backupText))
    await user.click(
      await screen.findByRole('button', { name: 'Alle Daten durch dieses Backup ersetzen' }),
    )
    expect((await db.transactions.toArray()).filter((t) => !t.deleted).map((t) => t.note)).toEqual([
      'aktuell A',
    ])
  })

  it('Abbrechen verwirft die Vorschau', async () => {
    const backupText = await backupOfOtherState()
    await seed()
    const user = userEvent.setup()
    render(<Harness />)
    await user.upload(await screen.findByLabelText('Backup einspielen'), file(backupText))
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('region', { name: 'Inhalt des Backups' })).not.toBeInTheDocument()
  })

  it.each([
    ['keine Backup-Datei', 'hallo', 'kein lesbares JSON'],
    ['fremde JSON-Datei', JSON.stringify({ foo: 1 }), 'keine StudiBudget-Backup-Datei'],
  ])('lehnt ab: %s – mit Fehlermeldung und ohne Änderung', async (_l, content, msg) => {
    await seed([{ note: 'bleibt' }])
    const user = userEvent.setup()
    render(<Harness />)
    await user.upload(await screen.findByLabelText('Backup einspielen'), file(content, 'x.json'))
    expect(await screen.findByRole('alert')).toHaveTextContent(msg)
    expect(screen.queryByRole('region', { name: 'Inhalt des Backups' })).not.toBeInTheDocument()
    expect((await db.transactions.toArray()).map((t) => t.note)).toEqual(['bleibt'])
  })

  it('eine beschädigte Datei wird erkannt', async () => {
    const parsed = JSON.parse(await backupOfOtherState())
    parsed.data.transactions[0].amountCents = -1
    await seed()
    const user = userEvent.setup()
    render(<Harness />)
    await user.upload(
      await screen.findByLabelText('Backup einspielen'),
      file(JSON.stringify(parsed)),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('beschädigt')
  })
})

describe('Erinnerung ans Backup', () => {
  const renderReminder = () =>
    render(
      <MemoryRouter>
        <BackupReminder />
      </MemoryRouter>,
    )

  it('erscheint, wenn noch nie gesichert wurde und es Daten gibt; Später blendet aus', async () => {
    await seed([{ note: 'x' }])
    const user = userEvent.setup()
    renderReminder()
    expect(await screen.findByText(/noch kein Backup erstellt/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zum Backup' })).toHaveAttribute(
      'href',
      '/einstellungen?bereich=daten',
    )
    await user.click(screen.getByRole('button', { name: 'Später' }))
    expect(screen.queryByText(/noch kein Backup/)).not.toBeInTheDocument()
  })

  it('nicht ohne Daten, nicht bei ausgeschalteter Erinnerung, nicht bei frischem Backup', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }) // nur die Uhr; Timer bleiben echt (waitFor)
    vi.setSystemTime(new Date('2026-10-15T12:00:00'))
    await seed()
    const { unmount } = renderReminder()
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument() // keine Buchungen
    unmount()
    await seed([{ note: 'x' }])
    await setSettings({ backupReminderDays: 0 })
    const second = renderReminder()
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    second.unmount()
    await setSettings({ backupReminderDays: 7, lastBackupAt: new Date().toISOString() })
    renderReminder()
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('nennt das Alter, wenn das letzte Backup zu alt ist', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }) // nur die Uhr; Timer bleiben echt (waitFor)
    vi.setSystemTime(new Date('2026-10-15T12:00:00'))
    await seed([{ note: 'x' }])
    await setSettings({
      backupReminderDays: 7,
      lastBackupAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    })
    renderReminder()
    expect(await screen.findByText(/Dein letztes Backup ist 12 Tage alt/)).toBeInTheDocument()
  })
})

describe('Backup einspielen: zu grosse Datei', { tags: ['negativ'] }, () => {
  it('wird abgelehnt, ohne sie zu lesen (Regression #42)', { tags: ['regression'] }, async () => {
    await seed()
    const huge = new File([new Uint8Array(MAX_BACKUP_BYTES + 1)], 'gross.json', {
      type: 'application/json',
    })
    const read = vi.spyOn(huge, 'text')
    const user = userEvent.setup()
    render(<Harness />)
    await user.upload(await screen.findByLabelText('Backup einspielen'), huge)
    expect(await screen.findByRole('alert')).toHaveTextContent(/zu gross/)
    expect(read).not.toHaveBeenCalled()
  })
})
