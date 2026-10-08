export interface Zeitstelle {
  zeile: number
  text: string
}
export interface Ausnahme {
  datei: string
  grund: string
}
export function findeZeitstellen(text: string): Zeitstelle[]
export function pruefeZeit(
  dateien: { pfad: string; text: string }[],
  ausnahmen: Ausnahme[],
): string[]
export function pruefeRepo(wurzel: string, ausnahmen: Ausnahme[]): string[]
