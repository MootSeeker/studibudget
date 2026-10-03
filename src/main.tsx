import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthGate } from './auth/AuthGate'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'
import { SyncProvider } from './sync/SyncProvider'
import { applyTheme, loadTheme } from './theme'

applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <SyncProvider>
          <App />
        </SyncProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
)
