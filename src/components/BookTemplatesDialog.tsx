import { useState } from 'react'
import { buttonClass, inputClass } from '../auth/ui'
import { formatMoney, parseAmount } from '../domain/money'
import type { MonthKey } from '../domain/period'
import { MONTH_NAMES } from './MonthSelect'
import type { Category, Country, Template } from '../domain/types'

export interface BookTemplatesDialogProps {
  month: MonthKey
  country: Country
  templates: Template[]
  categories: Category[]
  onBook(items: { template: Template; amountCents: number; note: string }[]): Promise<void>
  onClose(): void
}

/** Fixkosten des Monats prüfen (Betrag und Notiz änderbar) und mit einem Klick buchen. */
export function BookTemplatesDialog({
  month,
  country,
  templates,
  categories,
  onBook,
  onClose,
}: BookTemplatesDialogProps) {
  const [rows, setRows] = useState(() =>
    templates.map((t) => ({
      template: t,
      on: true,
      amount: (t.amountCents / 100).toFixed(2),
      note: t.note,
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt'
  const monthLabel = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

  async function book() {
    const items: { template: Template; amountCents: number; note: string }[] = []
    for (const r of rows.filter((x) => x.on)) {
      const cents = parseAmount(r.amount)
      if (cents === null || cents <= 0)
        return setError(`Ungültiger Betrag bei «${catName(r.template.categoryId)}».`)
      items.push({ template: r.template, amountCents: cents, note: r.note.trim() })
    }
    if (items.length === 0) return onClose()
    setBusy(true)
    try {
      await onBook(items)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
      setBusy(false)
    }
  }

  const total = rows.filter((r) => r.on).reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0)

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Fixkosten für ${monthLabel} buchen`}
        className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-surface p-5"
      >
        <h2 className="text-lg font-semibold">Fixkosten für {monthLabel} buchen</h2>
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.template.id} className="grid grid-cols-[auto_1fr_7rem] items-center gap-2">
              <input
                type="checkbox"
                aria-label={`${catName(r.template.categoryId)} buchen`}
                checked={r.on}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))
                }
              />
              <div>
                <p className="text-sm font-medium">{catName(r.template.categoryId)}</p>
                <input
                  aria-label={`Notiz ${catName(r.template.categoryId)}`}
                  className={`${inputClass} mt-1 text-sm`}
                  value={r.note}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
                  }
                />
              </div>
              <input
                aria-label={`Betrag ${catName(r.template.categoryId)}`}
                className={`${inputClass} text-right`}
                inputMode="decimal"
                value={r.amount}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                }
              />
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Summe: {formatMoney(total, country)} (Gesamtbetrag, bei gemeinsamen Kosten wird dein
          Anteil berechnet)
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="rounded-md border border-border px-4 py-2"
            onClick={onClose}
            disabled={busy}
          >
            Abbrechen
          </button>
          <button className={buttonClass} onClick={book} disabled={busy}>
            Buchen
          </button>
        </div>
      </div>
    </div>
  )
}
