import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInstall } from './install'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const standalone = (on: boolean) =>
  vi.stubGlobal('matchMedia', () => ({
    matches: on,
    addEventListener() {},
    removeEventListener() {},
  }))
const promptEvent = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }
  e.prompt = vi.fn().mockResolvedValue(undefined)
  e.userChoice = Promise.resolve({ outcome })
  return e
}

describe('useInstall', () => {
  it('im Browser ohne Angebot: nicht installiert, kein Knopf', () => {
    standalone(false)
    const { result } = renderHook(() => useInstall())
    expect(result.current).toMatchObject({ installed: false, canPrompt: false })
  })

  it('läuft die App schon als installierte App, gibt es nichts anzubieten', () => {
    standalone(true)
    const { result } = renderHook(() => useInstall())
    expect(result.current).toMatchObject({ installed: true, canPrompt: false, ios: false })
  })

  it('«beforeinstallprompt» schaltet den Knopf frei; install() zeigt die Aufforderung einmal', async () => {
    standalone(false)
    const { result } = renderHook(() => useInstall())
    const e = promptEvent()
    act(() => void window.dispatchEvent(e))
    expect(e.defaultPrevented).toBe(true)
    expect(result.current.canPrompt).toBe(true)
    await act(() => result.current.install())
    expect(e.prompt).toHaveBeenCalledTimes(1)
    expect(result.current.canPrompt).toBe(false)
  })

  it('install() ohne Ereignis tut nichts', async () => {
    standalone(false)
    const { result } = renderHook(() => useInstall())
    await act(() => result.current.install())
    expect(result.current.canPrompt).toBe(false)
  })

  it('«appinstalled» markiert die App als installiert und nimmt das Angebot zurück', () => {
    standalone(false)
    const { result } = renderHook(() => useInstall())
    act(() => void window.dispatchEvent(promptEvent()))
    act(() => void window.dispatchEvent(new Event('appinstalled')))
    expect(result.current).toMatchObject({ installed: true, canPrompt: false })
  })

  it('iPhone: nur der Hinweis «Teilen → Zum Home-Bildschirm», solange nicht installiert', () => {
    standalone(false)
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    })
    const { result } = renderHook(() => useInstall())
    expect(result.current.ios).toBe(true)
    expect(result.current.canPrompt).toBe(false)
  })

  it('iPad mit Desktop-Kennung (MacIntel mit Touch) gilt als iOS', () => {
    standalone(false)
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })
    const { result } = renderHook(() => useInstall())
    expect(result.current.ios).toBe(true)
  })

  it('ohne matchMedia (alte Browser) stürzt nichts ab', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => renderHook(() => useInstall())).not.toThrow()
  })

  it('beim Verlassen werden die Hörer entfernt', () => {
    standalone(false)
    const remove = vi.spyOn(window, 'removeEventListener')
    renderHook(() => useInstall()).unmount()
    expect(remove).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('appinstalled', expect.any(Function))
  })
})
