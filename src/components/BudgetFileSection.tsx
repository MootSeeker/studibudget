import { useState } from 'react'
import { buttonClass } from '../auth/ui'
import { createBudgetOps } from '../data/budgetOps'
import { db } from '../data/db'
import {
  MAX_BUDGET_FILE_BYTES,
  exportBudgetFile,
  parseBudgetFile,
  planBudgetImport,
} from '../domain/budgetFile'
import type { Budget, Category } from '../domain/types'

const ops = createBudgetOps(db)
const secondaryClass = 'rounded-md border border-control px-4 py-2 min-h-11'

/** Budget sichern, aus einer Datei übernehmen oder von vorn beginnen (Issue #30). */
export function BudgetFileSection({
  categories,
  budgets,
}: {
  categories: Category[]
  budgets: Budget[]
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const count = budgets.filter((b) => !b.deleted).length

  function exportFile() {
    setError(null)
    const now = new Date()
    const json = JSON.stringify(exportBudgetFile(categories, budgets, now), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `studibudget-budget-${now.toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Das Budget wurde heruntergeladen.')
  }

  async function importFile(file: File | undefined) {
    setMessage(null)
    setError(null)
    if (!file) return
    if (file.size > MAX_BUDGET_FILE_BYTES) return setError('Die Datei ist zu gross.')
    const parsed = parseBudgetFile(await file.text())
    if (!parsed.ok) return setError(parsed.error)
    const plan = planBudgetImport(parsed.items, categories)
    if (plan.matched.length === 0)
      return setError(
        'Keine Kategorie der Datei passt zu deinen Kategorien. Es wurde nichts geändert.',
      )
    if (
      !window.confirm(
        `Dein bisheriges Budget (${count} Werte) wird durch ${plan.matched.length} Werte aus der Datei ersetzt. Fortfahren?`,
      )
    )
      return
    try {
      await ops.replaceWith(plan)
      setMessage(
        plan.skipped.length === 0
          ? `${plan.matched.length} Budgetwerte übernommen.`
          : `${plan.matched.length} Budgetwerte übernommen. Nicht übernommen (Kategorie fehlt): ${plan.skipped.join(', ')}.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Der Import hat nicht geklappt.')
    }
  }

  async function reset() {
    setMessage(null)
    setError(null)
    if (
      !window.confirm(
        'Alle Budgetwerte werden gelöscht. Buchungen und Kategorien bleiben erhalten. Das lässt sich nicht rückgängig machen. Fortfahren?',
      )
    )
      return
    try {
      const n = await ops.reset()
      setMessage(`${n} Budgetwerte gelöscht.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das Zurücksetzen hat nicht geklappt.')
    }
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
      aria-label="Budget sichern und zurücksetzen"
    >
      <h2 className="text-lg font-semibold">Budget sichern und zurücksetzen</h2>
      <p className="text-sm text-muted">
        Exportiere dein Budget als Datei, übernimm es aus einer Datei oder beginne von vorn.
        Buchungen bleiben dabei unberührt. Beim Import zählen Name und Art der Kategorie.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} onClick={exportFile} disabled={count === 0}>
          Budget exportieren
        </button>
        <label className={`${secondaryClass} cursor-pointer`}>
          Budget importieren
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Budget-Datei wählen"
            onChange={(e) => {
              void importFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          className={secondaryClass}
          onClick={() => void reset()}
          disabled={count === 0}
        >
          Budget zurücksetzen
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-ok">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  )
}
