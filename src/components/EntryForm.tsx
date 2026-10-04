import { useMemo, useState, type FormEvent } from 'react'
import { buttonClass, inputClass } from '../auth/ui'
import { buildEntry, type EntryDraft } from '../domain/entry'
import { INTERVALS, monthsForInterval, type IntervalEvery } from '../domain/templates'
import { newId } from '../data/seed'
import type {
  Area,
  Category,
  CategoryType,
  Goal,
  Person,
  Settings,
  Transaction,
  Who,
} from '../domain/types'

const TYPES: { value: CategoryType; label: string }[] = [
  { value: 'ausgabe', label: 'Ausgabe' },
  { value: 'einnahme', label: 'Einnahme' },
  { value: 'sparen', label: 'Sparen' },
]

export interface EntryFormProps {
  settings: Settings
  categories: Category[]
  areas: Area[]
  persons: Person[]
  goals: Goal[]
  /** Zum Bearbeiten; ohne Wert wird neu erfasst. */
  initial?: Transaction | null
  defaultDate: string
  /** `repeat`: Fälligkeitsmonate (1–12) der neuen Vorlage, sonst `null`. */
  onSubmit(draft: EntryDraft, opts: { repeat: number[] | null }): Promise<void>
  onCancel?(): void
}

/** Eingabeformular für eine Buchung (neu oder bearbeiten). */
export function EntryForm(props: EntryFormProps) {
  const { settings, categories, areas, persons, goals, initial } = props
  const typeOf = (id: string) => categories.find((c) => c.id === id)?.type
  const activePersons = persons.filter((p) => p.active)
  const canShare = settings.living === 'wg' || settings.living === 'partner'
  const partner = settings.living === 'partner' ? activePersons[0] : undefined

  const [type, setType] = useState<CategoryType>(
    initial ? (typeOf(initial.categoryId) ?? 'ausgabe') : 'ausgabe',
  )
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : '')
  const [date, setDate] = useState(initial?.date ?? props.defaultDate)
  const [note, setNote] = useState(initial?.note ?? '')
  const [shared, setShared] = useState(Boolean(initial?.shared))
  const [paidBy, setPaidBy] = useState<Who>(initial?.shared?.paidBy ?? 'me')
  // Beteiligte: Solange man sie nicht selbst ändert, sind es «ich + alle aktiven Personen» (auch wenn die Personen erst
  // einen Moment nach dem Öffnen des Formulars geladen sind). Beim Bearbeiten gelten zuerst die gespeicherten Beteiligten.
  const [participantsOverride, setParticipantsOverride] = useState<Who[] | null>(
    initial?.shared ? initial.shared.parts.map((p) => p.who) : null,
  )
  const participants: Who[] = participantsOverride ?? ['me', ...activePersons.map((p) => p.id)]
  const [myPct, setMyPct] = useState(() => {
    if (initial?.shared && initial.amountCents > 0)
      return String(Math.round((initial.myAmountCents / initial.amountCents) * 100 * 100) / 100)
    return String(settings.myPartnerSharePct)
  })
  const [goalId, setGoalId] = useState(initial?.goalId ?? '')
  const [direction, setDirection] = useState<'einzahlung' | 'entnahme'>(
    initial?.goalDirection ?? 'einzahlung',
  )
  const [repeat, setRepeat] = useState(false)
  const [every, setEvery] = useState<IntervalEvery>(1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [id, setId] = useState(() => initial?.id ?? newId())

  const options = useMemo(
    () =>
      [...areas]
        .sort((a, b) => a.order - b.order)
        .map((area) => ({
          area,
          cats: categories
            .filter(
              (c) =>
                c.areaId === area.id &&
                c.type === type &&
                (!c.hidden || c.id === initial?.categoryId),
            )
            .sort((a, b) => a.order - b.order),
        }))
        .filter((g) => g.cats.length > 0),
    [areas, categories, type, initial?.categoryId],
  )

  const showShare = canShare && type === 'ausgabe'
  const people: { id: Who; name: string }[] = [
    { id: 'me', name: 'Ich' },
    ...activePersons.map((p) => ({ id: p.id, name: p.name })),
  ]
  const unit = settings.country === 'CH' ? 'CHF' : 'EUR'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSavedNote(false)
    const result = buildEntry({
      id,
      type,
      categoryId,
      amount,
      date,
      note,
      shared:
        shared && showShare
          ? partner
            ? {
                paidBy,
                mode: 'percent',
                participants: ['me', partner.id],
                partnerId: partner.id,
                myPct: Number(myPct),
              }
            : { paidBy, mode: 'equal', participants }
          : null,
      goal: type === 'sparen' && goalId ? { id: goalId, direction } : null,
      existing: initial ?? undefined,
    })
    if (!result.ok) return setError(result.error)
    setBusy(true)
    try {
      await props.onSubmit(result.draft, {
        repeat: repeat && !initial ? monthsForInterval(every, Number(date.slice(5, 7))) : null,
      })
      if (!initial) {
        setAmount('')
        setNote('')
        setRepeat(false)
        setEvery(1)
        setId(newId())
        setSavedNote(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-border bg-surface p-5"
      aria-label={initial ? 'Buchung bearbeiten' : 'Neue Buchung'}
    >
      <h2 className="text-lg font-semibold">{initial ? 'Buchung bearbeiten' : 'Neue Buchung'}</h2>

      <div role="radiogroup" aria-label="Art" className="flex gap-2">
        {TYPES.map((t) => (
          <label
            key={t.value}
            className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${type === t.value ? 'border-accent bg-accent/10 font-medium' : 'border-border'}`}
          >
            <input
              type="radio"
              name="art"
              className="sr-only"
              checked={type === t.value}
              onChange={() => {
                setType(t.value)
                if (typeOf(categoryId) !== t.value) setCategoryId('')
              }}
            />
            {t.label}
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Betrag ({unit})</span>
          <input
            className={inputClass}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Kategorie</span>
          <select
            className={inputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Kategorie wählen …</option>
            {options.map((g) => (
              <optgroup key={g.area.id} label={g.area.name}>
                {g.cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
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
        <label className="block space-y-1">
          <span className="text-sm font-medium">Notiz (optional)</span>
          <input
            className={inputClass}
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      {type === 'sparen' && goals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Sparziel (optional)</span>
            <select
              className={inputClass}
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
            >
              <option value="">Kein Sparziel</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {goalId && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Art</span>
              <select
                className={inputClass}
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'einzahlung' | 'entnahme')}
              >
                <option value="einzahlung">Einzahlung</option>
                <option value="entnahme">Entnahme</option>
              </select>
            </label>
          )}
        </div>
      )}

      {showShare && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              disabled={activePersons.length === 0}
            />
            Gemeinsame Ausgabe
          </label>
          {activePersons.length === 0 && (
            <p className="text-sm text-muted">
              Trage zuerst in den Einstellungen{' '}
              {settings.living === 'wg' ? 'deine Mitbewohner/innen' : 'Partner/in'} ein.
            </p>
          )}
          {shared && (
            <>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Bezahlt von</span>
                <select
                  className={inputClass}
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {partner ? (
                <label className="block space-y-1">
                  <span className="text-sm font-medium">Mein Anteil (%)</span>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={100}
                    value={myPct}
                    onChange={(e) => setMyPct(e.target.value)}
                  />
                </label>
              ) : (
                <fieldset className="space-y-1">
                  <legend className="text-sm font-medium">Beteiligt (gleich geteilt)</legend>
                  <div className="flex flex-wrap gap-3">
                    {people.map((p) => (
                      <label key={p.id} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={participants.includes(p.id)}
                          onChange={(e) =>
                            setParticipantsOverride(
                              e.target.checked
                                ? [...participants, p.id]
                                : participants.filter((x) => x !== p.id),
                            )
                          }
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </>
          )}
        </div>
      )}

      {!initial && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Wiederholen (als Fixkosten-Vorlage speichern)
          </label>
          {repeat && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Intervall</span>
              <select
                className={inputClass}
                value={every}
                onChange={(e) => setEvery(Number(e.target.value) as IntervalEvery)}
              >
                {INTERVALS.map((i) => (
                  <option key={i.every} value={i.every}>
                    {i.label}
                  </option>
                ))}
              </select>
              {every > 1 && (
                <span className="block text-xs text-muted">
                  Fällig ab dem Monat des Datums, danach im Rhythmus.
                </span>
              )}
            </label>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      {savedNote && (
        <p role="status" className="text-sm text-muted">
          Gespeichert.
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass} disabled={busy}>
          {initial ? 'Änderung speichern' : 'Speichern'}
        </button>
        {props.onCancel && (
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2"
            onClick={props.onCancel}
          >
            Abbrechen
          </button>
        )}
      </div>
    </form>
  )
}
