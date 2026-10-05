import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { db } from '../data/db'
import { supabase } from './supabase'
import * as flows from './flows'

type Status = 'loading' | 'out' | 'in' | 'recovery'

interface AuthState {
  status: Status
  email: string | null
  notice: string | null
}

interface AuthApi {
  state: AuthState
  configured: boolean
  login(email: string, password: string): Promise<void>
  register(email: string, password: string): Promise<{ recoveryCode: string }>
  requestReset(email: string): Promise<void>
  completeRecovery(recoveryCode: string, newPassword: string): Promise<void>
  discardAccountInRecovery(): Promise<void>
  logout(): Promise<void>
  changePassword(oldPw: string, newPw: string): Promise<void>
  renewRecoveryKey(password: string): Promise<string>
  deleteAccount(password: string): Promise<void>
  clearNotice(): void
}

const Ctx = createContext<AuthApi | null>(null)

const redirectUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`

async function storeDek(email: string, key: CryptoKey) {
  await db.keystore.put({ id: 'dek', email, key })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', email: null, notice: null })
  const sb = supabase

  const set = useCallback((patch: Partial<AuthState>) => setState((s) => ({ ...s, ...patch })), [])

  useEffect(() => {
    if (!sb) {
      set({ status: 'out' })
      return
    }
    let cancelled = false
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      // Nicht direkt in diesem Callback auf supabase zugreifen (Deadlock-Gefahr), nur Zustand setzen.
      if (event === 'PASSWORD_RECOVERY')
        set({ status: 'recovery', email: session?.user.email ?? null })
    })
    ;(async () => {
      const { data } = await sb.auth.getSession()
      if (cancelled) return
      const entry = await db.keystore.get('dek')
      setState((s) => {
        if (s.status === 'recovery') return s
        if (data.session && entry && entry.email === data.session.user.email)
          return { status: 'in', email: entry.email, notice: null }
        if (data.session) {
          // Sitzung ohne lokalen Schlüssel, z. B. nach dem Bestätigungslink: neu anmelden.
          void sb.auth.signOut({ scope: 'local' })
          return {
            status: 'out',
            email: null,
            notice: 'E-Mail bestätigt. Bitte melde dich jetzt an.',
          }
        }
        return { status: 'out', email: null, notice: null }
      })
    })()
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [sb, set])

  const api = useMemo<AuthApi>(() => {
    const need = () => {
      if (!sb) throw new flows.AuthError('other', 'Der Server ist nicht konfiguriert.')
      return sb
    }
    return {
      state,
      configured: sb !== null,
      async login(email, password) {
        const { dek, user } = await flows.login(need(), email, password)
        const prev = await db.keystore.get('dek')
        // Ohne Schlüssel gilt der lokale Stand als fremd: ein spät beendeter Sync der letzten Sitzung
        // darf keinen Abgleichsstand (lastSeq) zurücklassen, der das erneute Laden vom Server überspringt.
        if (!prev || prev.email !== user.email) await db.wipe()
        await storeDek(user.email ?? email, dek)
        set({ status: 'in', email: user.email ?? email, notice: null })
      },
      register: (email, password) => flows.register(need(), email, password, redirectUrl()),
      requestReset: (email) => flows.requestPasswordReset(need(), email, redirectUrl()),
      async completeRecovery(code, newPassword) {
        const email = state.email
        if (!email)
          throw new flows.AuthError(
            'session',
            'Der Link ist abgelaufen. Bitte fordere einen neuen an.',
          )
        const dek = await flows.resetWithRecovery(need(), email, code, newPassword)
        const prev = await db.keystore.get('dek')
        if (!prev || prev.email !== email) await db.wipe()
        await storeDek(email, dek)
        set({ status: 'in', notice: null })
      },
      async discardAccountInRecovery() {
        await flows.deleteAccountWithoutKey(need())
        await db.wipe()
        set({
          status: 'out',
          email: null,
          notice: 'Konto gelöscht. Du kannst ein neues Konto anlegen.',
        })
      },
      async logout() {
        await flows.logout(need())
        await db.wipe()
        set({ status: 'out', email: null, notice: null })
      },
      changePassword: (oldPw, newPw) =>
        flows.changePassword(need(), state.email ?? '', oldPw, newPw),
      renewRecoveryKey: (pw) => flows.renewRecoveryKey(need(), state.email ?? '', pw),
      async deleteAccount(password) {
        await flows.deleteAccount(need(), state.email ?? '', password)
        await db.wipe()
        set({ status: 'out', email: null, notice: 'Dein Konto und alle Daten sind gelöscht.' })
      },
      clearNotice: () => set({ notice: null }),
    }
  }, [sb, state, set])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth braucht den AuthProvider')
  return v
}
