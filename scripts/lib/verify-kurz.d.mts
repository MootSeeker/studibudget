export type Status = 'gruen' | 'rot' | 'nicht gelaufen' | 'uebersprungen'
export interface RoterTest {
  datei: string
  name: string
  meldung: string
}
export interface Schrittergebnis {
  status: Status
  tests: RoterTest[]
  ausgabe: string[]
}
export interface Schritt extends Schrittergebnis {
  name: string
}
export interface Zusatz {
  name: string
  status: Status
  befunde: string[]
}
export interface Lauf {
  schritte: Schritt[]
  zusatz: Zusatz[]
}
export interface Zeile {
  datei: string
  zeile: number
  text: string
}
export interface Ausnahme {
  datei: string
  grund: string
}
export interface Plan {
  dateien: string[]
  tests: { datei: string; name: string }[]
}
export const MAX_ZEILEN: number
export function schritteAusVerify(skript: string): string[]
export function planlauf(
  schritte: string[],
  ausfuehren: (name: string) => Promise<Schrittergebnis>,
): Promise<Schritt[]>
export function bericht(lauf: Lauf): string[]
export function exitCode(lauf: Lauf): 0 | 1
export function hinzugefuegteZeilen(diff: string): Zeile[]
export function pruefeLeitplanken(zeilen: Zeile[], ausnahmen: Ausnahme[]): string[]
export function lesePlanBlock(text: string): Plan | null
export function pruefePlan(
  plan: Plan,
  geaendert: string[],
  inhalt: (datei: string) => string | null,
): string[]
export function planpruefung(
  planText: string | undefined,
  geaendert: string[],
  inhalt: (datei: string) => string | null,
): Zusatz
