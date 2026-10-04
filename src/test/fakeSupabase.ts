import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'

export type FakeError = { message: string; status?: number; code?: string } | null

export const USER = { id: 'user-1', email: 'anna@example.com' }

/**
 * Ein Supabase-Client im Speicher für Tests von Konto-Abläufen (flows.ts, AuthProvider). Jede Methode ist ein Spion;
 * Fehler und Antworten lassen sich pro Aufruf über die zurückgegebenen Felder steuern.
 */
export function fakeSupabase(init: { keys?: unknown; session?: boolean } = {}) {
  const state = {
    keys: init.keys ?? null,
    session: init.session ?? true,
    signInError: null as FakeError,
    updateUserError: null as FakeError,
    keysUpdateError: null as FakeError,
    rpcError: null as FakeError,
    selectError: null as FakeError,
    resetError: null as FakeError,
  }
  let authListener: ((event: string, session: unknown) => void) | null = null
  const unsubscribe = vi.fn()

  const auth = {
    signUp: vi.fn(async () => ({ data: {}, error: null })),
    signInWithPassword: vi.fn(async () => ({
      data: state.signInError ? null : { user: USER, session: { user: USER } },
      error: state.signInError,
    })),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({
      data: { session: state.session ? { user: USER } : null },
    })),
    updateUser: vi.fn(async () => ({ data: {}, error: state.updateUserError })),
    resetPasswordForEmail: vi.fn(async (): Promise<{ data: object; error: FakeError }> => ({
      data: {},
      error: state.resetError,
    })),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      authListener = cb
      return { data: { subscription: { unsubscribe } } }
    }),
  }
  const keysUpdate = vi.fn((patch: unknown) => ({
    eq: async () => ({ error: state.keysUpdateError, patch }),
  }))
  const from = vi.fn(() => ({
    select: () => ({
      maybeSingle: async () => ({ data: state.keys, error: state.selectError }),
    }),
    update: keysUpdate,
  }))
  const rpc = vi.fn(async () => ({ error: state.rpcError }))

  return {
    client: { auth, from, rpc } as unknown as SupabaseClient,
    auth,
    from,
    keysUpdate,
    rpc,
    state,
    unsubscribe,
    /** Löst ein Ereignis des Auth-Clients aus (z. B. 'PASSWORD_RECOVERY'). */
    emit: (event: string, session: unknown = { user: USER }) => authListener?.(event, session),
  }
}
