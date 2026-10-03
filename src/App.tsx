import type { ReactElement } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Budget } from './pages/Budget'
import { Eingabe } from './pages/Eingabe'
import { Einstellungen } from './pages/Einstellungen'
import { Platzhalter } from './pages/Platzhalter'
import { PAGES } from './pages'

const PAGE_ELEMENTS: Record<string, ReactElement> = {
  '/eingabe': <Eingabe />,
  '/budget': <Budget />,
  '/einstellungen': <Einstellungen />,
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/eingabe" replace />} />
          {PAGES.map((p) => (
            <Route
              key={p.path}
              path={p.path}
              element={PAGE_ELEMENTS[p.path] ?? <Platzhalter titel={p.label} />}
            />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  )
}
