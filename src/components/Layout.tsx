import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { BackupReminder } from './BackupReminder'
import { useSettings } from '../data/hooks'
import { PAGES } from '../pages'
import { describeStatus, useSync } from '../sync/SyncProvider'

const EXTRA_TITLES: Record<string, string> = {
  '/datenschutz': 'Datenschutz',
  '/impressum': 'Impressum',
}

export function Layout() {
  const sync = useSync()
  const settings = useSettings()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const main = useRef<HTMLElement>(null)
  // «Ausgleich» gibt es nur, wenn Kosten geteilt werden.
  const pages = PAGES.filter(
    (p) =>
      p.path !== '/ausgleich' ||
      !settings ||
      settings.living === 'wg' ||
      settings.living === 'partner',
  )

  // Seitentitel pro Seite: wichtig für Tabs, Verlauf und Screenreader.
  useEffect(() => {
    const title = PAGES.find((p) => p.path === pathname)?.label ?? EXTRA_TITLES[pathname]
    document.title = title ? `${title} – StudiBudget` : 'StudiBudget'
  }, [pathname])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-3 text-sm md:py-2 ${isActive ? 'bg-accent text-accent-text' : 'hover:bg-surface'}`

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-text"
        onClick={() => main.current?.focus()}
      >
        Zum Inhalt springen
      </button>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-4 py-2 md:hidden">
        <span className="text-lg font-bold">StudiBudget</span>
        <button
          type="button"
          className="min-h-11 rounded-md border border-control px-4 py-2 text-sm"
          aria-expanded={menuOpen}
          aria-controls="hauptnavigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? 'Menü schliessen' : 'Menü'}
        </button>
      </header>

      <nav
        id="hauptnavigation"
        aria-label="Hauptnavigation"
        className={`${menuOpen ? 'flex' : 'hidden'} flex-col gap-1 border-b border-border p-3 md:flex md:w-56 md:shrink-0 md:border-r md:border-b-0`}
      >
        <span className="hidden px-3 py-2 text-lg font-bold md:mb-2 md:block">StudiBudget</span>
        {pages.map((p) => (
          <NavLink
            key={p.path}
            to={p.path}
            className={linkClass}
            onClick={() => setMenuOpen(false)}
          >
            {p.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={sync.syncNow}
          title="Jetzt synchronisieren"
          className="mt-2 rounded-md px-3 py-3 text-left text-xs text-muted hover:bg-surface md:mt-auto md:py-2"
        >
          {describeStatus(sync.status, sync.pending)}
        </button>
        <div className="flex gap-3 px-3 pb-1 text-xs text-muted">
          <Link to="/datenschutz" className="underline" onClick={() => setMenuOpen(false)}>
            Datenschutz
          </Link>
          <Link to="/impressum" className="underline" onClick={() => setMenuOpen(false)}>
            Impressum
          </Link>
        </div>
      </nav>

      <main ref={main} tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-8">
        <BackupReminder />
        <Outlet />
      </main>
    </div>
  )
}
