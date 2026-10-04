import { useId, useState, type FormEvent, type ReactNode } from 'react'

export const inputClass =
  'w-full rounded-md border border-control bg-surface px-3 py-2 text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
export const buttonClass =
  'rounded-md bg-accent px-4 py-2 font-medium text-accent-text disabled:opacity-50'
export const linkButtonClass = 'text-sm text-accent underline underline-offset-2'

export function Field(props: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  hint?: string
}) {
  // Eigene ID pro Feld: dieselbe Beschriftung kann auf einer Seite mehrmals vorkommen.
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {props.label}
      </label>
      <input
        id={id}
        className={inputClass}
        type={props.type ?? 'text'}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
        required
      />
      {props.hint && <p className="text-xs text-muted">{props.hint}</p>}
    </div>
  )
}

/** Formular mit Ladezustand und Fehleranzeige. */
export function Form(props: {
  onSubmit: () => Promise<void>
  submitLabel: string
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await props.onSubmit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      {props.children}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? 'Einen Moment …' : props.submitLabel}
      </button>
    </form>
  )
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-10 w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </div>
  )
}
