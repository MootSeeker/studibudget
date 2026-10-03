import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthGate } from './auth/AuthGate'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'
import { OnboardingGate } from './onboarding/OnboardingGate'
import { SyncProvider } from './sync/SyncProvider'
import { UpdateBanner } from './components/UpdateBanner'
import { pwa } from './lib/pwa'
import { applyTheme, loadTheme } from './theme'

applyTheme(loadTheme())
pwa.start()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UpdateBanner />
    <AuthProvider>
      <AuthGate>
        <SyncProvider>
          <OnboardingGate>
            <App />
          </OnboardingGate>
        </SyncProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
)
