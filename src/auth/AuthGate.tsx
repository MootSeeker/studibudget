import { useState, type ReactNode } from 'react'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { LegalPage } from '../legal/LegalPage'
import { useAuth } from './AuthProvider'
import { Card, Field, Form, buttonClass, linkButtonClass } from './ui'

type Screen = 'login' | 'register' | 'forgot'

function Login({ go }: { go: (s: Screen) => void }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <Card title="Anmelden">
      {auth.state.notice && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm"
        >
          {auth.state.notice}
        </p>
      )}
      <Form submitLabel="Anmelden" onSubmit={() => auth.login(email, password)}>
        <Field
          label="E-Mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
        />
        <Field
          label="Passwort"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
      </Form>
      <div className="flex justify-between">
        <button className={linkButtonClass} onClick={() => go('register')}>
          Neues Konto anlegen
        </button>
        <button className={linkButtonClass} onClick={() => go('forgot')}>
          Passwort vergessen?
        </button>
      </div>
    </Card>
  )
}

function RecoveryCodeScreen({
  code,
  email,
  done,
}: {
  code: string
  email: string
  done: () => void
}) {
  const [typed, setTyped] = useState('')
  const check = code.split('-')[2]
  const ok = typed.trim().toUpperCase() === check

  function download() {
    const blob = new Blob(
      [
        `StudiBudget – Wiederherstellungsschlüssel für ${email}\n\n${code}\n\nBewahre diese Datei sicher auf.\n`,
      ],
      { type: 'text/plain' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'studibudget-wiederherstellungsschluessel.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Card title="Dein Wiederherstellungsschlüssel">
      <p className="text-sm">
        Deine Daten sind Ende-zu-Ende verschlüsselt. Wenn du dein Passwort vergisst, kommst du{' '}
        <strong>nur mit diesem Schlüssel</strong> wieder an deine Daten. Wir können ihn nicht für
        dich wiederherstellen. Er wird nur jetzt einmal angezeigt.
      </p>
      <p className="select-all rounded-md border border-border bg-bg px-3 py-3 text-center font-mono text-lg tracking-wide">
        {code}
      </p>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-border px-3 py-2 text-sm"
          onClick={() => navigator.clipboard?.writeText(code)}
        >
          Kopieren
        </button>
        <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={download}>
          Als Datei speichern
        </button>
        <button
          className="rounded-md border border-border px-3 py-2 text-sm"
          onClick={() => window.print()}
        >
          Drucken
        </button>
      </div>
      <Field
        label="Dritte Gruppe zur Bestätigung"
        value={typed}
        onChange={setTyped}
        hint="Tippe die dritte Vierergruppe ab, um zu bestätigen, dass du den Schlüssel gesichert hast."
      />
      <button className={buttonClass} disabled={!ok} onClick={done}>
        Ich habe den Schlüssel gesichert
      </button>
    </Card>
  )
}

function Register({ go }: { go: (s: Screen) => void }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (sent)
    return (
      <Card title="Fast geschafft">
        <p className="text-sm">
          Wir haben dir eine E-Mail an <strong>{email}</strong> geschickt. Bestätige deine Adresse
          mit dem Link darin und melde dich danach an.
        </p>
        <button className={buttonClass} onClick={() => go('login')}>
          Zur Anmeldung
        </button>
      </Card>
    )
  if (code) return <RecoveryCodeScreen code={code} email={email} done={() => setSent(true)} />

  return (
    <Card title="Konto anlegen">
      <Form
        submitLabel="Konto anlegen"
        onSubmit={async () => {
          if (password !== again) throw new Error('Die Passwörter stimmen nicht überein.')
          setCode((await auth.register(email, password)).recoveryCode)
        }}
      >
        <Field
          label="E-Mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
        />
        <Field
          label="Passwort"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="Mindestens 12 Zeichen."
        />
        <Field
          label="Passwort wiederholen"
          type="password"
          value={again}
          onChange={setAgain}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted">
          Deine Budgetdaten werden auf deinem Gerät verschlüsselt, bevor sie hochgeladen werden. Wer
          das Passwort und den Wiederherstellungsschlüssel verliert, verliert die Daten.
        </p>
      </Form>
      <button className={linkButtonClass} onClick={() => go('login')}>
        Ich habe schon ein Konto
      </button>
    </Card>
  )
}

function Forgot({ go }: { go: (s: Screen) => void }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <Card title="Passwort vergessen">
      {sent ? (
        <p className="text-sm">
          Falls es zu <strong>{email}</strong> ein Konto gibt, ist ein Link unterwegs. Öffne ihn{' '}
          <strong>im selben Browser</strong>, danach brauchst du deinen Wiederherstellungsschlüssel.
        </p>
      ) : (
        <Form
          submitLabel="Link senden"
          onSubmit={async () => {
            await auth.requestReset(email)
            setSent(true)
          }}
        >
          <Field
            label="E-Mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
          />
        </Form>
      )}
      <button className={linkButtonClass} onClick={() => go('login')}>
        Zurück zur Anmeldung
      </button>
    </Card>
  )
}

function Recovery() {
  const auth = useAuth()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <Card title="Neues Passwort festlegen">
      <Form submitLabel="Passwort ändern" onSubmit={() => auth.completeRecovery(code, password)}>
        <Field
          label="Wiederherstellungsschlüssel"
          value={code}
          onChange={setCode}
          autoComplete="off"
        />
        <Field
          label="Neues Passwort"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="Mindestens 12 Zeichen."
        />
      </Form>
      <details className="text-sm" open={confirmDelete}>
        <summary
          className="cursor-pointer text-muted"
          onClick={() => setConfirmDelete(!confirmDelete)}
        >
          Ich habe keinen Schlüssel mehr
        </summary>
        <p className="mt-2">
          Ohne Schlüssel sind die Daten unwiederbringlich verloren. Du kannst das Konto löschen und
          neu starten.
        </p>
        <button
          className="mt-2 rounded-md border border-red-500/60 px-3 py-2 text-red-600 dark:text-red-400"
          onClick={() => {
            if (window.confirm('Konto und ALLE Daten unwiderruflich löschen?'))
              void auth.discardAccountInRecovery()
          }}
        >
          Konto und alle Daten löschen
        </button>
      </details>
    </Card>
  )
}

function LegalScreen({ slug, back }: { slug: 'datenschutz' | 'impressum'; back: () => void }) {
  useDocumentTitle(slug === 'datenschutz' ? 'Datenschutz' : 'Impressum')
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <button className={`${linkButtonClass} mb-4`} onClick={back}>
        ← Zurück
      </button>
      <LegalPage slug={slug} />
    </div>
  )
}

/** Zeigt die App nur an, wenn jemand angemeldet ist und der Datenschlüssel lokal vorliegt. */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [screen, setScreen] = useState<Screen>('login')
  const [legal, setLegal] = useState<'datenschutz' | 'impressum' | null>(null)

  if (!auth.configured)
    return (
      <Card title="Server nicht konfiguriert">
        <p className="text-sm">
          Es fehlen <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code>. Siehe{' '}
          <code>.env.example</code>.
        </p>
      </Card>
    )
  if (auth.state.status === 'loading') return <p className="p-8 text-muted">Lädt …</p>
  if (auth.state.status === 'recovery') return <Recovery />
  if (auth.state.status === 'out') {
    if (legal) return <LegalScreen slug={legal} back={() => setLegal(null)} />
    return (
      <>
        {screen === 'register' ? (
          <Register go={setScreen} />
        ) : screen === 'forgot' ? (
          <Forgot go={setScreen} />
        ) : (
          <Login go={setScreen} />
        )}
        <footer className="mx-auto mt-6 flex max-w-md justify-center gap-4 pb-8 text-sm">
          <button className={linkButtonClass} onClick={() => setLegal('datenschutz')}>
            Datenschutz
          </button>
          <button className={linkButtonClass} onClick={() => setLegal('impressum')}>
            Impressum
          </button>
        </footer>
      </>
    )
  }
  return <>{children}</>
}
