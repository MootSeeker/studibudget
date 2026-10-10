import { useMemo, useState } from 'react'
import { buttonClass, Field, inputClass } from '../auth/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { catalogFor } from '../data/catalog'
import type { OnboardingInput } from '../data/onboarding'
import { parseAmount } from '../domain/money'
import { defaultSemesters } from '../domain/period'
import { firstDuplicate } from '../domain/persons'
import type { Country, Living, Semester } from '../domain/types'
import { MonthSelect } from '../components/MonthSelect'

const LIVING: { value: Living; label: string; hint: string }[] = [
  { value: 'allein', label: 'Allein', hint: 'Eigene Wohnung oder Studio' },
  { value: 'wg', label: 'WG', hint: 'Mit Mitbewohner/innen, Kosten werden geteilt' },
  { value: 'partner', label: 'Mit Partner/in', hint: 'Gemeinsame Kosten nach Prozentanteil' },
  { value: 'eltern', label: 'Bei den Eltern', hint: 'Kostgeld statt Miete' },
]

const STEPS = ['Land', 'Wohnen', 'Semester', 'Budget'] as const

function Choice(props: {
  checked: boolean
  onChange: () => void
  label: string
  hint?: string
  name: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${props.checked ? 'border-accent bg-accent/10' : 'border-border'}`}
    >
      <input
        type="radio"
        name={props.name}
        checked={props.checked}
        onChange={props.onChange}
        className="mt-1"
      />
      <span>
        <span className="block font-medium">{props.label}</span>
        {props.hint && <span className="block text-sm text-muted">{props.hint}</span>}
      </span>
    </label>
  )
}

export function Wizard({ onFinish }: { onFinish: (input: OnboardingInput) => Promise<void> }) {
  useDocumentTitle('Einrichtung')
  const [step, setStep] = useState(0)
  const [country, setCountry] = useState<Country>('CH')
  const [living, setLiving] = useState<Living>('allein')
  const [hasCar, setHasCar] = useState(false)
  const [names, setNames] = useState<string[]>([''])
  const [partnerPct, setPartnerPct] = useState('50')
  const [semesters, setSemesters] = useState<Semester[]>(() => defaultSemesters('CH'))
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = useMemo(() => catalogFor(country, living, hasCar), [country, living, hasCar])
  const filledNames = names.map((n) => n.trim()).filter(Boolean)

  function pickCountry(c: Country) {
    setCountry(c)
    setSemesters(defaultSemesters(c))
  }

  function validate(): string | null {
    if (step === 1) {
      if (living === 'wg' && filledNames.length === 0)
        return 'Trage mindestens eine Mitbewohnerin oder einen Mitbewohner ein.'
      if (living === 'wg' && firstDuplicate(filledNames))
        return `«${firstDuplicate(filledNames)}» kommt mehrfach vor. Die Namen müssen verschieden sein.`
      if (living === 'partner') {
        if (filledNames.length === 0)
          return 'Trage den Namen deiner Partnerin oder deines Partners ein.'
        const p = Number(partnerPct)
        if (!Number.isFinite(p) || p < 0 || p > 100)
          return 'Dein Anteil muss zwischen 0 und 100 Prozent liegen.'
      }
    }
    if (step === 3) {
      for (const [k, v] of Object.entries(budgets))
        if (v.trim() && parseAmount(v) === null) return `«${v}» ist kein gültiger Betrag (${k}).`
    }
    return null
  }

  function next() {
    const problem = validate()
    setError(problem)
    if (!problem) setStep(step + 1)
  }

  async function finish() {
    const problem = validate()
    setError(problem)
    if (problem) return
    setBusy(true)
    try {
      const parsed: Record<string, number> = {}
      for (const [k, v] of Object.entries(budgets)) {
        const cents = v.trim() ? parseAmount(v) : null
        if (cents && cents > 0) parsed[k] = cents
      }
      await onFinish({
        country,
        living,
        hasCar,
        partnerSharePct: living === 'partner' ? Number(partnerPct) : 50,
        persons:
          living === 'wg' || living === 'partner'
            ? living === 'partner'
              ? filledNames.slice(0, 1)
              : filledNames
            : [],
        semesters,
        budgets: parsed,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
      setBusy(false)
    }
  }

  const expenseItems = items.filter((i) => i.type !== 'einnahme')
  const areas = [...new Set(expenseItems.map((i) => i.area))]

  return (
    <div className="mx-auto mt-8 w-full max-w-2xl space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <p className="text-sm text-muted">
          Schritt {step + 1} von {STEPS.length} · {STEPS[step]}
        </p>
        <h1 className="text-xl font-semibold">Willkommen bei StudiBudget</h1>
      </div>

      {step === 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 font-medium">In welchem Land lebst du?</legend>
          <Choice
            name="land"
            checked={country === 'CH'}
            onChange={() => pickCountry('CH')}
            label="Schweiz"
            hint="Beträge in CHF"
          />
          <Choice
            name="land"
            checked={country === 'DE'}
            onChange={() => pickCountry('DE')}
            label="Deutschland"
            hint="Beträge in EUR"
          />
        </fieldset>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">Wie wohnst du?</legend>
            {LIVING.map((l) => (
              <Choice
                key={l.value}
                name="wohnen"
                checked={living === l.value}
                onChange={() => setLiving(l.value)}
                label={l.label}
                hint={l.hint}
              />
            ))}
          </fieldset>
          {living === 'wg' && (
            <div className="space-y-2">
              <p className="font-medium">Wer wohnt mit dir?</p>
              {names.map((n, i) => (
                <input
                  key={i}
                  aria-label={`Mitbewohner/in ${i + 1}`}
                  className={inputClass}
                  value={n}
                  placeholder="Name"
                  onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
              <button
                type="button"
                className="text-sm text-accent underline"
                onClick={() => setNames([...names, ''])}
              >
                Person hinzufügen
              </button>
            </div>
          )}
          {living === 'partner' && (
            <div className="space-y-3">
              <Field
                label="Name von Partner/in"
                value={names[0] ?? ''}
                onChange={(v) => setNames([v])}
              />
              <Field
                label="Dein Anteil an gemeinsamen Kosten (%)"
                type="number"
                value={partnerPct}
                onChange={setPartnerPct}
                hint="50 heisst: ihr teilt hälftig."
              />
            </div>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasCar} onChange={(e) => setHasCar(e.target.checked)} />
            Ich habe ein Auto
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="font-medium">Wann laufen deine Semester?</p>
          <p className="text-sm text-muted">
            Vorgabe für {country === 'CH' ? 'die Schweiz' : 'Deutschland'}. Hochschulen weichen
            teils ab, passe es an.
          </p>
          {semesters.map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input
                aria-label={`Name Semester ${i + 1}`}
                className={inputClass}
                value={s.name}
                onChange={(e) =>
                  setSemesters(
                    semesters.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <MonthSelect
                label={`Start Semester ${i + 1}`}
                value={s.startMonth}
                onChange={(m) =>
                  setSemesters(semesters.map((x, j) => (j === i ? { ...x, startMonth: m } : x)))
                }
              />
              <MonthSelect
                label={`Ende Semester ${i + 1}`}
                value={s.endMonth}
                onChange={(m) =>
                  setSemesters(semesters.map((x, j) => (j === i ? { ...x, endMonth: m } : x)))
                }
              />
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="font-medium">Monatsbudgets (optional)</p>
            <p className="text-sm text-muted">
              Wie viel willst du pro Monat ausgeben? Du kannst alles leer lassen und später auf der
              Seite «Budget» ergänzen.
            </p>
          </div>
          <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
            {areas.map((area) => (
              <div key={area}>
                <h2 className="mb-1 text-sm font-semibold text-muted">{area}</h2>
                <div className="space-y-1">
                  {expenseItems
                    .filter((i) => i.area === area)
                    .map((i) => (
                      <label key={i.key} className="grid grid-cols-[1fr_9rem] items-center gap-3">
                        <span className="text-sm">{i.name}</span>
                        <input
                          aria-label={`Budget ${i.name}`}
                          className={`${inputClass} text-right`}
                          inputMode="decimal"
                          placeholder="0"
                          value={budgets[i.key] ?? ''}
                          onChange={(e) => setBudgets({ ...budgets, [i.key]: e.target.value })}
                        />
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
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

      <div className="flex justify-between">
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 disabled:opacity-40"
          disabled={step === 0 || busy}
          onClick={() => {
            setError(null)
            setStep(step - 1)
          }}
        >
          Zurück
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className={buttonClass} onClick={next}>
            Weiter
          </button>
        ) : (
          <button type="button" className={buttonClass} disabled={busy} onClick={finish}>
            {busy ? 'Einen Moment …' : 'Fertig'}
          </button>
        )}
      </div>
    </div>
  )
}
