import { useState } from 'react'
import { buttonClass, inputClass } from '../auth/ui'
import { editToEntry, proposalToEdit, type Proposal, type ProposalEdit } from '../domain/proposals'
import type { EntryDraft } from '../domain/entry'
import type { Category } from '../domain/types'

/** Liste der offenen KI-Vorschläge: jeder Eintrag ist vor dem Buchen bearbeitbar. */
export function ProposalList({
  proposals,
  categories,
  onConfirm,
  onDiscard,
}: {
  proposals: Proposal[]
  categories: Category[]
  onConfirm(entry: EntryDraft): Promise<void>
  onDiscard(id: string): void
}) {
  if (proposals.length === 0) return null
  return (
    <ul aria-label="Vorschläge" className="space-y-3">
      {proposals.map((p, i) => (
        <ProposalItem
          key={p.id}
          p={p}
          i={i}
          categories={categories}
          onConfirm={onConfirm}
          onDiscard={onDiscard}
        />
      ))}
    </ul>
  )
}

function ProposalItem({
  p,
  i,
  categories,
  onConfirm,
  onDiscard,
}: {
  p: Proposal
  i: number
  categories: Category[]
  onConfirm(entry: EntryDraft): Promise<void>
  onDiscard(id: string): void
}) {
  const [edit, setEdit] = useState<ProposalEdit>(() => proposalToEdit(p))
  const [error, setError] = useState<string | null>(null)
  const sichtbar = categories.filter((c) => !c.deleted && !c.hidden)

  async function buchen() {
    const r = editToEntry(p.id, edit, categories)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setError(null)
    await onConfirm(r.draft)
  }

  return (
    <li aria-label={`Vorschlag ${i + 1}`} className="space-y-2 rounded-md border border-border p-3">
      <label className="block text-sm">
        Datum
        <input
          type="date"
          className={inputClass}
          value={edit.date}
          onChange={(e) => setEdit({ ...edit, date: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Betrag
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          value={edit.amount}
          onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Kategorie
        <select
          className={inputClass}
          value={edit.categoryId}
          onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}
        >
          {sichtbar.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Notiz
        <input
          type="text"
          className={inputClass}
          value={edit.note}
          onChange={(e) => setEdit({ ...edit, note: e.target.value })}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className={buttonClass} onClick={() => void buchen()}>
          Buchen
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1"
          onClick={() => onDiscard(p.id)}
        >
          Verwerfen
        </button>
      </div>
    </li>
  )
}
