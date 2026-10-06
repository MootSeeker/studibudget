import { describe, expect, it } from 'vitest'
import { buildBank, type BankInput } from './bank'

const empty: BankInput = { holder: '', street: '', zip: '', town: '', country: 'CH', iban: '' }
const full: BankInput = {
  holder: 'Anna Muster',
  street: 'Seestrasse 12',
  zip: '8000',
  town: 'Zürich',
  country: 'CH',
  iban: 'ch93 0076 2011 6238 5295 7',
}

describe('buildBank (Issue #104)', () => {
  it('AK-4: alles leer ergibt «keine Bankverbindung» (die Angabe wird entfernt)', () => {
    expect(buildBank(empty)).toEqual({ ok: true, bank: undefined })
    expect(buildBank({ ...empty, holder: '   ', town: '\t' })).toEqual({
      ok: true,
      bank: undefined,
    })
  })

  it('AK-1: alle Felder sind freiwillig, auch ein einzelnes Feld genügt', () => {
    expect(buildBank({ ...empty, holder: 'Anna' })).toEqual({
      ok: true,
      bank: { holder: 'Anna', street: '', zip: '', town: '', country: 'CH', iban: '' },
    })
  })

  it('AK-3: bereinigt die Angaben und speichert die IBAN normalisiert', () => {
    expect(buildBank({ ...full, holder: '  Anna   Muster ' })).toEqual({
      ok: true,
      bank: {
        holder: 'Anna Muster',
        street: 'Seestrasse 12',
        zip: '8000',
        town: 'Zürich',
        country: 'CH',
        iban: 'CH9300762011623852957',
      },
    })
  })

  it('AK-2: eine ungültige IBAN wird abgelehnt und nennt den Grund', () => {
    for (const iban of ['CH9400762011623852957', 'DE89370400440532013000', 'CH93', 'abc']) {
      const r = buildBank({ ...full, iban })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/IBAN/)
    }
  })

  it('akzeptiert Liechtenstein als Land und eine LI-IBAN', () => {
    const r = buildBank({
      ...full,
      country: 'LI',
      zip: '9490',
      town: 'Vaduz',
      iban: 'LI21 0881 0000 2324 013A A',
    })
    expect(r).toMatchObject({ ok: true, bank: { country: 'LI', iban: 'LI21088100002324013AA' } })
  })

  it.each([
    ['Name', { holder: 'x'.repeat(71) }],
    ['Strasse', { street: 'x'.repeat(71) }],
    ['PLZ', { zip: 'x'.repeat(17) }],
    ['Ort', { town: 'x'.repeat(36) }],
  ])('lehnt zu lange Angaben ab (%s)', (label, extra) => {
    const r = buildBank({ ...full, ...extra })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(new RegExp(label, 'i'))
  })

  it('nimmt Angaben genau an der Grenze an', () => {
    const r = buildBank({
      ...full,
      holder: 'x'.repeat(70),
      street: 'y'.repeat(70),
      zip: '1'.repeat(16),
      town: 'z'.repeat(35),
    })
    expect(r.ok).toBe(true)
  })
})
