import { useSearchParams } from 'react-router'

export interface SubNavItem {
  id: string
  label: string
}

/**
 * Unterseiten als Reiter. Die Auswahl steht in der Adresse (`?<param>=<id>`): Zurück-Knopf, Lesezeichen und Links
 * von anderen Seiten funktionieren. Unbekannte oder fehlende Werte gelten als erster Reiter.
 */
export function useSubNav(param: string, items: SubNavItem[]): string {
  const [params] = useSearchParams()
  const wanted = params.get(param)
  return items.find((i) => i.id === wanted)?.id ?? items[0].id
}
