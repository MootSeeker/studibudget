import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { buttonClass, inputClass } from '../auth/ui'
import {
  useAllTransactions,
  useCategories,
  usePersons,
  useSettings,
  useSettlements,
} from '../data/hooks'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { MONTH_NAMES } from '../lib/months'
import { formatMoney } from '../domain/money'
import { addMonths, currentMonth, monthOf } from '../domain/period'
import {
  balances,
  buildSettlement,
  effectsOf,
  monthSettlement,
  settlementEffect,
  suggestSettlement,
} from '../domain/settlement'
import type { Settlement } from '../domain/types'

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const day = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
const PAGE = 30

export function Ausgleich() {
  const settings = useSettings()
  const persons = usePersons()
  const txs = useAllTransactions()
  const settlements = useSettlements()
  const categories = useCategories()
  const [personId, setPersonId] = useState('')
  const [direction, setDirection] = useState<Settlement['direction']>('ich_erhalte')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [filter, setFilter] = useState('')
  const [all, setAll] = useState(false)
  const [month, setMonth] = useState(currentMonth())
  const [allMonths, setAllMonths] = useState(false)

  if (!settings) return null
  if (settings.living !== 'wg' && settings.living !== 'partner') {
    return (
      <section className="max-w-2xl space-y-4 xl:max-w-4xl">
        <h1 className="text-2xl font-semibold">Ausgleich</h1>
        <p className="rounded-md border border-border bg-surface p-4 text-muted">
          Den Ausgleich brauchst du nur, wenn du in einer WG oder mit Partner/in wohnst und Kosten
          teilst. Deine Wohnsituation kannst du in den{' '}
          <Link to="/einstellungen" className="text-accent underline">
            Einstellungen
          </Link>{' '}
          ändern.
        </p>
      </section>
    )
  }

  const money = (c: number) => formatMoney(c, settings.country)
  const nameOf = (id: string) =>
    id === 'me' ? 'Du' : (persons.find((p) => p.id === id)?.name ?? 'Unbekannt')
  const bal = balances(txs, settlements)
  const rows = persons.filter((p) => p.active || (bal.get(p.id) ?? 0) !== 0)
  const balanceOf = (id: string) => bal.get(id) ?? 0

  const statement = (id: string, cents: number) =>
    cents === 0
      ? `Mit ${nameOf(id)} bist du ausgeglichen.`
      : cents > 0
        ? `${nameOf(id)} schuldet dir ${money(cents)}.`
        : `Du schuldest ${nameOf(id)} ${money(-cents)}.`

  function prefill(id: string) {
    const s = suggestSettlement(balanceOf(id))
    setPersonId(id)
    if (s) {
      setDirection(s.direction)
      setAmount((s.cents / 100).toFixed(2))
    }
    setSaved(false)
    setError(null)
    document.getElementById('ausgleich-form')?.scrollIntoView?.({ behavior: 'smooth' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const r = buildSettlement({ id: newId(), personId, direction, amount, date, note })
    if (!r.ok) return setError(r.error)
    setError(null)
    await store.put('settlements', r.draft)
    setAmount('')
    setNote('')
    setSaved(true)
  }

  // Vorschau: Saldo nach dieser Zahlung
  const preview = (() => {
    if (!personId) return null
    const r = buildSettlement({ id: 'x', personId, direction, amount, date, note: '' })
    if (!r.ok) return null
    const after = balanceOf(personId) + settlementEffect({ ...r.draft, updatedAt: '' }).cents
    return statement(personId, after)
  })()

  const inMonth = (date: string) => allMonths || monthOf(date) === month
  const monthLabel = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
  const sum = monthSettlement(txs, settlements, categories, month)

  function changeMonth(next: string) {
    setMonth(next)
    setAll(false)
    // Zahlungen werden meist im betrachteten Monat erfasst.
    setDate(next === currentMonth() ? todayIso() : `${next}-01`)
  }

  const shared = txs
    .filter(
      (t) =>
        inMonth(t.date) &&
        effectsOf(t).length > 0 &&
        (!filter || effectsOf(t).some((e) => e.personId === filter)),
    )
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
  const shownShared = all ? shared : shared.slice(0, PAGE)
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt'
  const history = settlements
    .filter((s) => inMonth(s.date))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))

  return (
    <section className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Ausgleich</h1>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            className="min-h-11 min-w-11 rounded-md border border-border px-3 py-2"
            aria-label="Vorheriger Monat"
            onClick={() => changeMonth(addMonths(month, -1))}
          >
            ◀
          </button>
          <h2 className="text-lg font-semibold" aria-live="polite">
            {monthLabel}
          </h2>
          <button
            className="min-h-11 min-w-11 rounded-md border border-border px-3 py-2"
            aria-label="Nächster Monat"
            onClick={() => changeMonth(addMonths(month, 1))}
          >
            ▶
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
          <div className="rounded-md border border-border bg-surface p-2">
            <dt className="text-muted">Erhalten</dt>
            <dd className="font-semibold">{money(sum.received)}</dd>
          </div>
          <div className="rounded-md border border-border bg-surface p-2">
            <dt className="text-muted">Bezahlt</dt>
            <dd className="font-semibold">{money(sum.paid)}</dd>
          </div>
          <div className="rounded-md border border-border bg-surface p-2">
            <dt className="text-muted">Neu offen</dt>
            <dd className="font-semibold">{money(sum.sharedNet)}</dd>
          </div>
          <div className="rounded-md border border-border bg-surface p-2">
            <dt className="text-muted">
              {sum.deficit > 0 ? 'Echtes Defizit' : 'Echter Überschuss'}
            </dt>
            <dd className="font-semibold">{money(Math.abs(sum.deficit))}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted">
          «Neu offen»: was dir aus den gemeinsamen Buchungen dieses Monats geschuldet wird (minus,
          was du schuldest). «Echtes Defizit»: was du in {monthLabel} tatsächlich bezahlt hast (bei
          gemeinsamen Ausgaben der ganze Betrag, den du vorgestreckt hast) plus Ausgleichszahlungen,
          die du geleistet hast, minus Einnahmen und erhaltene Ausgleichszahlungen. Sparen zählt
          nicht mit. Das ist nur eine Anzeige und ändert dein Budget nicht.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allMonths}
            onChange={(e) => setAllMonths(e.target.checked)}
          />
          Listen für alle Monate zeigen
        </label>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Wer schuldet wem?</h2>
        {rows.length === 0 ? (
          <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
            Noch niemand eingetragen. Füge unter{' '}
            <Link to="/einstellungen" className="text-accent underline">
              Einstellungen
            </Link>{' '}
            deine Mitbewohner/innen oder Partner/in hinzu.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((p) => {
              const c = balanceOf(p.id)
              return (
                <li key={p.id} className="space-y-2 rounded-xl border border-border bg-surface p-4">
                  <p className="font-medium">
                    {p.name}
                    {!p.active && (
                      <span className="ml-2 rounded bg-border px-2 text-xs">inaktiv</span>
                    )}
                  </p>
                  <p
                    className={`text-lg font-semibold ${c > 0 ? 'text-ok' : c < 0 ? 'text-warn' : ''}`}
                  >
                    {statement(p.id, c)}
                  </p>
                  {c > 0 && (
                    <Link
                      className="mr-4 text-sm text-accent underline"
                      to={`/ausgleich/rechnung/${p.id}`}
                      aria-label={`Rechnung für ${p.name} erstellen`}
                    >
                      Rechnung erstellen
                    </Link>
                  )}
                  {c !== 0 && (
                    <button
                      className="text-sm text-accent underline"
                      onClick={() => prefill(p.id)}
                      aria-label={`${p.name} ausgleichen`}
                    >
                      Ausgleichen
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-sm text-muted">
          Berechnet aus allen gemeinsamen Buchungen und den erfassten Ausgleichszahlungen aller
          Monate. Ausgleichszahlungen zählen nicht ins Budget.
        </p>
      </div>

      <form
        id="ausgleich-form"
        onSubmit={submit}
        className="space-y-4 rounded-xl border border-border bg-surface p-5"
        aria-label="Ausgleichszahlung erfassen"
      >
        <h2 className="text-lg font-semibold">Ausgleichszahlung erfassen</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Person</span>
            <select
              className={inputClass}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Person wählen …</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Was ist passiert?</span>
            <select
              className={inputClass}
              value={direction}
              onChange={(e) => setDirection(e.target.value as Settlement['direction'])}
            >
              <option value="ich_erhalte">Ich habe Geld erhalten</option>
              <option value="ich_zahle">Ich habe Geld bezahlt</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Betrag ({settings.country === 'CH' ? 'CHF' : 'EUR'})
            </span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Datum</span>
            <input
              className={inputClass}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Notiz (optional)</span>
            <input
              className={inputClass}
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        {preview && <p className="text-sm text-muted">Danach: {preview}</p>}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-muted">
            Gespeichert.
          </p>
        )}
        <button type="submit" className={buttonClass}>
          Speichern
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Erfasste Ausgleichszahlungen</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Ausgleichszahlungen.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {history.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <span>
                  {day(s.date)} ·{' '}
                  {s.direction === 'ich_erhalte'
                    ? `Du hast von ${nameOf(s.personId)} ${money(s.amountCents)} erhalten`
                    : `Du hast ${nameOf(s.personId)} ${money(s.amountCents)} bezahlt`}
                  {s.note && <span className="text-muted"> · {s.note}</span>}
                </span>
                <button
                  className="text-red-600 underline dark:text-red-400"
                  onClick={() =>
                    window.confirm('Ausgleichszahlung löschen?') &&
                    void store.remove('settlements', s.id)
                  }
                  aria-label={`Ausgleichszahlung vom ${day(s.date)} löschen`}
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Gemeinsame Buchungen</h2>
          <label className="flex items-center gap-2 text-sm">
            Person
            <select
              aria-label="Gemeinsame Buchungen filtern"
              className="rounded-md border border-control bg-surface px-2 py-1"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {shared.length === 0 ? (
          <p className="text-sm text-muted">
            Noch keine gemeinsamen Buchungen. Erfasse sie unter «Eingabe» mit dem Häkchen
            «Gemeinsame Ausgabe».
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {shownShared.map((t) => (
              <li key={t.id} className="space-y-0.5 px-4 py-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span>
                    {day(t.date)} · {catName(t.categoryId)}
                    {t.note && <span className="text-muted"> · {t.note}</span>}
                  </span>
                  <span className="tabular-nums">{money(t.amountCents)}</span>
                </div>
                <p className="text-muted">
                  Bezahlt von {t.shared!.paidBy === 'me' ? 'dir' : nameOf(t.shared!.paidBy)} ·{' '}
                  {effectsOf(t)
                    .filter((e) => !filter || e.personId === filter)
                    .map((e) =>
                      e.cents > 0
                        ? `${nameOf(e.personId)} schuldet dir ${money(e.cents)}`
                        : `du schuldest ${nameOf(e.personId)} ${money(-e.cents)}`,
                    )
                    .join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}
        {!all && shared.length > PAGE && (
          <button className="text-sm text-accent underline" onClick={() => setAll(true)}>
            Alle {shared.length} anzeigen
          </button>
        )}
      </div>
    </section>
  )
}
