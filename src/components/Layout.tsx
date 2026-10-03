import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PAGES } from '../pages'
import { applyTheme, loadTheme, type ThemeChoice } from '../theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' }

export function Layout() {
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme)

  function cycleTheme() {
    const next = NEXT[theme]
    applyTheme(next)
    setTheme(next)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
      <nav
        aria-label="Hauptnavigation"
        className="flex flex-wrap items-center gap-1 border-b border-border p-3 md:w-56 md:shrink-0 md:flex-col md:items-stretch md:border-r md:border-b-0"
      >
        <span className="px-3 py-2 text-lg font-bold md:mb-2">StudiBudget</span>
        {PAGES.map((p) => (
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
          onClick={cycleTheme}
          className="mt-auto rounded-md border border-border px-3 py-2 text-left text-sm text-muted md:mt-4"
        >
          Darstellung: {LABEL[theme]}
        </button>
      </nav>
      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
