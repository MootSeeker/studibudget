// Erzeugt die App-Icons (PNG) und das Favicon (SVG) ohne zusätzliche Abhängigkeiten.
// Aufruf: node scripts/make-icons.mjs   (schreibt nach public/)
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x25, 0x63, 0xeb]
const FG = [0xff, 0xff, 0xff]

// Geometrie im Einheitsquadrat: drei aufsteigende Balken.
const BARS = [
  { x: 0.19, y: 0.52, w: 0.16, h: 0.22 },
  { x: 0.42, y: 0.38, w: 0.16, h: 0.36 },
  { x: 0.65, y: 0.22, w: 0.16, h: 0.52 },
]

const inRoundRect = (px, py, x, y, w, h, r) => {
  if (px < x || px > x + w || py < y || py > y + h) return false
  const cx = px < x + r ? x + r : px > x + w - r ? x + w - r : px
  const cy = py < y + r ? y + r : py > y + h - r ? y + h - r : py
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

/** @param {{ size: number, rounded: boolean, scale: number }} o */
function render({ size, rounded, scale }) {
  const SS = 4
  const buf = Buffer.alloc(size * size * 4)
  const tx = (u) => 0.5 + (u - 0.5) * scale
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size
          const v = (y + (sy + 0.5) / SS) / size
          const bg = rounded ? inRoundRect(u, v, 0, 0, 1, 1, 0.22) : true
          if (!bg) continue
          const bar = BARS.some((q) =>
            inRoundRect(u, v, tx(q.x), tx(q.y), q.w * scale, q.h * scale, 0.04 * scale),
          )
          const c = bar ? FG : BG
          r += c[0]
          g += c[1]
          b += c[2]
          a += 255
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      const covered = a / 255
      buf[i] = covered ? Math.round(r / covered) : 0
      buf[i + 1] = covered ? Math.round(g / covered) : 0
      buf[i + 2] = covered ? Math.round(b / covered) : 0
      buf[i + 3] = Math.round(a / n)
    }
  }
  return buf
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // Bittiefe
  ihdr[9] = 6 // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
const out = [
  ['pwa-192.png', { size: 192, rounded: true, scale: 1 }],
  ['pwa-512.png', { size: 512, rounded: true, scale: 1 }],
  ['pwa-maskable-512.png', { size: 512, rounded: false, scale: 0.72 }], // volle Fläche, Inhalt in der Sicherheitszone
  ['apple-touch-icon.png', { size: 180, rounded: false, scale: 0.86 }],
]
for (const [name, o] of out) writeFileSync(`public/${name}`, png(o.size, render(o)))

const rect = (q) =>
  `<rect x="${+(q.x * 64).toFixed(2)}" y="${+(q.y * 64).toFixed(2)}" width="${+(q.w * 64).toFixed(2)}" height="${+(q.h * 64).toFixed(2)}" rx="2.5" fill="#fff"/>`
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2563eb"/>${BARS.map(rect).join('')}</svg>\n`,
)
console.log('Icons geschrieben:', out.map(([n]) => n).join(', '), '+ favicon.svg')
