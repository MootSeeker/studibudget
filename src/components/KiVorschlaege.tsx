import { useRef, useState } from 'react'
import { buttonClass, inputClass } from '../auth/ui'
import { openInboxEntry, unwrapInboxPrivateKey } from '../crypto/inbox'
import { db } from '../data/db'
import { store } from '../data/store'
import type { EntryDraft } from '../domain/entry'
import { checkInboxPayload, planInbox } from '../domain/inbox'
import {
  parseProposals,
  type DuplicateProposal,
  type InvalidProposal,
  type Proposal,
} from '../domain/proposals'
import type { Category } from '../domain/types'
import type { InboxApi, InboxRow } from '../sync/inbox'
import { ProposalList } from './ProposalList'

export const KI_HINWEIS_KEY = 'studibudget.kiHinweisBestaetigt'
const UNLESBAR = 'Ein Eintrag war nicht lesbar und wurde verworfen.'

/** Einfügen von KI-Vorschlägen: Hinweis, Prüfung des Textes, Buchen einzelner Einträge. */
export function KiVorschlaege({
  categories,
  inbox = null,
}: {
  categories: Category[]
  inbox?: InboxApi | null
}) {
  const [bestaetigt, setBestaetigt] = useState(() => localStorage.getItem(KI_HINWEIS_KEY) === '1')
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [offen, setOffen] = useState<Proposal[]>([])
  const [ungueltig, setUngueltig] = useState<InvalidProposal[]>([])
  const [schonErfasst, setSchonErfasst] = useState<DuplicateProposal[]>([])
  const [gebucht, setGebucht] = useState(0)
  const [posteingangFehler, setPosteingangFehler] = useState<string | null>(null)
  const [posteingangVerworfen, setPosteingangVerworfen] = useState<string[]>([])
  const ausPosteingang = useRef(new Set<string>())

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
    const behalten = (o: Proposal[]) => o.filter((p) => ausPosteingang.current.has(p.id))
    if (!r.ok) {
      setFehler(r.fehler)
      setOffen(behalten)
      setUngueltig([])
      setSchonErfasst([])
      return
    }
    setFehler(null)
    setOffen((o) => [
      ...behalten(o),
      ...r.vorschlaege.filter((v) => !ausPosteingang.current.has(v.id)),
    ])
    setUngueltig(r.ungueltig)
    setSchonErfasst(r.schonErfasst)
  }

  async function abrufen() {
    if (!inbox) return
    setPosteingangFehler(null)
    const entry = await db.keystore.get('dek')
    if (!entry) {
      setPosteingangFehler('Der Datenschlüssel fehlt. Bitte melde dich neu an.')
      return
    }
    let rows: InboxRow[]
    try {
      rows = await inbox.list()
    } catch {
      setPosteingangFehler('Der Posteingang konnte nicht abgerufen werden.')
      return
    }
    const connections = await db.inboxConnections.toArray()
    const plan = planInbox(rows, connections)
    const ids = new Set((await db.transactions.toCollection().primaryKeys()) as string[])
    const weg = plan.verwerfen.map((r) => r.proposalId)
    const verworfen: string[] = []
    const neu: Proposal[] = []
    for (const row of plan.lesen) {
      const c = connections.find((x) => x.id === row.connectionId)!
      let inhalt: string
      try {
        const key = await unwrapInboxPrivateKey(entry.key, c.id, c.wrappedPrivateKey)
        inhalt = await openInboxEntry(key, c.publicKey, row.proposalId, row.ciphertext)
      } catch {
        weg.push(row.proposalId)
        verworfen.push(UNLESBAR)
        continue
      }
      const r = checkInboxPayload(inhalt, row.proposalId, categories, ids)
      if (r.art === 'vorschlag') {
        neu.push(r.vorschlag)
      } else {
        weg.push(row.proposalId)
        if (r.art === 'ungueltig') verworfen.push(r.grund)
      }
    }
    for (const p of neu) ausPosteingang.current.add(p.id)
    setOffen((o) => [...o, ...neu.filter((p) => !o.some((x) => x.id === p.id))])
    setPosteingangVerworfen(verworfen)
    if (weg.length > 0) {
      try {
        await inbox.remove(weg)
      } catch {
        setPosteingangFehler('Einträge im Posteingang konnten nicht gelöscht werden.')
      }
    }
  }

  async function entferneAusPosteingang(id: string) {
    if (!inbox || !ausPosteingang.current.has(id)) return
    ausPosteingang.current.delete(id)
    try {
      await inbox.remove([id])
    } catch {
      setPosteingangFehler(
        'Der Eintrag konnte im Posteingang nicht gelöscht werden. Er erscheint beim nächsten Abruf wieder.',
      )
    }
  }

  async function buchen(entry: EntryDraft) {
    const vorhanden = await db.transactions.get(entry.id)
    if (vorhanden) {
      setSchonErfasst((s) => [...s, { nummer: 0, id: entry.id }])
      setOffen((o) => o.filter((p) => p.id !== entry.id))
      await entferneAusPosteingang(entry.id)
      return
    }
    await store.put('transactions', entry)
    setOffen((o) => o.filter((p) => p.id !== entry.id))
    setGebucht((n) => n + 1)
    await entferneAusPosteingang(entry.id)
  }

  function verwerfen(id: string) {
    setOffen((o) => o.filter((p) => p.id !== id))
    void entferneAusPosteingang(id)
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
      {inbox && (
        <button type="button" className={buttonClass} onClick={() => void abrufen()}>
          Posteingang abrufen
        </button>
      )}
      {posteingangFehler && <p role="alert">{posteingangFehler}</p>}
      {posteingangVerworfen.length > 0 && (
        <>
          <h3>Aus dem Posteingang verworfen</h3>
          <ul>
            {posteingangVerworfen.map((g, i) => (
              <li key={`${i}-${g}`}>{g}</li>
            ))}
          </ul>
        </>
      )}

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
