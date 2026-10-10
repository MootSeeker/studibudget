import { expect, it } from 'vitest'
import type { Category } from './types'
import { editToEntry, parseProposals, proposalToEdit } from './proposals'

function cat(id: string, name: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    name,
    areaId: 'a1',
    type: 'ausgabe',
    fix: false,
    rolloverFrom: null,
    hidden: false,
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...extra,
  } as Category
}

function text(eintraege: unknown[]): string {
  return JSON.stringify({ studibudgetVorschlaege: 1, eintraege })
}

const CATS = [
  cat('k1', 'Essen'),
  cat('k2', 'Kleider', { hidden: true }),
  cat('k3', 'Alt', { deleted: true }),
]
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const E = {
  id: U1,
  date: '2026-10-09',
  amountCents: 1850,
  categoryName: 'Essen',
  note: 'Mittagessen',
}
const FEHLER_KEIN_JSON =
  'Kein Vorschlagstext gefunden: Erwartet wird ein JSON-Objekt mit «studibudgetVorschlaege» und «eintraege».'
const GRUND_BETRAG = 'Der Betrag muss eine ganze Zahl grösser 0 sein (in Rappen).'

it('AK-1: liefert gültigen Eintrag als Vorschlag mit Kategorie-ID', () => {
  expect(parseProposals(text([E]), CATS, new Set())).toEqual({
    ok: true,
    vorschlaege: [
      {
        id: U1,
        date: '2026-10-09',
        amountCents: 1850,
        categoryId: 'k1',
        categoryName: 'Essen',
        note: 'Mittagessen',
      },
    ],
    ungueltig: [],
    schonErfasst: [],
  })
})

it('AK-1: findet das JSON-Objekt auch mit Text und Codeblock darum', () => {
  const r = parseProposals(
    'Hier dein Vorschlag:\n```json\n' + text([E]) + '\n```\nGruss',
    CATS,
    new Set(),
  )
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.vorschlaege.length).toBe(1)
  expect(r.vorschlaege[0].categoryId).toBe('k1')
})

it('AK-1: schreibt die ID klein und akzeptiert den 29. Februar im Schaltjahr', () => {
  const r = parseProposals(
    text([{ ...E, id: U1.toUpperCase(), date: '2028-02-29' }]),
    CATS,
    new Set(),
  )
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.vorschlaege[0].id).toBe(U1)
  expect(r.vorschlaege[0].date).toBe('2028-02-29')
})

it('AK-1: akzeptiert Notiz mit genau 200 Zeichen', () => {
  const ok = parseProposals(text([{ ...E, note: 'x'.repeat(200) }]), CATS, new Set())
  expect(ok.ok && ok.vorschlaege.length).toBe(1)
  const zuLang = parseProposals(text([{ ...E, note: 'x'.repeat(201) }]), CATS, new Set())
  expect(zuLang).toEqual({
    ok: true,
    vorschlaege: [],
    ungueltig: [{ nummer: 1, id: U1, grund: 'Die Notiz ist länger als 200 Zeichen.' }],
    schonErfasst: [],
  })
})

it('AK-1: lehnt fehlende ID, Notiz und Kategorie sowie Nicht-Objekte ab', () => {
  const r = parseProposals(
    text([
      42,
      { ...E, id: 'abc' },
      { ...E, id: U2, note: undefined },
      { ...E, id: '33333333-3333-4333-8333-333333333333', categoryName: '  ' },
    ]),
    CATS,
    new Set(),
  )
  expect(r).toEqual({
    ok: true,
    vorschlaege: [],
    ungueltig: [
      { nummer: 1, id: null, grund: 'Der Eintrag ist kein Objekt.' },
      { nummer: 2, id: null, grund: 'Die ID ist keine UUID.' },
      { nummer: 3, id: U2, grund: 'Die Notiz fehlt.' },
      { nummer: 4, id: '33333333-3333-4333-8333-333333333333', grund: 'Die Kategorie fehlt.' },
    ],
    schonErfasst: [],
  })
})

it('AK-2: lehnt Betrag ab, der nicht ganzzahlig, null oder negativ ist', () => {
  for (const amountCents of [18.5, 0, -100, '1850']) {
    const r = parseProposals(text([{ ...E, amountCents }]), CATS, new Set())
    expect(r).toEqual({
      ok: true,
      vorschlaege: [],
      ungueltig: [{ nummer: 1, id: U1, grund: GRUND_BETRAG }],
      schonErfasst: [],
    })
  }
})

it('AK-2: lehnt ungültiges Datum ab', () => {
  for (const date of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-04-31', '9.10.2026']) {
    const r = parseProposals(text([{ ...E, date }]), CATS, new Set())
    expect(r.ok && r.ungueltig[0].grund).toBe('Das Datum ist ungültig (erwartet JJJJ-MM-TT).')
  }
})

it('AK-2: lehnt unbekannte, ausgeblendete und gelöschte Kategorie ab', () => {
  const grund = (categoryName: string) => {
    const r = parseProposals(text([{ ...E, categoryName }]), CATS, new Set())
    return r.ok && r.ungueltig[0].grund
  }
  expect(grund('Reisen')).toBe('Die Kategorie «Reisen» gibt es nicht.')
  expect(grund('Kleider')).toBe('Die Kategorie «Kleider» ist ausgeblendet.')
  expect(grund('Alt')).toBe('Die Kategorie «Alt» gibt es nicht.')
})

it('AK-2: nennt Nummer und Grund pro Eintrag und liefert die gültigen trotzdem', () => {
  const r = parseProposals(text([E, { ...E, id: U2, amountCents: 0 }]), CATS, new Set())
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.vorschlaege.length).toBe(1)
  expect(r.vorschlaege[0].id).toBe(U1)
  expect(r.ungueltig).toEqual([{ nummer: 2, id: U2, grund: GRUND_BETRAG }])
})

it('AK-3: findet Kategorie trotz Gross- und Kleinschreibung und Leerzeichen', () => {
  const r = parseProposals(text([{ ...E, categoryName: '  eSSEN ' }]), CATS, new Set())
  expect(r.ok && r.vorschlaege[0].categoryId).toBe('k1')
  expect(r.ok && r.vorschlaege[0].categoryName).toBe('Essen')
})

it('AK-3: nimmt bei gleichem Namen die sichtbare Kategorie', () => {
  const cats = [cat('k4', 'Velo', { hidden: true }), cat('k5', 'velo')]
  const r = parseProposals(text([{ ...E, categoryName: 'VELO' }]), cats, new Set())
  expect(r.ok && r.vorschlaege[0].categoryId).toBe('k5')
})

it('AK-4: kennzeichnet bestehende Buchung als schon erfasst', () => {
  const r = parseProposals(text([E]), CATS, new Set([U1]))
  expect(r).toEqual({
    ok: true,
    vorschlaege: [],
    ungueltig: [],
    schonErfasst: [{ nummer: 1, id: U1 }],
  })
})

it('AK-4: kennzeichnet doppelte ID im selben Text als schon erfasst', () => {
  const r = parseProposals(
    text([E, { ...E, id: U1.toUpperCase(), amountCents: 999 }]),
    CATS,
    new Set(),
  )
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.vorschlaege.length).toBe(1)
  expect(r.vorschlaege[0].amountCents).toBe(1850)
  expect(r.schonErfasst).toEqual([{ nummer: 2, id: U1 }])
})

it('AK-5: meldet einen Fehler ohne gültiges JSON', () => {
  for (const input of ['', 'Hallo', '{ kaputt', '} {', '{ "a": 1 }', '[1]', '{nicht json}']) {
    expect(parseProposals(input, CATS, new Set())).toEqual({ ok: false, fehler: FEHLER_KEIN_JSON })
  }
})

it('AK-5: meldet einen Fehler bei falscher Version', () => {
  const fehler =
    'Unbekannte Version des Vorschlagsformats: Erwartet wird «studibudgetVorschlaege»: 1.'
  expect(
    parseProposals(JSON.stringify({ studibudgetVorschlaege: 2, eintraege: [E] }), CATS, new Set()),
  ).toEqual({ ok: false, fehler })
  expect(
    parseProposals(
      JSON.stringify({ studibudgetVorschlaege: '1', eintraege: [E] }),
      CATS,
      new Set(),
    ),
  ).toEqual({ ok: false, fehler })
})

it('AK-5: meldet einen Fehler ohne Liste der Einträge', () => {
  const fehler = 'Die Liste «eintraege» fehlt.'
  expect(parseProposals(JSON.stringify({ studibudgetVorschlaege: 1 }), CATS, new Set())).toEqual({
    ok: false,
    fehler,
  })
  expect(
    parseProposals(JSON.stringify({ studibudgetVorschlaege: 1, eintraege: {} }), CATS, new Set()),
  ).toEqual({ ok: false, fehler })
})

it('AK-2: proposalToEdit zeigt den Betrag mit zwei Nachkommastellen', () => {
  const p = {
    id: U1,
    date: '2026-10-09',
    amountCents: 1850,
    categoryId: 'k1',
    categoryName: 'Essen',
    note: 'Mittagessen',
  }
  expect(proposalToEdit(p)).toEqual({
    date: '2026-10-09',
    amount: '18.50',
    categoryId: 'k1',
    note: 'Mittagessen',
  })
  expect(proposalToEdit({ ...p, amountCents: 5 }).amount).toBe('0.05')
})

it('AK-3: editToEntry übernimmt geänderte Werte und die id', () => {
  expect(
    editToEntry(
      U1,
      { date: '2026-10-08', amount: '20.00', categoryId: 'k1', note: 'Znacht' },
      CATS,
    ),
  ).toMatchObject({
    ok: true,
    draft: {
      id: U1,
      deleted: false,
      date: '2026-10-08',
      categoryId: 'k1',
      amountCents: 2000,
      myAmountCents: 2000,
      note: 'Znacht',
    },
  })
})

it('AK-3: editToEntry meldet ungültige Werte', () => {
  const base = { date: '2026-10-08', amount: '20.00', categoryId: 'k1', note: '' }
  expect(editToEntry(U1, { ...base, amount: 'abc' }, CATS)).toEqual({
    ok: false,
    error: 'Bitte gib einen gültigen Betrag ein.',
  })
  expect(editToEntry(U1, { ...base, categoryId: 'k3' }, CATS)).toEqual({
    ok: false,
    error: 'Bitte wähle eine Kategorie.',
  })
})
