/** Posteingang des KI-Konnektors (#157): reine Entscheide, ohne Server und ohne Krypto. */
import { parseProposals, type Proposal } from './proposals'
import type { Category } from './types'

export interface InboxRowRef {
  connectionId: string
  proposalId: string
}
export interface InboxPlan<R> {
  /** Verbindung ist aktiv: entschlüsseln und zeigen. */
  lesen: R[]
  /** Verbindung ist widerrufen (Grabstein): auf dem Server löschen, nicht zeigen. */
  verwerfen: R[]
  /** Verbindung ist auf diesem Gerät noch nicht bekannt (Sync ausstehend): liegen lassen. */
  warten: R[]
}

export function planInbox<R extends InboxRowRef>(
  rows: readonly R[],
  connections: readonly { id: string; deleted: boolean }[],
): InboxPlan<R> {
  const plan: InboxPlan<R> = { lesen: [], verwerfen: [], warten: [] }
  for (const row of rows) {
    const c = connections.find((x) => x.id === row.connectionId)
    if (!c) plan.warten.push(row)
    else if (c.deleted) plan.verwerfen.push(row)
    else plan.lesen.push(row)
  }
  return plan
}

export const GRUND_GENAU_EINER = 'Ein Eintrag im Posteingang muss genau einen Vorschlag enthalten.'
export const GRUND_ID_PASST_NICHT = 'Die ID passt nicht zum Eintrag im Posteingang.'

export type InboxPayloadResult =
  | { art: 'vorschlag'; vorschlag: Proposal }
  | { art: 'schonErfasst' }
  | { art: 'ungueltig'; grund: string }

/** Prüft den entschlüsselten Inhalt einer Posteingangszeile mit dem Vorschlagsformat aus #155. */
export function checkInboxPayload(
  text: string,
  proposalId: string,
  categories: readonly Category[],
  existingTransactionIds: ReadonlySet<string>,
): InboxPayloadResult {
  const r = parseProposals(text, categories, existingTransactionIds)
  if (!r.ok) return { art: 'ungueltig', grund: r.fehler }
  if (r.vorschlaege.length + r.ungueltig.length + r.schonErfasst.length !== 1)
    return { art: 'ungueltig', grund: GRUND_GENAU_EINER }
  if (r.ungueltig.length === 1) return { art: 'ungueltig', grund: r.ungueltig[0].grund }
  const gefunden = r.schonErfasst.length === 1 ? r.schonErfasst[0].id : r.vorschlaege[0].id
  if (gefunden !== proposalId.toLowerCase())
    return { art: 'ungueltig', grund: GRUND_ID_PASST_NICHT }
  if (r.schonErfasst.length === 1) return { art: 'schonErfasst' }
  return { art: 'vorschlag', vorschlag: r.vorschlaege[0] }
}
