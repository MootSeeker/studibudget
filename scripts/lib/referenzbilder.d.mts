export interface Lauf {
  databaseId: number
  headSha: string
  conclusion: string | null
  createdAt?: string
}
export function waehleLauf(runs: Lauf[], headSha: string): { run: Lauf; veraltet: boolean } | null
export function ersetzeOrdner(quelle: string, ziel: string): void
