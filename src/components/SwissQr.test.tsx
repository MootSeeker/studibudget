import { render } from '@testing-library/react'
import jsQR from 'jsqr'
import qrcode from 'qrcode-generator'
import { describe, expect, it, vi } from 'vitest'
import { SwissQr } from './SwissQr'

const PAYLOAD = 'SPC\n0200\n1\nCH9300762011623852957\nS\nKevin Muster\nWeg\n1\n8000\nZürich\nCH'

describe('SwissQr', () => {
  it('AK-3: 46 mm × 46 mm, Schweizer Kreuz 7 mm × 7 mm in der Mitte', () => {
    const { container } = render(<SwissQr payload={PAYLOAD} label="QR-Code" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', '46mm')
    expect(svg).toHaveAttribute('height', '46mm')
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    expect([w, h]).toEqual([46, 46])
    const cross = container.querySelector('[data-testid="kreuz"]')!
    expect(cross.querySelector('rect')).toHaveAttribute('width', '7')
    expect(cross.querySelector('rect')).toHaveAttribute('x', '19.5')
    expect(cross.querySelector('rect')).toHaveAttribute('y', '19.5')
  })

  it('AK-3: Fehlerkorrektur M (Formatinformation der Matrix)', () => {
    const { container } = render(<SwissQr payload={PAYLOAD} label="QR-Code" />)
    const dark = container.querySelector('svg')!.getAttribute('data-modules')!.split(',')
    const n = Math.sqrt(dark.length)
    const at = (r: number, c: number) => (dark[r * n + c] === '1' ? 1 : 0)
    let bits = 0
    for (let i = 0; i < 15; i++) {
      const r = i < 6 ? i : i < 8 ? i + 1 : n - 15 + i
      bits |= at(r, 8) << i
    }
    expect((bits ^ 0x5412) >> 13).toBe(0) // Bits 14..13 = Stufe, 0 = M
    const ref = qrcode(0, 'M')
    ref.addData(PAYLOAD, 'Byte')
    ref.make()
    expect(n).toBe(ref.getModuleCount())
  })

  it('AK-7: erzeugt den Code ohne Netzwerkzugriff', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    render(<SwissQr payload={PAYLOAD} label="QR-Code" />)
    expect(f).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it.each([
    ['ohne Umlaute', PAYLOAD.replace('Zürich', 'Zuerich')],
    [
      'mit Umlauten (UTF-8)',
      'SPC\n0200\n1\nCH9300762011623852957\nS\nMüller Café AG\nBärenstrasse\n3\n8000\nZürich\nCH',
    ],
  ])('AK-2 (#121): ein Decoder liest den Payload zurück, %s', (_n, payload) => {
    const { container } = render(<SwissQr payload={payload} label="QR-Code" />)
    const mods = container.querySelector('svg')!.getAttribute('data-modules')!.split(',')
    const n = Math.sqrt(mods.length)
    const scale = 6
    const quiet = 4
    const size = (n + quiet * 2) * scale
    const rgba = new Uint8ClampedArray(size * size * 4).fill(255)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (mods[r * n + c] !== '1') continue
        for (let y = 0; y < scale; y++)
          for (let x = 0; x < scale; x++) {
            const i = (((r + quiet) * scale + y) * size + (c + quiet) * scale + x) * 4
            rgba[i] = rgba[i + 1] = rgba[i + 2] = 0
          }
      }
    const code = jsQR(rgba, size, size)
    expect(code).not.toBeNull()
    // Der Standard verlangt UTF-8 (Zeichensatz 1): die Bytes, nicht nur die Zeichen, müssen stimmen
    expect(new TextDecoder().decode(new Uint8Array(code!.binaryData))).toBe(payload)
  })
})
