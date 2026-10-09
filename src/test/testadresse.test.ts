import { describe, expect, it } from 'vitest'
import { ADRESSE_LAENGE, adresseAus, neueAdresse } from '../../e2e/support/adresse'

// Issue #126: Die Seite «Konto» zeigt die Adresse des Testkontos; ihre Länge darf den Bildtest nicht verändern.
describe('Testadressen für E2E-Konten (Issue #126)', () => {
  it('AK-1 (#126): jede Testadresse hat genau 34 Zeichen', { tags: ['regression'] }, () => {
    expect(ADRESSE_LAENGE).toBe(34)
    expect(adresseAus({ zeit: 0, pid: 1, zaehler: 1 })).toBe('lena-000000000000010001@test.local')
    expect(adresseAus({ zeit: 1_791_219_180_901, pid: 6518, zaehler: 1 })).toBe(
      'lena-918090100065180001@test.local',
    )
    expect(adresseAus({ zeit: 9_999_999, pid: 9_999_999, zaehler: 9_999 })).toBe(
      'lena-999999999999999999@test.local',
    )
    // Die Zeit zählt nur mit ihren letzten 7 Stellen: Sie läuft über, statt die Adresse zu verlängern.
    expect(adresseAus({ zeit: 10_000_000, pid: 1, zaehler: 1 })).toBe(
      'lena-000000000000010001@test.local',
    )
    for (let i = 0; i < 20; i++) {
      const adresse = neueAdresse()
      expect(adresse).toHaveLength(ADRESSE_LAENGE)
      expect(adresse).toMatch(/^lena-\d{18}@test\.local$/)
    }
  })

  it('AK-1 (#126): Testadressen sind eindeutig über Worker und Wiederholungen', () => {
    const basis = { zeit: 5, pid: 101, zaehler: 1 }
    // Parallele Worker: verschiedene Prozess-IDs
    expect(adresseAus(basis)).not.toBe(adresseAus({ ...basis, pid: 102 }))
    // Wiederholung im selben Worker: nächste Nummer
    expect(adresseAus(basis)).not.toBe(adresseAus({ ...basis, zaehler: 2 }))
    // Späterer Prozess mit derselben Prozess-ID: andere Zeit
    expect(adresseAus(basis)).not.toBe(adresseAus({ ...basis, zeit: 6 }))
    // Feste Breite pro Teil: Ziffern wandern nicht von einem Teil in den nächsten
    expect(adresseAus({ zeit: 0, pid: 11, zaehler: 1 })).not.toBe(
      adresseAus({ zeit: 0, pid: 1, zaehler: 11 }),
    )
    const adressen = Array.from({ length: 20 }, () => neueAdresse())
    expect(new Set(adressen).size).toBe(20)
  })

  it('AK-1 (#126): zu grosse Teile brechen ab, statt die Länge zu ändern', () => {
    expect(() => adresseAus({ zeit: 0, pid: 10_000_000, zaehler: 1 })).toThrow(/Prozess-ID/)
    expect(() => adresseAus({ zeit: 0, pid: -1, zaehler: 1 })).toThrow(/Prozess-ID/)
    expect(() => adresseAus({ zeit: 0, pid: 1, zaehler: 10_000 })).toThrow(/Zähler/)
  })
})
