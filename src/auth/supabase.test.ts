import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('Supabase-Client', { tags: ['negativ'] }, () => {
  it.each([
    ['ohne Adresse', '', 'anon'],
    ['ohne Schlüssel', 'http://127.0.0.1:54321', ''],
    ['ohne beides', '', ''],
  ])('%s gibt es keinen Client (App meldet «Server nicht konfiguriert»)', async (_n, url, key) => {
    vi.stubEnv('VITE_SUPABASE_URL', url)
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', key)
    const { supabase } = await import('./supabase')
    expect(supabase).toBeNull()
  })
  it('mit Adresse und Schlüssel gibt es einen Client', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key')
    const { supabase } = await import('./supabase')
    expect(supabase).not.toBeNull()
  })
})
