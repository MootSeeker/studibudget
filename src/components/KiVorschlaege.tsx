import { useState } from 'react'
import { buttonClass, inputClass } from '../auth/ui'
import { db } from '../data/db'
import { store } from '../data/store'
import type { EntryDraft } from '../domain/entry'
import {
  parseProposals,
  type DuplicateProposal,
  type InvalidProposal,
  type Proposal,
} from '../domain/proposals'
import type { Category } from '../domain/types'
import { ProposalList } from './ProposalList'

export const KI_HINWEIS_KEY = 'studibudget.kiHinweisBestaetigt'

/** Einfügen von KI-Vorschlägen: Hinweis, Prüfung des Textes, Buchen einzelner Einträge. */
export function KiVorschlaege({ categories }: { categories: Category[] }) {
  const [bestaetigt, setBestaetigt] = useState(() => localStorage.getItem(KI_HINWEIS_KEY) === '1')
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [offen, setOffen] = useState<Proposal[]>([])
  const [ungueltig, setUngueltig] = useState<InvalidProposal[]>([])
  const [schonErfasst, setSchonErfasst] = useState<DuplicateProposal[]>([])
  const [gebucht, setGebucht] = useState(0)

  if (!bestaetigt) {
    return (
      <div role="note" className="space-y-3 text-sm">
        <p>
          Was du einer KI wie Claude oder ChatGPT gibst, geht an deren Anbieter. Diese Angaben sind
          nicht von der Verschlüsselung von StudiBudget geschützt.
        </p>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            localStorage.setItem(KI_HINWEIS_KEY, '1')
            setBestaetigt(true)
          }}
        >
          Verstanden
        </button>
      </div>
    )
  }

  async function pruefen() {
    const ids = new Set((await db.transactions.toCollection().primaryKeys()) as string[])
    const r = parseProposals(text, categories, ids)
    setGebucht(0)
    if (!r.ok) {
      setFehler(r.fehler)
      setOffen([])
      setUngueltig([])
      setSchonErfasst([])
      return
    }
    setFehler(null)
    setOffen(r.vorschlaege)
    setUngueltig(r.ungueltig)
    setSchonErfasst(r.schonErfasst)
  }

  async function buchen(entry: EntryDraft) {
    const vorhanden = await db.transactions.get(entry.id)
    if (vorhanden) {
      setSchonErfasst((s) => [...s, { nummer: 0, id: entry.id }])
      setOffen((o) => o.filter((p) => p.id !== entry.id))
      return
    }
    await store.put('transactions', entry)
    setOffen((o) => o.filter((p) => p.id !== entry.id))
    setGebucht((n) => n + 1)
  }

  function verwerfen(id: string) {
    setOffen((o) => o.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Vorschlagstext
        <textarea
          rows={6}
          className={inputClass}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button type="button" className={buttonClass} onClick={() => void pruefen()}>
        Vorschläge prüfen
      </button>

      {fehler && <p role="alert">{fehler}</p>}
      {gebucht > 0 && <p role="status">{gebucht} gebucht</p>}
      {ungueltig.length > 0 && (
        <>
          <h3>Nicht übernommen</h3>
          <ul>
            {ungueltig.map((u) => (
              <li key={u.nummer}>{`Eintrag ${u.nummer}: ${u.grund}`}</li>
            ))}
          </ul>
        </>
      )}
      {schonErfasst.length > 0 && (
        <>
          <h3>Schon erfasst</h3>
          <ul>
            {schonErfasst.map((d, i) => (
              <li key={`${d.nummer}-${d.id}-${i}`}>
                {d.nummer > 0 ? `Eintrag ${d.nummer}: schon erfasst` : `${d.id}: schon erfasst`}
              </li>
            ))}
          </ul>
        </>
      )}
      <ProposalList
        proposals={offen}
        categories={categories}
        onConfirm={buchen}
        onDiscard={verwerfen}
      />
    </div>
  )
}
