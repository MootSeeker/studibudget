import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpenSet } from './useOpenSet'

const IDS = ['a', 'b', 'c']
beforeEach(() => localStorage.clear())

describe('useOpenSet', () => {
  it('ohne gespeicherten Stand gilt der Standard', () => {
    const { result } = renderHook(() => useOpenSet('k', IDS, (id) => id === 'a'))
    expect(IDS.map(result.current.isOpen)).toEqual([true, false, false])
  })

  it('toggle ändert nur einen Abschnitt und merkt sich den Stand', () => {
    const { result, unmount } = renderHook(() => useOpenSet('k', IDS, (id) => id === 'a'))
    act(() => result.current.toggle('b'))
    expect(IDS.map(result.current.isOpen)).toEqual([true, true, false])
    unmount()
    const again = renderHook(() => useOpenSet('k', IDS))
    expect(IDS.map(again.result.current.isOpen)).toEqual([true, true, false])
  })

  it('setAll öffnet oder schliesst alles', () => {
    const { result } = renderHook(() => useOpenSet('k', IDS))
    act(() => result.current.setAll(true))
    expect(IDS.every(result.current.isOpen)).toBe(true)
    act(() => result.current.setAll(false))
    expect(IDS.some(result.current.isOpen)).toBe(false)
  })

  it('kaputter gespeicherter Wert wird ignoriert', () => {
    localStorage.setItem('k', '{kein json')
    const { result } = renderHook(() => useOpenSet('k', IDS, () => true))
    expect(result.current.isOpen('a')).toBe(true)
    localStorage.setItem('k', '[1,2]')
    const r2 = renderHook(() => useOpenSet('k', IDS, () => true))
    expect(r2.result.current.isOpen('a')).toBe(true)
  })

  it('ohne Speicher funktioniert es weiter, nur ohne Gedächtnis', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    const { result } = renderHook(() => useOpenSet('k', IDS))
    act(() => result.current.toggle('a'))
    expect(result.current.isOpen('a')).toBe(true)
    get.mockRestore()
    set.mockRestore()
  })
})
