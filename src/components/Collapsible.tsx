import { useId, type ReactNode } from 'react'

/** Einklappbarer Abschnitt: Kopf als Knopf (mit `aria-expanded`), Inhalt nur im Dokument, wenn offen. */
export function Collapsible({
  title,
  summary,
  open,
  onToggle,
  children,
  headingLevel = 2,
}: {
  title: ReactNode
  /** Kurzinfo im Kopf, z. B. «3 Kategorien · CHF 850.00». */
  summary?: ReactNode
  open: boolean
  onToggle(): void
  children: ReactNode
  headingLevel?: 2 | 3
}) {
  const id = useId()
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className="rounded-xl border border-border bg-surface">
      <Heading className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden="true" className="text-sm text-muted">
              {open ? '▾' : '▸'}
            </span>
            {title}
          </span>
          {summary && <span className="text-sm text-muted">{summary}</span>}
        </button>
      </Heading>
      {open && (
        <div id={id} className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  )
}
