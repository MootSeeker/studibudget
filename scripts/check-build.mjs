// Prüft den fertigen Build (dist/): App-Manifest, Icons, Service Worker, Offline-Vorabladung und Sicherheits-Kopfzeile.
// Aufruf: node scripts/check-build.mjs   (nach `npm run build`)
import { existsSync, readFileSync } from 'node:fs'
import { loadEnv } from 'vite'

const errors = []
const check = (ok, msg) => {
  if (!ok) errors.push(msg)
}
const read = (f) => readFileSync(`dist/${f}`, 'utf8')

check(existsSync('dist/index.html'), 'dist/index.html fehlt (zuerst `npm run build`)')
if (errors.length === 0) {
  const html = read('index.html')

  // Manifest
  check(existsSync('dist/manifest.webmanifest'), 'manifest.webmanifest fehlt')
  if (existsSync('dist/manifest.webmanifest')) {
    const m = JSON.parse(read('manifest.webmanifest'))
    check(m.name === 'StudiBudget', 'Manifest: Name')
    check(
      m.start_url === '/studibudget/' && m.scope === '/studibudget/',
      'Manifest: start_url/scope müssen zur Basis /studibudget/ passen',
    )
    check(m.display === 'standalone', 'Manifest: display=standalone')
    check(
      typeof m.theme_color === 'string' && typeof m.background_color === 'string',
      'Manifest: Farben',
    )
    const sizes = (m.icons ?? []).map((i) => `${i.sizes}${i.purpose ? `:${i.purpose}` : ''}`)
    check(
      sizes.includes('192x192') && sizes.includes('512x512'),
      'Manifest: Icons 192 und 512 fehlen',
    )
    check(sizes.includes('512x512:maskable'), 'Manifest: maskierbares Icon fehlt')
    for (const i of m.icons ?? []) check(existsSync(`dist/${i.src}`), `Icon-Datei fehlt: ${i.src}`)
  }
  check(
    /<link rel="manifest" href="\/studibudget\/manifest\.webmanifest"/.test(html),
    'index.html verlinkt das Manifest nicht',
  )
  check(/rel="apple-touch-icon"/.test(html), 'apple-touch-icon fehlt')

  // Service Worker und Vorabladung: die App-Hülle muss offline verfügbar sein
  check(existsSync('dist/sw.js'), 'sw.js fehlt')
  if (existsSync('dist/sw.js')) {
    const sw = read('sw.js')
    check(sw.includes('index.html'), 'Service Worker lädt index.html nicht vorab')
    const assets = [...html.matchAll(/(?:src|href)="\/studibudget\/(assets\/[^"]+)"/g)].map(
      (x) => x[1],
    )
    check(assets.length >= 2, 'index.html verweist auf keine Assets')
    for (const a of assets)
      check(sw.includes(a.replace(/^assets\//, 'assets/')), `Service Worker lädt ${a} nicht vorab`)
    check(
      !/supabase\.co|127\.0\.0\.1:54321/.test(sw),
      'Der Service Worker darf keine Server-Adresse enthalten (Server-Antworten werden nie gecacht)',
    )
  }

  // Content-Security-Policy
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)
  check(m, 'Content-Security-Policy fehlt in index.html')
  if (m) {
    // Im HTML sind Zeichen maskiert (&#39; für '), der Browser liest sie als normale Zeichen.
    const decoded = m[1]
      .replaceAll('&#39;', "'")
      .replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
    const csp = Object.fromEntries(
      decoded
        .split(';')
        .map((d) => d.trim().split(/\s+/))
        .map(([k, ...v]) => [k, v]),
    )
    check(csp['default-src']?.join() === "'self'", "CSP: default-src muss 'self' sein")
    check(
      !csp['script-src']?.some((v) => v.includes('unsafe')),
      'CSP: script-src darf kein unsafe-* enthalten',
    )
    check(!Object.values(csp).flat().includes('*'), 'CSP: kein Platzhalter-* erlaubt')
    check(csp['object-src']?.join() === "'none'", "CSP: object-src 'none'")
    check(csp['base-uri']?.join() === "'self'", "CSP: base-uri 'self'")
    const url = loadEnv('production', process.cwd(), 'VITE_').VITE_SUPABASE_URL
    const connect = csp['connect-src'] ?? []
    if (url)
      check(
        connect.includes(new URL(url).origin),
        `CSP: connect-src enthält ${new URL(url).origin} nicht`,
      )
    check(
      connect.every((v) => v === "'self'" || v === new URL(url ?? 'https://x.invalid').origin),
      `CSP: connect-src erlaubt zu viel: ${connect.join(' ')}`,
    )
  }
  // keine Inline-Skripte (die CSP würde sie blockieren)
  check(
    ![...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)].length,
    'index.html enthält Inline-Skripte',
  )
}

if (errors.length) {
  console.error('Build-Prüfung fehlgeschlagen:\n' + errors.map((e) => ` - ${e}`).join('\n'))
  process.exit(1)
}
console.log(
  'Build-Prüfung bestanden: Manifest, Icons, Service Worker, Vorabladung und CSP in Ordnung.',
)
