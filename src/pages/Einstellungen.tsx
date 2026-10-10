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
  CarsSection,
  DisplaySection,
  HousingSection,
  PersonsSection,
  SemesterSection,
} from './einstellungen/Sections'

function ChangePassword() {
  const auth = useAuth()
  const [oldPw, setOld] = useState('')
  const [newPw, setNew] = useState('')
  const [done, setDone] = useState(false)
  return (
    <Form
      submitLabel="Passwort ändern"
      onSubmit={async () => {
        await auth.changePassword(oldPw, newPw)
        setDone(true)
        setOld('')
        setNew('')
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
      {done && (
        <p role="status" className="text-sm">
          Passwort geändert.
        </p>
      )}
    </Form>
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

export function Einstellungen() {
  const auth = useAuth()
  const settings = useSettings()
  const tab = useSubNav('bereich', TABS)
  return (
    <section className="max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <SubNav param="bereich" items={TABS} label="Einstellungsbereiche" />

      {settings && tab === 'haushalt' && (
        <>
          <HousingSection settings={settings} />
          <PersonsSection settings={settings} />
          <CarsSection settings={settings} />
          <SemesterSection settings={settings} />
          <BankSection settings={settings} />
        </>
      )}
      {settings && tab === 'darstellung' && (
        <>
          <DisplaySection settings={settings} />
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
  )
}
