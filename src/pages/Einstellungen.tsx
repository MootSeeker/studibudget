import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../auth/supabase'
import { Field, Form, buttonClass } from '../auth/ui'
import { SubNav } from '../components/SubNav'
import { useSubNav, type SubNavItem } from '../lib/useSubNav'
import { supabaseInbox } from '../sync/inbox'
import { useSettings } from '../data/hooks'
import { BackupSection } from './einstellungen/BackupSection'
import { BankSection } from './einstellungen/BankSection'
import { InstallSection } from './einstellungen/InstallSection'
import { PosteingangSection } from './einstellungen/PosteingangSection'
import { ResetSection } from './einstellungen/ResetSection'
import {
  AmpelSection,
  CarsSection,
  DisplaySection,
  HousingSection,
  PersonsSection,
  SemesterSection,
} from './einstellungen/Sections'
import { UnsavedProvider } from './einstellungen/UnsavedGuard'
import { useConfirmLeave } from './einstellungen/useUnsaved'

function ChangePassword() {
  const auth = useAuth()
  const [oldPw, setOld] = useState('')
  const [newPw, setNew] = useState('')
  const [repeatPw, setRepeat] = useState('')
  const [done, setDone] = useState(false)
  return (
    <Form
      submitLabel="Passwort ändern"
      onSubmit={async () => {
        if (newPw !== repeatPw)
          throw new Error('Die beiden neuen Passwörter stimmen nicht überein.')
        if (newPw === oldPw) throw new Error('Das neue Passwort ist gleich dem aktuellen.')
        await auth.changePassword(oldPw, newPw)
        setDone(true)
        setOld('')
        setNew('')
        setRepeat('')
      }}
    >
      <Field
        label="Aktuelles Passwort"
        type="password"
        value={oldPw}
        onChange={setOld}
        autoComplete="current-password"
      />
      <Field
        label="Neues Passwort"
        type="password"
        value={newPw}
        onChange={setNew}
        autoComplete="new-password"
        hint="Mindestens 12 Zeichen."
      />
      <Field
        label="Neues Passwort wiederholen"
        type="password"
        value={repeatPw}
        onChange={setRepeat}
        autoComplete="new-password"
      />
      {done && (
        <p role="status" className="text-sm">
          Passwort geändert.
        </p>
      )}
    </Form>
  )
}

function ChangeEmail() {
  const auth = useAuth()
  const [newEmail, setNewEmail] = useState('')
  const [pw, setPw] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <Form
        submitLabel="Bestätigung anfordern"
        onSubmit={async () => {
          await auth.changeEmail(newEmail, pw)
          setSent(newEmail)
        }}
      >
        <Field
          label="Neue E-Mail-Adresse"
          type="email"
          value={newEmail}
          onChange={setNewEmail}
          autoComplete="email"
        />
        <Field
          label="Passwort zur Bestätigung"
          type="password"
          value={pw}
          onChange={setPw}
          autoComplete="current-password"
        />
      </Form>
      {sent && (
        <p role="status" className="text-sm">
          {`Wir haben eine Bestätigung an ${sent} geschickt. Bestätige die Änderung in beiden E-Mails (neue und bisherige Adresse). Bis dahin kannst du dich nicht neu anmelden; bleib auf diesem Gerät angemeldet. Danach meldest du dich mit der neuen Adresse an. Im Notfall hilft der Wiederherstellungsschlüssel.`}
        </p>
      )}
    </div>
  )
}

function RenewKey() {
  const auth = useAuth()
  const [pw, setPw] = useState('')
  const [code, setCode] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <Form
        submitLabel="Neuen Schlüssel erzeugen"
        onSubmit={async () => setCode(await auth.renewRecoveryKey(pw))}
      >
        <Field
          label="Passwort zur Bestätigung"
          type="password"
          value={pw}
          onChange={setPw}
          autoComplete="current-password"
        />
      </Form>
      {code && (
        <div role="status" className="space-y-1 text-sm">
          <p>Dein neuer Schlüssel (der alte ist ungültig). Er wird nur jetzt angezeigt:</p>
          <p className="select-all rounded-md border border-border bg-bg px-3 py-2 font-mono">
            {code}
          </p>
        </div>
      )}
    </div>
  )
}

function DeleteAccount() {
  const auth = useAuth()
  const [pw, setPw] = useState('')
  return (
    <Form
      submitLabel="Konto endgültig löschen"
      onSubmit={async () => {
        if (!window.confirm('Konto und ALLE Daten unwiderruflich löschen?')) return
        await auth.deleteAccount(pw)
      }}
    >
      <p className="text-sm text-muted">
        Löscht dein Konto und alle Daten auf dem Server und auf diesem Gerät.
      </p>
      <Field
        label="Passwort zur Bestätigung"
        type="password"
        value={pw}
        onChange={setPw}
        autoComplete="current-password"
      />
    </Form>
  )
}

const inboxApi = supabase ? supabaseInbox(supabase) : null

const TABS: SubNavItem[] = [
  { id: 'haushalt', label: 'Haushalt' },
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'daten', label: 'Daten' },
  { id: 'konto', label: 'Konto' },
]

/** Reiterleiste: fragt vor dem Wechsel nach ungespeicherten Änderungen (Issue #185). */
function Bereiche() {
  const confirmLeave = useConfirmLeave()
  return (
    <SubNav param="bereich" items={TABS} label="Einstellungsbereiche" beforeChange={confirmLeave} />
  )
}

export function Einstellungen() {
  const auth = useAuth()
  const settings = useSettings()
  const tab = useSubNav('bereich', TABS)
  return (
    <UnsavedProvider>
      <section className="max-w-xl space-y-8">
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <Bereiche />

        {settings && tab === 'haushalt' && (
          <>
            <HousingSection settings={settings} />
            <PersonsSection settings={settings} />
            <CarsSection settings={settings} />
            <SemesterSection settings={settings} />
            {(settings.living === 'wg' || settings.living === 'partner') && (
              <BankSection settings={settings} />
            )}
          </>
        )}
        {settings && tab === 'darstellung' && (
          <>
            <DisplaySection settings={settings} />
            <AmpelSection settings={settings} />
            <InstallSection />
          </>
        )}
        {settings && tab === 'daten' && (
          <>
            <BackupSection settings={settings} />
            <PosteingangSection api={inboxApi} />
            <ResetSection settings={settings} />
          </>
        )}

        {tab === 'konto' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Konto</h2>
            <p>
              Angemeldet als <strong>{auth.state.email}</strong>
            </p>
            <details className="rounded-md border border-border p-4">
              <summary className="cursor-pointer font-medium">Passwort ändern</summary>
              <div className="mt-4">
                <ChangePassword />
              </div>
            </details>
            <details className="rounded-md border border-border p-4">
              <summary className="cursor-pointer font-medium">E-Mail-Adresse ändern</summary>
              <div className="mt-4">
                <ChangeEmail />
              </div>
            </details>
            <details className="rounded-md border border-border p-4">
              <summary className="cursor-pointer font-medium">
                Neuen Wiederherstellungsschlüssel erzeugen
              </summary>
              <div className="mt-4">
                <RenewKey />
              </div>
            </details>
            <details className="rounded-md border border-border p-4">
              <summary className="cursor-pointer font-medium">Konto löschen</summary>
              <div className="mt-4">
                <DeleteAccount />
              </div>
            </details>
            <button className={buttonClass} onClick={() => void auth.logout()}>
              Abmelden
            </button>
            <p className="text-xs text-muted">
              Beim Abmelden werden die Daten auf diesem Gerät gelöscht.
            </p>
          </div>
        )}
      </section>
    </UnsavedProvider>
  )
}
