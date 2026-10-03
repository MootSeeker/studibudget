import { NavLink, Outlet } from 'react-router'
import { BackupReminder } from './BackupReminder'
import { useSettings } from '../data/hooks'
import { PAGES } from '../pages'
import { describeStatus, useSync } from '../sync/SyncProvider'

export function Layout() {
  const sync = useSync()
  const settings = useSettings()
  // «Ausgleich» gibt es nur, wenn Kosten geteilt werden.
  const pages = PAGES.filter(
    (p) =>
      p.path !== '/ausgleich' ||
      !settings ||
      settings.living === 'wg' ||
      settings.living === 'partner',
  )

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
      <nav
        aria-label="Hauptnavigation"
        className="flex flex-wrap items-center gap-1 border-b border-border p-3 md:w-56 md:shrink-0 md:flex-col md:items-stretch md:border-r md:border-b-0"
      >
        <span className="px-3 py-2 text-lg font-bold md:mb-2">StudiBudget</span>
        {pages.map((p) => (
          <NavLink
            key={p.path}
            to={p.path}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-accent text-accent-text' : 'hover:bg-surface'}`
            }
          >
            {p.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={sync.syncNow}
          title="Jetzt synchronisieren"
          className="mt-auto rounded-md px-3 py-2 text-left text-xs text-muted hover:bg-surface"
        >
          {describeStatus(sync.status, sync.pending)}
        </button>
      </nav>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <BackupReminder />
        <Outlet />
      </main>
    </div>
  )
}
