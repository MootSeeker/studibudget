/** Vorschlagsformat des KI-Konnektors, Version 1 (Issue #155). Rein, ohne Browser-Abhängigkeit: auch aus Node nutzbar (#158). */
import type { Category } from './types'

export const PROPOSAL_FORMAT_VERSION = 1
export const PROPOSAL_NOTE_MAX = 200

export interface Proposal {
  id: string // UUID, kleingeschrieben
  date: string // YYYY-MM-DD
  amountCents: number // ganze Zahl > 0
  categoryId: string // ID der gefundenen Kategorie
  categoryName: string // Name der gefundenen Kategorie, wie in der App gespeichert
  note: string
}
export interface InvalidProposal {
  nummer: number
  id: string | null
  grund: string
}
export interface DuplicateProposal {
  nummer: number
  id: string
}
export type ProposalResult =
  | { ok: false; fehler: string }
  | {
      ok: true
      vorschlaege: Proposal[]
      ungueltig: InvalidProposal[]
      schonErfasst: DuplicateProposal[]
    }

const FEHLER_KEIN_JSON =
  'Kein Vorschlagstext gefunden: Erwartet wird ein JSON-Objekt mit «studibudgetVorschlaege» und «eintraege».'
const FEHLER_VERSION =
  'Unbekannte Version des Vorschlagsformats: Erwartet wird «studibudgetVorschlaege»: 1.'
const FEHLER_LISTE = 'Die Liste «eintraege» fehlt.'
const GRUND_KEIN_OBJEKT = 'Der Eintrag ist kein Objekt.'
const GRUND_ID = 'Die ID ist keine UUID.'
const GRUND_DATUM = 'Das Datum ist ungültig (erwartet JJJJ-MM-TT).'
const GRUND_BETRAG = 'Der Betrag muss eine ganze Zahl grösser 0 sein (in Rappen).'
const GRUND_KATEGORIE_FEHLT = 'Die Kategorie fehlt.'
const GRUND_NOTIZ_FEHLT = 'Die Notiz fehlt.'
const GRUND_NOTIZ_LANG = 'Die Notiz ist länger als 200 Zeichen.'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const j = Number(value.slice(0, 4))
  const m = Number(value.slice(5, 7))
  const t = Number(value.slice(8, 10))
  if (m < 1 || m > 12) return false
  let tage: number
  if (m === 2) tage = (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0 ? 29 : 28
  else if (m === 4 || m === 6 || m === 9 || m === 11) tage = 30
  else tage = 31
  return t >= 1 && t <= tage
}

function istObjekt(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseProposals(
  text: string,
  categories: readonly Category[],
  existingTransactionIds: ReadonlySet<string>,
): ProposalResult {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end < start) return { ok: false, fehler: FEHLER_KEIN_JSON }
  let obj: unknown
  try {
    obj = JSON.parse(text.slice(start, end + 1))
  } catch {
    return { ok: false, fehler: FEHLER_KEIN_JSON }
  }
  if (!istObjekt(obj) || !('studibudgetVorschlaege' in obj))
    return { ok: false, fehler: FEHLER_KEIN_JSON }
  if (obj.studibudgetVorschlaege !== PROPOSAL_FORMAT_VERSION)
    return { ok: false, fehler: FEHLER_VERSION }
  if (!Array.isArray(obj.eintraege)) return { ok: false, fehler: FEHLER_LISTE }

  const vorschlaege: Proposal[] = []
  const ungueltig: InvalidProposal[] = []
  const schonErfasst: DuplicateProposal[] = []
  const seen = new Set<string>()

  obj.eintraege.forEach((eintrag: unknown, i: number) => {
    const nummer = i + 1
    if (!istObjekt(eintrag)) {
      ungueltig.push({ nummer, id: null, grund: GRUND_KEIN_OBJEKT })
      return
    }
    const rohId = eintrag.id
    if (typeof rohId !== 'string' || !UUID_RE.test(rohId)) {
      ungueltig.push({ nummer, id: null, grund: GRUND_ID })
      return
    }
    const id = rohId.toLowerCase()
    if (existingTransactionIds.has(id) || seen.has(id)) {
      schonErfasst.push({ nummer, id })
      return
    }
    seen.add(id)

    const date = eintrag.date
    if (typeof date !== 'string' || !isValidIsoDate(date)) {
      ungueltig.push({ nummer, id, grund: GRUND_DATUM })
      return
    }
    const amountCents = eintrag.amountCents
    if (typeof amountCents !== 'number' || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      ungueltig.push({ nummer, id, grund: GRUND_BETRAG })
      return
    }
    const categoryName = eintrag.categoryName
    if (typeof categoryName !== 'string' || categoryName.trim() === '') {
      ungueltig.push({ nummer, id, grund: GRUND_KATEGORIE_FEHLT })
      return
    }
    const name = categoryName.trim()
    const key = name.toLowerCase()
    const treffer = categories.filter((c) => !c.deleted && c.name.trim().toLowerCase() === key)
    const kat = treffer.find((c) => !c.hidden)
    if (!kat) {
      const grund =
        treffer.length > 0
          ? `Die Kategorie «${name}» ist ausgeblendet.`
          : `Die Kategorie «${name}» gibt es nicht.`
      ungueltig.push({ nummer, id, grund })
      return
    }
    const note = eintrag.note
    if (typeof note !== 'string') {
      ungueltig.push({ nummer, id, grund: GRUND_NOTIZ_FEHLT })
      return
    }
    if (Array.from(note).length > PROPOSAL_NOTE_MAX) {
      ungueltig.push({ nummer, id, grund: GRUND_NOTIZ_LANG })
      return
    }
    vorschlaege.push({ id, date, amountCents, categoryId: kat.id, categoryName: kat.name, note })
  })

  return { ok: true, vorschlaege, ungueltig, schonErfasst }
}
