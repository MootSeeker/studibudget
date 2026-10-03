import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Einstellungen } from './pages/Einstellungen'
import { Platzhalter } from './pages/Platzhalter'
import { PAGES } from './pages'

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
              element={
                p.path === '/einstellungen' ? <Einstellungen /> : <Platzhalter titel={p.label} />
              }
            />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  )
}
