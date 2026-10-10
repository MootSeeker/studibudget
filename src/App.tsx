import type { ReactElement } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Budget } from './pages/Budget'
import { LegalPage } from './legal/LegalPage'
import { Ausgleich } from './pages/Ausgleich'
import { Rechnung } from './pages/Rechnung'
import { Konten } from './pages/Konten'
import { Statistik } from './pages/Statistik'
import { Monat } from './pages/Monat'
import { Eingabe } from './pages/Eingabe'
import { Einstellungen } from './pages/Einstellungen'
import { Platzhalter } from './pages/Platzhalter'
import { ROUTES } from './routes'

const PAGE_ELEMENTS: Record<string, ReactElement> = {
  '/eingabe': <Eingabe />,
  '/monat': <Monat />,
  '/statistik': <Statistik />,
  '/konten': <Konten />,
  '/ausgleich': <Ausgleich />,
  '/budget': <Budget />,
  '/einstellungen': <Einstellungen />,
  '/ausgleich/rechnung/:personId': <Rechnung />,
  '/datenschutz': <LegalPage slug="datenschutz" />,
  '/impressum': <LegalPage slug="impressum" />,
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/eingabe" replace />} />
          {ROUTES.map((r) => (
            <Route
              key={r.path}
              path={r.path}
              element={PAGE_ELEMENTS[r.path] ?? <Platzhalter titel={r.title} />}
            />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  )
}
