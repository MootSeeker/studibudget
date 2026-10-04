import { useState } from 'react'
import { buttonClass, inputClass } from '../auth/ui'
import { DraftInput } from '../components/DraftInput'
import { WealthChart } from '../components/charts/WealthChart'
import { MONTH_NAMES } from '../components/MonthSelect'
import { createAccountOps } from '../data/accountOps'
import { SUGGESTED_ACCOUNTS, SUGGESTED_GOALS } from '../data/catalog'
import { db } from '../data/db'
import {
  useAccountBalances,
  useAccounts,
  useAllGoals,
  useAllTransactions,
  useSettings,
} from '../data/hooks'
import { formatMoney, parseAmount } from '../domain/money'
import { addMonths, currentMonth, monthOf, monthRange } from '../domain/period'
import { goalBalance, neededPerMonth } from '../domain/goals'
import { enteredBalance, wealthByMonth } from '../domain/wealth'
import type { Account, AccountKind, Country, Goal } from '../domain/types'

const ops = createAccountOps(db)

const KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Bankkonto',
  spar: 'Sparkonto',
  bargeld: 'Bargeld',
  schuld: 'Schuld (z. B. Kreditkarte)',
  depot: 'Depot / Anlage',
}

const SUGGESTION_KINDS: AccountKind[] = ['bank', 'spar', 'bargeld', 'schuld', 'depot']
const monthName = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

function GoalCard({
  goal,
  balance,
  country,
  now,
  run,
}: {
  goal: Goal
  balance: number
  country: Country
  now: string
  run: (fn: () => Promise<void>) => void
}) {
  const money = (c: number) => formatMoney(c, country)
  const [err, setErr] = useState<string | null>(null)
  const pct =
    goal.targetCents > 0 ? Math.max(0, Math.min(100, (balance / goal.targetCents) * 100)) : 0
  const left = goal.targetCents - balance
  const reached = left <= 0
  const overdue = !reached && goal.targetDate !== null && monthOf(goal.targetDate) < now
  const perMonth = reached || overdue ? null : neededPerMonth(goal, balance, now)

  return (
    <li
      className={`space-y-3 rounded-xl border border-border bg-surface p-4 ${goal.archived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        <input
          aria-label={`Name Sparziel ${goal.name}`}
          className={inputClass}
          defaultValue={goal.name}
          key={goal.name}
          onBlur={(e) =>
            e.target.value.trim() !== goal.name &&
            run(() => ops.updateGoal(goal, { name: e.target.value }))
          }
        />
        <button
          className="whitespace-nowrap text-sm text-accent underline"
          onClick={() => run(() => ops.updateGoal(goal, { archived: !goal.archived }))}
        >
          {goal.archived ? 'Wieder aktivieren' : 'Archivieren'}
        </button>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="tabular-nums">
          <strong>{money(balance)}</strong>{' '}
          <span className="text-muted">von {money(goal.targetCents)}</span>
        </span>
        <span className="font-medium">{Math.round(pct)} %</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${goal.name} erreicht`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-2 w-full overflow-hidden rounded bg-border"
      >
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: reached ? 'var(--ok)' : 'var(--series-1)' }}
        />
      </div>
      <p className="text-sm" aria-live="polite">
        {reached ? (
          <span className="text-ok">Ziel erreicht</span>
        ) : overdue ? (
          <span className="text-warn">Zieldatum vorbei, noch {money(left)} offen</span>
        ) : (
          <span>
            Noch {money(left)}
            {perMonth !== null && goal.targetDate && (
              <span className="text-muted">
                {' '}
                · nötig: {money(perMonth)} pro Monat bis {monthName(monthOf(goal.targetDate))}
              </span>
            )}
          </span>
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Zielbetrag</span>
          <DraftInput
            aria-label={`Zielbetrag ${goal.name}`}
            className={inputClass}
            inputMode="decimal"
            value={(goal.targetCents / 100).toFixed(2)}
            onCommit={(text) => {
              const c = parseAmount(text)
              if (c === null) {
                setErr('Bitte gib einen gültigen Betrag ein.')
                return false
              }
              setErr(null)
              if (c === goal.targetCents) return false
              run(() => ops.updateGoal(goal, { targetCents: c }))
            }}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Zieldatum</span>
          <input
            aria-label={`Zieldatum ${goal.name}`}
            type="date"
            className={inputClass}
            defaultValue={goal.targetDate ?? ''}
            key={goal.targetDate ?? 'x'}
            onBlur={(e) =>
              (e.target.value || null) !== goal.targetDate &&
              run(() => ops.updateGoal(goal, { targetDate: e.target.value || null }))
            }
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Anfangsbestand</span>
          <DraftInput
            aria-label={`Anfangsbestand ${goal.name}`}
            className={inputClass}
            inputMode="decimal"
            value={(goal.startCents / 100).toFixed(2)}
            onCommit={(text) => {
              const c = text.trim() === '' ? 0 : parseAmount(text)
              if (c === null || c < 0) {
                setErr('Bitte gib einen gültigen Betrag ein.')
                return false
              }
              setErr(null)
              if (c === goal.startCents) return false
              run(() => ops.updateGoal(goal, { startCents: c }))
            }}
          />
        </label>
      </div>
      {err && (
        <p role="alert" className="text-sm text-red-600">
          {err}
        </p>
      )}
    </li>
  )
}

export function Konten() {
  const settings = useSettings()
  const accounts = useAccounts()
  const balances = useAccountBalances()
  const goals = useAllGoals()
  const txs = useAllTransactions()
  const [end, setEnd] = useState(currentMonth())
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [accName, setAccName] = useState('')
  const [accKind, setAccKind] = useState<AccountKind>('bank')
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalDate, setGoalDate] = useState('')
  const [goalStart, setGoalStart] = useState('')

  if (!settings) return null
  const country = settings.country
  const money = (c: number) => formatMoney(c, country)
  const now = currentMonth()
  const months = monthRange(addMonths(end, -11), end)
  const wealth = wealthByMonth(accounts, balances, months)
  const completeCount = wealth.filter((w) => w.complete).length

  function run(fn: () => Promise<void>) {
    setError(null)
    fn().catch((e) => setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.'))
  }

  /** Gibt `false` zurück, wenn nichts gespeichert wird (unverändert oder ungültig); dann zeigt das Feld wieder den alten Wert. */
  function saveBalance(a: Account, month: string, raw: string): boolean | void {
    const current = balances.find((b) => b.accountId === a.id && b.month === month)
    const trimmed = raw.trim()
    if (trimmed === '') {
      if (!current) return false
      return void run(() => ops.setBalance(a, month, null))
    }
    const cents = parseAmount(trimmed)
    if (cents === null) {
      setError(`«${raw}» ist kein gültiger Betrag.`)
      return false
    }
    if (
      current &&
      enteredBalance(a.kind, current.amountCents) ===
        (a.kind === 'schuld' ? Math.abs(cents) : cents)
    )
      return false
    run(() => ops.setBalance(a, month, cents))
  }

  const visibleGoals = goals.filter((g) => showArchived || !g.archived)

  return (
    <section className="max-w-4xl space-y-8 xl:max-w-6xl">
      <h1 className="text-2xl font-semibold">Konten &amp; Sparziele</h1>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Konten</h2>
        {accounts.length === 0 && (
          <div className="space-y-2 rounded-md border border-border bg-bg p-3 text-sm">
            <p>
              Noch keine Konten. Du kannst mit diesen Vorschlägen starten und sie danach anpassen:
            </p>
            <p className="text-muted">{SUGGESTED_ACCOUNTS.join(', ')}</p>
            <button
              className={buttonClass}
              onClick={() =>
                run(() =>
                  ops.addAccounts(
                    SUGGESTED_ACCOUNTS.map((name, i) => ({ name, kind: SUGGESTION_KINDS[i] })),
                  ),
                )
              }
            >
              Vorschläge übernehmen
            </button>
          </div>
        )}
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Name Konto ${a.name}`}
                className={`${inputClass} max-w-56`}
                defaultValue={a.name}
                key={a.name}
                onBlur={(e) =>
                  e.target.value.trim() !== a.name &&
                  run(() => ops.updateAccount(a, { name: e.target.value }))
                }
              />
              <select
                aria-label={`Art ${a.name}`}
                className="rounded-md border border-control bg-surface px-2 py-2"
                value={a.kind}
                onChange={(e) =>
                  run(() => ops.updateAccount(a, { kind: e.target.value as AccountKind }))
                }
              >
                {Object.entries(KIND_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={a.include}
                  onChange={(e) => run(() => ops.updateAccount(a, { include: e.target.checked }))}
                />
                im Gesamtvermögen
              </label>
              <button
                className="text-sm text-red-600 underline dark:text-red-400"
                onClick={() =>
                  window.confirm(`Konto «${a.name}» samt allen Ständen löschen?`) &&
                  run(() => ops.removeAccount(a.id))
                }
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => {
              await ops.addAccount(accName, accKind)
              setAccName('')
            })
          }}
        >
          <input
            aria-label="Neues Konto"
            className={`${inputClass} max-w-56`}
            placeholder="Neues Konto"
            value={accName}
            onChange={(e) => setAccName(e.target.value)}
          />
          <select
            aria-label="Art des neuen Kontos"
            className="rounded-md border border-control bg-surface px-2 py-2"
            value={accKind}
            onChange={(e) => setAccKind(e.target.value as AccountKind)}
          >
            {Object.entries(KIND_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button className={buttonClass} type="submit">
            Hinzufügen
          </button>
        </form>
      </div>

      {accounts.length > 0 && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Stände am Monatsende</h2>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-border px-3 py-1"
                aria-label="Frühere Monate"
                onClick={() => setEnd(addMonths(end, -6))}
              >
                ◀
              </button>
              <button
                className="rounded-md border border-border px-3 py-1"
                aria-label="Spätere Monate"
                onClick={() => setEnd(addMonths(end, 6))}
              >
                ▶
              </button>
            </div>
          </div>
          <p className="text-sm text-muted">
            Ein leeres Feld heisst «unbekannt», nicht 0. Schulden trägst du als geschuldeten Betrag
            ein, er wird vom Vermögen abgezogen.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Kontostände pro Monatsende und Gesamtvermögen</caption>
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="sticky left-0 bg-bg px-2 py-2 font-normal">
                    Monat
                  </th>
                  {accounts.map((a) => (
                    <th key={a.id} scope="col" className="px-2 py-2 text-right font-normal">
                      {a.name}
                      {!a.include && <span className="block text-xs">(nicht gezählt)</span>}
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-right font-semibold">
                    Gesamt
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => {
                  const w = wealth[i]
                  return (
                    <tr key={m} className="border-t border-border">
                      <th
                        scope="row"
                        className="sticky left-0 whitespace-nowrap bg-bg px-2 py-1 text-left font-normal"
                      >
                        {monthName(m)}
                      </th>
                      {accounts.map((a) => {
                        const b = balances.find((x) => x.accountId === a.id && x.month === m)
                        return (
                          <td key={a.id} className="px-1 py-1">
                            <DraftInput
                              aria-label={`Stand ${a.name} ${monthName(m)}`}
                              className={`${inputClass} min-w-24 text-right ${a.include ? '' : 'opacity-60'}`}
                              inputMode="decimal"
                              placeholder="–"
                              value={
                                b ? (enteredBalance(a.kind, b.amountCents) / 100).toFixed(2) : ''
                              }
                              onCommit={(text) => saveBalance(a, m, text)}
                            />
                          </td>
                        )
                      })}
                      <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums font-semibold">
                        {w.total === null ? '–' : money(w.total)}
                        {w.total !== null && !w.complete && (
                          <span className="block text-xs font-normal text-warn">unvollständig</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-1 font-medium">Vermögensverlauf</h3>
            {completeCount < 2 ? (
              <p className="text-sm text-muted">
                Für den Verlauf brauchst du mindestens zwei Monate, in denen alle gezählten Konten
                einen Stand haben.
              </p>
            ) : (
              <WealthChart points={wealth} money={money} />
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Sparziele</h2>
        <p className="text-sm text-muted">
          Den Fortschritt erfasst du über Buchungen: Wähle unter «Eingabe» die Art «Sparen» und dann
          das Sparziel. Entnahmen zählen negativ.
        </p>
        <form
          className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            const target = parseAmount(goalTarget)
            const start = goalStart.trim() === '' ? 0 : parseAmount(goalStart)
            if (target === null || start === null) return setError('Bitte gib gültige Beträge ein.')
            run(async () => {
              await ops.addGoal({
                name: goalName,
                targetCents: target,
                targetDate: goalDate || null,
                startCents: start,
              })
              setGoalName('')
              setGoalTarget('')
              setGoalDate('')
              setGoalStart('')
            })
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium">Name</span>
            <input
              className={inputClass}
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              list="goal-suggestions"
            />
            <datalist id="goal-suggestions">
              {SUGGESTED_GOALS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Zielbetrag</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Zieldatum (optional)</span>
            <input
              className={inputClass}
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Anfangsbestand (optional)</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={goalStart}
              onChange={(e) => setGoalStart(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <button className={buttonClass} type="submit">
              Sparziel anlegen
            </button>
          </div>
        </form>

        {goals.some((g) => g.archived) && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Archivierte anzeigen
          </label>
        )}
        {visibleGoals.length === 0 ? (
          <p className="text-sm text-muted">
            Noch keine Sparziele. Vorschläge im Namensfeld: {SUGGESTED_GOALS.join(', ')}.
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                balance={goalBalance(g, txs)}
                country={country}
                now={now}
                run={run}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
