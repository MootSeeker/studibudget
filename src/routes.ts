import { matchPath } from 'react-router'
import { PAGES } from './pages'

/** Alle Routen der App mit ihrem Seitentitel; der Router und der Dokumenttitel lesen beide diese Liste. */
export const ROUTES: readonly { path: string; title: string }[] = [
  ...PAGES.map((p) => ({ path: p.path, title: p.label })),
  { path: '/ausgleich/rechnung/:personId', title: 'Rechnung' },
  { path: '/datenschutz', title: 'Datenschutz' },
  { path: '/impressum', title: 'Impressum' },
]

export function titleOf(pathname: string): string | null {
  return ROUTES.find((r) => matchPath({ path: r.path, end: true }, pathname))?.title ?? null
}
