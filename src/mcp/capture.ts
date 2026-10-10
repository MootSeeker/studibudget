/** Werkzeug «ausgabe_vorschlagen» des MCP-Servers (#158): prüfen wie die App, auf dem Gerät verschlüsseln, einliefern. */
import { parseProposals, PROPOSAL_FORMAT_VERSION } from '../domain/proposals'
import type { Category } from '../domain/types'
import { sealForInbox } from '../crypto/inbox'
import type { ConnectorConfig } from './config'
import type { SendResult } from './inboxClient'

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError: boolean
}

export interface CaptureDeps {
  newId(): string
  send(proposalId: string, ciphertext: string): Promise<SendResult>
  warte(ms: number): Promise<void>
}

export const MAX_VERSUCHE = 3
export const WARTEZEIT_MS = 1000

function fehlerErgebnis(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

export function kategorienAlsListe(namen: readonly string[]): Category[] {
  return namen.map((name, i) => ({
    id: name,
    updatedAt: '',
    deleted: false,
    areaId: '',
    name,
    type: 'ausgabe',
    fix: false,
    rolloverFrom: null,
    hidden: false,
    order: i,
  }))
}

export async function erfasse(
  args: unknown,
  config: ConnectorConfig,
  deps: CaptureDeps,
): Promise<ToolResult> {
  const a = (
    typeof args === 'object' && args !== null && !Array.isArray(args) ? args : {}
  ) as Record<string, unknown>
  const id = deps.newId().toLowerCase()
  const text = JSON.stringify({
    studibudgetVorschlaege: PROPOSAL_FORMAT_VERSION,
    eintraege: [
      {
        id,
        date: a.date,
        amountCents: a.amountCents,
        categoryName: a.categoryName,
        note: a.note,
      },
    ],
  })
  const r = parseProposals(text, kategorienAlsListe(config.kategorien), new Set())
  if (r.ok === false) return fehlerErgebnis('Nicht eingeliefert: ' + r.fehler)
  if (r.ungueltig.length > 0) return fehlerErgebnis('Nicht eingeliefert: ' + r.ungueltig[0].grund)
  if (r.vorschlaege.length !== 1) {
    return fehlerErgebnis('Nicht eingeliefert: Der Eintrag ist ungültig.')
  }
  const p = r.vorschlaege[0]
  const klartext = JSON.stringify({
    studibudgetVorschlaege: PROPOSAL_FORMAT_VERSION,
    eintraege: [
      {
        id: p.id,
        date: p.date,
        amountCents: p.amountCents,
        categoryName: p.categoryName,
        note: p.note,
      },
    ],
  })
  const ct = await sealForInbox(config.publicKey, p.id, klartext)
  for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
    const ergebnis = await deps.send(p.id, ct)
    if (ergebnis === 'ok') {
      return {
        content: [
          {
            type: 'text',
            text: `Vorschlag ${p.id} eingeliefert. Er erscheint in StudiBudget unter «Eingabe» und wird erst gebucht, wenn du ihn bestätigst.`,
          },
        ],
        isError: false,
      }
    }
    if (ergebnis === 'widerrufen') {
      return fehlerErgebnis(
        'Die Verbindung zu StudiBudget gilt nicht mehr, sie wurde widerrufen. Richte in StudiBudget unter Einstellungen, KI-Posteingang eine neue Verbindung ein.',
      )
    }
    if (ergebnis !== 'netzfehler') {
      return fehlerErgebnis('Nicht eingeliefert: ' + ergebnis.fehler)
    }
    if (versuch < MAX_VERSUCHE) await deps.warte(WARTEZEIT_MS)
  }
  return fehlerErgebnis(
    'StudiBudget ist nicht erreichbar. Der Vorschlag wurde nicht eingeliefert. Versuche es später noch einmal.',
  )
}
