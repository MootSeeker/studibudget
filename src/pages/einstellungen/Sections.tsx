import { useEffect, useState, type ReactNode } from 'react'
import { buttonClass, Field, inputClass } from '../../auth/ui'
import { MonthSelect } from '../../components/MonthSelect'
import { applyCatalogPlan, planCatalogChange, type CatalogPlan } from '../../data/catalogSync'
import { db } from '../../data/db'
import { useAllCars, usePersons } from '../../data/hooks'
import { newId } from '../../data/seed'
import { store } from '../../data/store'
import { defaultSemesters } from '../../domain/period'
import { isDuplicateName } from '../../domain/persons'
import {
  checkSemesters,
  formatMonths,
  MAX_SEMESTERS,
  nextSemester,
  trimSemesters,
} from '../../domain/semesters'
import type { Country, Living, Semester, Settings, ThemeChoice } from '../../domain/types'
import { applyTheme } from '../../theme'
import { saveSettings } from './saveSettings'
import { useSectionDraft } from './useSectionDraft'
import { useRegisterUnsaved } from './useUnsaved'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

const LIVING: { value: Living; label: string }[] = [
  { value: 'allein', label: 'Allein' },
  { value: 'wg', label: 'WG' },
  { value: 'partner', label: 'Mit Partner/in' },
  { value: 'eltern', label: 'Bei den Eltern' },
]

function PlanSummary({ plan }: { plan: CatalogPlan }) {
  const list = (title: string, names: string[]) =>
    names.length > 0 && (
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted">{names.join(', ')}</p>
      </div>
    )
  return (
    <div
      className="space-y-2 rounded-md border border-border bg-bg p-3 text-sm"
      role="region"
      aria-label="Änderungen an den Kategorien"
    >
      {list(
        'Werden hinzugefügt',
        plan.add.map((i) => i.name),
      )}
      {list(
        'Werden wieder eingeblendet',
        plan.unhide.map((c) => c.name),
      )}
      {list(
        'Werden ausgeblendet (Buchungen bleiben erhalten)',
        plan.hide.map((c) => c.name),
      )}
      {list(
        'Werden umbenannt',
        plan.rename.map((r) => `${r.category.name} → ${r.name}`),
      )}
      {plan.empty && <p className="text-muted">An den Kategorien ändert sich nichts.</p>}
    </div>
  )
}

export function HousingSection({ settings }: { settings: Settings }) {
  const [country, setCountry] = useState<Country>(settings.country)
  const [living, setLiving] = useState<Living>(settings.living)
  const [hasCar, setHasCar] = useState(settings.hasCar)
  const [plan, setPlan] = useState<CatalogPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const changed =
    country !== settings.country || living !== settings.living || hasCar !== settings.hasCar

  // Solange nichts geändert ist, folgt die Auswahl dem gespeicherten Stand (Issue #184).
  useEffect(() => {
    if (!changed) {
      setCountry(settings.country)
      setLiving(settings.living)
      setHasCar(settings.hasCar)
    }
  }, [settings.country, settings.living, settings.hasCar])

  function discard() {
    setCountry(settings.country)
    setLiving(settings.living)
    setHasCar(settings.hasCar)
    setPlan(null)
    setError(null)
  }
  useRegisterUnsaved('housing', changed, { discard })

  async function review() {
    setError(null)
    setPlan(await planCatalogChange(db, settings, { country, living, hasCar }))
  }

  async function apply() {
    if (!plan) return
    try {
      await applyCatalogPlan(db, plan)
      await saveSettings(settings, {
        country,
        living,
        hasCar,
        semesters: country !== settings.country ? defaultSemesters(country) : settings.semesters,
      })
      setPlan(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    }
  }

  return (
    <Section title="Land und Wohnsituation">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Land</span>
        <select
          className={inputClass}
          value={country}
          onChange={(e) => {
            setCountry(e.target.value as Country)
            setPlan(null)
          }}
        >
          <option value="CH">Schweiz (CHF)</option>
          <option value="DE">Deutschland (EUR)</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Wohnsituation</span>
        <select
          className={inputClass}
          value={living}
          onChange={(e) => {
            setLiving(e.target.value as Living)
            setPlan(null)
          }}
        >
          {LIVING.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={hasCar}
          onChange={(e) => {
            setHasCar(e.target.checked)
            setPlan(null)
          }}
        />
        Ich habe ein Auto
      </label>
      {country !== settings.country && (
        <p
          role="note"
          className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
        >
          Beim Wechsel des Landes werden Beträge <strong>nicht umgerechnet</strong>. Die Semester
          werden auf die Vorgabe des neuen Landes gesetzt.
        </p>
      )}
      {plan && <PlanSummary plan={plan} />}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {changed && <p className="text-sm text-amber-700">Nicht gespeichert</p>}
      <div className="flex gap-2">
        {!plan ? (
          <button className={buttonClass} disabled={!changed} onClick={review}>
            Änderung prüfen
          </button>
        ) : (
          <>
            <button className={buttonClass} onClick={apply}>
              Übernehmen
            </button>
            <button
              className="rounded-md border border-border px-4 py-2"
              onClick={() => setPlan(null)}
            >
              Abbrechen
            </button>
          </>
        )}
      </div>
    </Section>
  )
}

export function PersonsSection({ settings }: { settings: Settings }) {
  const persons = usePersons()
  const [name, setName] = useState('')
  const [pct, setPct] = useState(String(settings.myPartnerSharePct))
  const [pctError, setPctError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  if (settings.living !== 'wg' && settings.living !== 'partner') return null
  const label = settings.living === 'wg' ? 'Mitbewohner/innen' : 'Partner/in'

  async function add() {
    if (!name.trim()) return
    if (
      isDuplicateName(
        name,
        persons.map((p) => p.name),
      )
    )
      return setNameError(`«${name.trim()}» gibt es schon. Bitte wähle einen anderen Namen.`)
    setNameError(null)
    await store.put('persons', { id: newId(), deleted: false, name: name.trim(), active: true })
    setName('')
  }

  async function savePct() {
    const p = Number(pct)
    if (!Number.isFinite(p) || p < 0 || p > 100) return setPctError('Zwischen 0 und 100 Prozent.')
    setPctError(null)
    await saveSettings(settings, { myPartnerSharePct: p })
  }

  return (
    <Section title={label}>
      <ul className="space-y-2">
        {persons.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <input
              aria-label={`Name ${p.name}`}
              className={inputClass}
              defaultValue={p.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (
                  v &&
                  v !== p.name &&
                  isDuplicateName(
                    v,
                    persons.filter((x) => x.id !== p.id).map((x) => x.name),
                  )
                ) {
                  setNameError(`«${v}» gibt es schon. Bitte wähle einen anderen Namen.`)
                  e.target.value = p.name
                  return
                }
                setNameError(null)
                if (v && v !== p.name) void store.patch('persons', p.id, { name: v })
              }}
            />
            <label className="flex items-center gap-1 whitespace-nowrap text-sm">
              <input
                type="checkbox"
                checked={p.active}
                onChange={() =>
                  void store.patch('persons', p.id, (cur) => ({ active: !cur.active }))
                }
              />
              aktiv
            </label>
          </li>
        ))}
        {persons.length === 0 && <li className="text-sm text-muted">Noch niemand eingetragen.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          aria-label="Neue Person"
          className={inputClass}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className={buttonClass} onClick={add}>
          Hinzufügen
        </button>
      </div>
      <p className="text-xs text-muted">
        Inaktive Personen erscheinen nicht mehr bei neuen gemeinsamen Ausgaben; alte Buchungen
        bleiben unverändert.
      </p>
      {settings.living === 'partner' && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              label="Dein Anteil an gemeinsamen Kosten (%)"
              type="number"
              value={pct}
              onChange={setPct}
            />
          </div>
          <button className={buttonClass} onClick={savePct}>
            Speichern
          </button>
        </div>
      )}
      {nameError && (
        <p role="alert" className="text-sm text-red-600">
          {nameError}
        </p>
      )}
      {pctError && (
        <p role="alert" className="text-sm text-red-600">
          {pctError}
        </p>
      )}
    </Section>
  )
}

export function CarsSection({ settings }: { settings: Settings }) {
  const cars = useAllCars()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!settings.hasCar) return null
  const taken = (except?: string) => cars.filter((c) => c.id !== except).map((c) => c.name)

  async function add() {
    const n = name.trim()
    if (!n) return
    if (isDuplicateName(n, taken()))
      return setError(`«${n}» gibt es schon. Bitte wähle einen anderen Namen.`)
    setError(null)
    const order = cars.reduce((m, c) => Math.max(m, c.order), -1) + 1
    await store.put('cars', { id: newId(), deleted: false, name: n, archived: false, order })
    setName('')
  }

  return (
    <Section title="Autos">
      <ul className="space-y-2">
        {cars.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              aria-label={`Name ${c.name}`}
              className={inputClass}
              defaultValue={c.name}
              key={c.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (!v || v === c.name) return
                if (isDuplicateName(v, taken(c.id))) {
                  setError(`«${v}» gibt es schon. Bitte wähle einen anderen Namen.`)
                  e.target.value = c.name
                  return
                }
                setError(null)
                void store.patch('cars', c.id, { name: v })
              }}
            />
            <label className="flex items-center gap-1 whitespace-nowrap text-sm">
              <input
                type="checkbox"
                checked={c.archived}
                onChange={() =>
                  void store.patch('cars', c.id, (cur) => ({ archived: !cur.archived }))
                }
              />
              archiviert
            </label>
          </li>
        ))}
        {cars.length === 0 && <li className="text-sm text-muted">Noch kein Auto eingetragen.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          aria-label="Neues Auto"
          className={inputClass}
          placeholder="Name, z. B. Golf"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className={buttonClass} onClick={add}>
          Hinzufügen
        </button>
      </div>
      <p className="text-xs text-muted">
        Bei Buchungen im Bereich «Mobilität Auto» kannst du das Auto wählen. Archivierte Autos
        erscheinen nicht mehr bei neuen Buchungen; alte Buchungen behalten ihr Auto.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </Section>
  )
}

export function SemesterSection({ settings }: { settings: Settings }) {
  const d = useSectionDraft(settings.semesters)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const check = checkSemesters(d.draft)

  const edit = (next: Semester[]) => {
    setSaved(false)
    d.setDraft(next)
  }

  async function save(force = false): Promise<boolean> {
    if (d.stale && !force) return false
    setSaved(false)
    const value = trimSemesters(d.draft)
    if (checkSemesters(value).errors.length > 0) return false
    setError(null)
    try {
      await saveSettings(settings, { semesters: value })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
      return false
    }
    d.markSaved(value)
    setSaved(true)
    return true
  }
  useRegisterUnsaved('semesters', d.dirty, { save: () => save(), discard: d.reset })

  return (
    <Section title="Semester">
      {d.stale && (
        <div className="space-y-2">
          <p role="note" className="text-sm">
            Die gespeicherten Semester haben sich geändert.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2"
              onClick={d.adoptSaved}
            >
              Gespeicherte Werte übernehmen
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2"
              onClick={() => void save(true)}
            >
              Trotzdem speichern
            </button>
          </div>
        </div>
      )}
      {d.draft.map((s, i) => (
        <div key={i} className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input
              aria-label={`Name Semester ${i + 1}`}
              className={inputClass}
              value={s.name}
              onChange={(e) =>
                edit(d.draft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
            <MonthSelect
              label={`Start Semester ${i + 1}`}
              value={s.startMonth}
              onChange={(m) => edit(d.draft.map((x, j) => (j === i ? { ...x, startMonth: m } : x)))}
            />
            <MonthSelect
              label={`Ende Semester ${i + 1}`}
              value={s.endMonth}
              onChange={(m) => edit(d.draft.map((x, j) => (j === i ? { ...x, endMonth: m } : x)))}
            />
          </div>
          {d.draft.length > 1 && (
            <button
              type="button"
              aria-label={`Semester ${i + 1} entfernen`}
              className="text-sm text-accent underline"
              onClick={() => edit(d.draft.filter((_, j) => j !== i))}
            >
              Entfernen
            </button>
          )}
        </div>
      ))}
      {d.draft.length < MAX_SEMESTERS && (
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm"
          onClick={() => edit([...d.draft, nextSemester(d.draft)])}
        >
          Semester hinzufügen
        </button>
      )}
      {check.errors.map((e) => (
        <p key={e} role="alert" className="text-sm text-red-600">
          {e}
        </p>
      ))}
      {check.gapMonths.length > 0 && (
        <p role="note" className="text-sm">
          {`Diese Monate gehören zu keinem Semester: ${formatMonths(check.gapMonths)}.`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {d.dirty && <p className="text-sm text-amber-700">Nicht gespeichert</p>}
      <div className="flex items-center gap-3">
        <button className={buttonClass} disabled={d.stale} onClick={() => void save()}>
          Speichern
        </button>
        <button
          className="text-sm text-accent underline"
          onClick={() => edit(defaultSemesters(settings.country))}
        >
          Auf Vorgabe zurücksetzen
        </button>
        {saved && (
          <span role="status" className="text-sm">
            Gespeichert.
          </span>
        )}
      </div>
    </Section>
  )
}

export function DisplaySection({ settings }: { settings: Settings }) {
  return (
    <Section title="Darstellung">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Darstellung</span>
        <select
          className={inputClass}
          value={settings.theme}
          onChange={(e) => {
            const theme = e.target.value as ThemeChoice
            applyTheme(theme)
            void saveSettings(settings, { theme })
          }}
        >
          <option value="system">Wie das Gerät</option>
          <option value="light">Hell</option>
          <option value="dark">Dunkel</option>
        </select>
      </label>
    </Section>
  )
}

export function AmpelSection({ settings }: { settings: Settings }) {
  const d = useSectionDraft({
    yellow: String(settings.ampel.yellowPct),
    red: String(settings.ampel.redPct),
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const edit = (next: { yellow: string; red: string }) => {
    setSaved(false)
    d.setDraft(next)
  }

  async function save(force = false): Promise<boolean> {
    if (d.stale && !force) return false
    const y = Number(d.draft.yellow)
    const r = Number(d.draft.red)
    setSaved(false)
    if (!Number.isFinite(y) || !Number.isFinite(r) || y <= 0 || r <= y) {
      setError('Gelb muss über 0 und kleiner als Rot sein.')
      return false
    }
    setError(null)
    try {
      await saveSettings(settings, { ampel: { yellowPct: y, redPct: r } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
      return false
    }
    d.markSaved({ yellow: String(y), red: String(r) })
    setSaved(true)
    return true
  }
  useRegisterUnsaved('ampel', d.dirty, { save: () => save(), discard: d.reset })

  return (
    <Section title="Ampel">
      {d.stale && (
        <div className="space-y-2">
          <p role="note" className="text-sm">
            Die gespeicherten Werte haben sich geändert.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2"
              onClick={d.adoptSaved}
            >
              Gespeicherte Werte übernehmen
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2"
              onClick={() => void save(true)}
            >
              Trotzdem speichern
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Ampel gelb ab (%)"
          type="number"
          value={d.draft.yellow}
          onChange={(v) => edit({ ...d.draft, yellow: v })}
        />
        <Field
          label="Ampel rot ab (%)"
          type="number"
          value={d.draft.red}
          onChange={(v) => edit({ ...d.draft, red: v })}
        />
      </div>
      <p className="text-xs text-muted">
        Bezieht sich auf den Anteil des Monatsbudgets, der bereits ausgegeben ist.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {d.dirty && <p className="text-sm text-amber-700">Nicht gespeichert</p>}
      <div className="flex items-center gap-3">
        <button className={buttonClass} disabled={d.stale} onClick={() => void save()}>
          Ampel speichern
        </button>
        {saved && (
          <span role="status" className="text-sm">
            Gespeichert.
          </span>
        )}
      </div>
    </Section>
  )
}
