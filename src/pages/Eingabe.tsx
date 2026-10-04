import { useState } from 'react'
import { BookTemplatesDialog } from '../components/BookTemplatesDialog'
import { EntryForm } from '../components/EntryForm'
import { MonthList } from '../components/MonthList'
import { MONTH_NAMES } from '../components/MonthSelect'
import { db } from '../data/db'
import {
  useAreas,
  useCategories,
  useGoals,
  useMonthTransactions,
  usePersons,
  useSettings,
  useTemplates,
} from '../data/hooks'
import { newId } from '../data/seed'
import { store } from '../data/store'
import type { EntryDraft } from '../domain/entry'
import { groupMonth } from '../domain/ledger'
import { formatMoney } from '../domain/money'
import { addMonths, currentMonth, monthOf } from '../domain/period'
import { totalsByMonth } from '../domain/stats'
import { openTemplates, templateToDraft } from '../domain/templates'
import type { Transaction } from '../domain/types'

export function Eingabe() {
  const settings = useSettings()
  const categories = useCategories()
  const areas = useAreas()
  const persons = usePersons()
  const goals = useGoals()
  const templates = useTemplates()
  const [month, setMonth] = useState(currentMonth())
  const txs = useMonthTransactions(month)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [booking, setBooking] = useState(false)

  if (!settings) return null
  const country = settings.country
  const money = (c: number) => formatMoney(c, country)
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const defaultDate = monthOf(todayIso) === month ? todayIso : `${month}-01`

  const groups = groupMonth(txs, categories, areas, month)
  const totals = totalsByMonth(txs, categories, month, month)[0]
  const open = month <= currentMonth() ? openTemplates(templates, txs, month) : []
  const label = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

  async function submit(draft: EntryDraft, opts: { repeat: number[] | null }) {
    if (opts.repeat) {
      const templateId = newId()
      await store.put('templates', {
        id: templateId,
        deleted: false,
        categoryId: draft.categoryId,
        amountCents: draft.amountCents,
        note: draft.note,
        ...(draft.shared ? { shared: draft.shared } : {}),
        months: opts.repeat,
        active: true,
      })
      draft = { ...draft, templateId, templateMonth: monthOf(draft.date) }
    }
    await store.put('transactions', draft)
    if (editing) setEditing(null)
    // Datum außerhalb des angezeigten Monats: dorthin wechseln, damit die Buchung sichtbar bleibt.
    if (monthOf(draft.date) !== month) setMonth(monthOf(draft.date))
  }

  async function bookTemplates(
    items: { template: (typeof templates)[number]; amountCents: number; note: string }[],
  ) {
    // Frisch prüfen, damit nichts doppelt gebucht wird (z. B. von einem anderen Gerät).
    const fresh = await db.transactions.toArray()
    const stillOpen = new Set(openTemplates(templates, fresh, month).map((t) => t.id))
    const drafts = items
      .filter((i) => stillOpen.has(i.template.id))
      .map((i) => templateToDraft(i.template, month, newId(), i.amountCents, i.note))
    await store.putMany('transactions', drafts)
  }

  return (
    <section className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Eingabe</h1>

      <EntryForm
        key={editing?.id ?? 'neu'}
        settings={settings}
        categories={categories}
        areas={areas}
        persons={persons}
        goals={goals}
        initial={editing}
        defaultDate={defaultDate}
        onSubmit={submit}
        onCancel={editing ? () => setEditing(null) : undefined}
      />

      <div className="flex items-center justify-between">
        <button
          className="rounded-md border border-border px-3 py-2"
          aria-label="Vorheriger Monat"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          ◀
        </button>
        <h2 className="text-lg font-semibold" aria-live="polite">
          {label}
        </h2>
        <button
          className="rounded-md border border-border px-3 py-2"
          aria-label="Nächster Monat"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ▶
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md border border-border bg-surface p-2">
          <dt className="text-muted">Einnahmen</dt>
          <dd className="font-semibold">{money(totals.einnahmen)}</dd>
        </div>
        <div className="rounded-md border border-border bg-surface p-2">
          <dt className="text-muted">Ausgaben</dt>
          <dd className="font-semibold">{money(totals.ausgaben)}</dd>
        </div>
        <div className="rounded-md border border-border bg-surface p-2">
          <dt className="text-muted">Gespart</dt>
          <dd className="font-semibold">{money(totals.sparen)}</dd>
        </div>
      </dl>

      {open.length > 0 && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm"
        >
          <span>
            Fixkosten für {MONTH_NAMES[Number(month.slice(5, 7)) - 1]} buchen? ({open.length} offen)
          </span>
          <button
            className="rounded-md bg-accent px-3 py-1 text-accent-text"
            onClick={() => setBooking(true)}
          >
            Prüfen und buchen
          </button>
        </div>
      )}

      <MonthList
        groups={groups}
        country={country}
        persons={persons}
        onEdit={(t) => {
          setEditing(t)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onDelete={(t) =>
          window.confirm('Buchung löschen?') && void store.remove('transactions', t.id)
        }
      />

      {booking && (
        <BookTemplatesDialog
          month={month}
          country={country}
          templates={open}
          categories={categories}
          onBook={bookTemplates}
          onClose={() => setBooking(false)}
        />
      )}
    </section>
  )
}
