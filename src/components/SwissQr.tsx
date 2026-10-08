import qrcode from 'qrcode-generator'

// Die Bibliothek kodiert standardmässig ein Byte pro Zeichen; die QR-Rechnung verlangt UTF-8 (Zeichensatz 1, Issue #121).
const utf8 = new TextEncoder()
qrcode.stringToBytes = (s: string) => Array.from(utf8.encode(s))

/** Seitenlänge des QR-Codes und des Schweizer Kreuzes in mm (Swiss Implementation Guidelines QR-Rechnung). */
const SIZE = 46
const CROSS = 7

/**
 * Swiss QR Code (Fehlerkorrektur M) als SVG, 46 mm × 46 mm, mit Schweizer Kreuz in der Mitte.
 * Wird im Browser erzeugt, ohne Netzwerkzugriff (Issue #106). Die Ruhezone lässt der Zahlteil frei.
 */
export function SwissQr({ payload, label }: { payload: string; label: string }) {
  const qr = qrcode(0, 'M')
  qr.addData(payload, 'Byte')
  qr.make()
  const n = qr.getModuleCount()
  const cell = SIZE / n
  const modules: string[] = []
  let path = ''
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const dark = qr.isDark(r, c)
      modules.push(dark ? '1' : '0')
      if (dark)
        path += `M${+(c * cell).toFixed(4)} ${+(r * cell).toFixed(4)}h${+cell.toFixed(4)}v${+cell.toFixed(4)}h${-+cell.toFixed(4)}z`
    }
  const o = (SIZE - CROSS) / 2
  const k = 6 // schwarzes Quadrat im weissen Feld
  const ko = o + (CROSS - k) / 2
  const arm = k / 5
  const len = (k * 3) / 5
  return (
    <svg
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      width={`${SIZE}mm`}
      height={`${SIZE}mm`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      data-modules={modules.join(',')}
    >
      <rect width={SIZE} height={SIZE} fill="#fff" />
      <path d={path} fill="#000" />
      <g data-testid="kreuz">
        <rect x={o} y={o} width={CROSS} height={CROSS} fill="#fff" />
        <rect x={ko} y={ko} width={k} height={k} fill="#000" />
        <rect x={SIZE / 2 - arm / 2} y={SIZE / 2 - len / 2} width={arm} height={len} fill="#fff" />
        <rect x={SIZE / 2 - len / 2} y={SIZE / 2 - arm / 2} width={len} height={arm} fill="#fff" />
      </g>
    </svg>
  )
}
