// Testadressen für E2E-Konten (Issue #126). Die Seite «Konto» zeigt die Adresse, der Bildtest vergleicht sie:
// Jede Adresse hat deshalb dieselbe Länge, und der variable Teil besteht nur aus Ziffern (gleich breit in der Schrift).
// Keine Imports: Die Datei lässt sich ohne lokales Supabase laden.

/** Länge jeder Testadresse: `lena-` (5 Zeichen) + 18 Ziffern + `@test.local` (11 Zeichen). */
export const ADRESSE_LAENGE = 34

export interface AdressTeile {
  /** Millisekunden; nur die letzten 7 Stellen zählen (Zyklus knapp 3 Stunden). */
  zeit: number
  /** Prozess-ID des Workers, höchstens 7 Stellen: Parallele Worker haben verschiedene IDs. */
  pid: number
  /** Laufende Nummer im Prozess, höchstens 4 Stellen: Wiederholungen im selben Worker. */
  zaehler: number
}

function stellen(wert: number, anzahl: number, name: string): string {
  if (!Number.isInteger(wert) || wert < 0 || wert >= 10 ** anzahl)
    throw new Error(`Testadresse: ${name} ${wert} passt nicht in ${anzahl} Stellen`)
  return String(wert).padStart(anzahl, '0')
}

/** Reine Funktion: Jeder Teil hat eine feste Breite, verschiedene Teile ergeben verschiedene Adressen. */
export function adresseAus(teile: AdressTeile): string {
  const zeit = stellen(teile.zeit % 10 ** 7, 7, 'Zeit')
  const pid = stellen(teile.pid, 7, 'Prozess-ID')
  const zaehler = stellen(teile.zaehler, 4, 'Zähler')
  return `lena-${zeit}${pid}${zaehler}@test.local`
}

let zaehler = 0

/** Neue, eindeutige Adresse für ein Testkonto (auch bei parallelen Workern und Wiederholungen). */
export function neueAdresse(): string {
  zaehler += 1
  return adresseAus({ zeit: Date.now(), pid: process.pid, zaehler })
}
