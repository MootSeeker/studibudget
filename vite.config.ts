import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const BASE = '/studibudget/'

/**
 * Content-Security-Policy als Meta-Tag (GitHub Pages erlaubt keine eigenen Kopfzeilen). Nur im Build: Der Dev-Server
 * braucht Inline-Skripte und WebSockets für Hot Reload. `connect-src` erlaubt nur die eigene Seite und das Supabase-Projekt.
 */
function csp(supabaseUrl: string | undefined): Plugin {
  let origin = ''
  try {
    origin = supabaseUrl ? new URL(supabaseUrl).origin : ''
  } catch {
    origin = ''
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // React setzt style-Attribute (Balkenbreiten)
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${origin ? ` ${origin}` : ''}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'studibudget-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: BASE,
    build: { chunkSizeWarningLimit: 800 }, // Hauptpaket: ca. 720 kB (gzip 208 kB), Backup-Prüfung ist ausgelagert
    plugins: [
      react(),
      tailwindcss(),
      csp(env.VITE_SUPABASE_URL),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'StudiBudget',
          short_name: 'StudiBudget',
          description: 'Einfache Budgetplanung für Studierende in der Schweiz und in Deutschland.',
          lang: 'de',
          start_url: BASE,
          scope: BASE,
          display: 'standalone',
          background_color: '#f7f8fa',
          theme_color: '#2563eb',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${BASE}index.html`,
          cleanupOutdatedCaches: true,
          // Der Server (Supabase) wird nie aus dem Cache bedient: nur die App selbst ist vorab geladen.
        },
      }),
    ],
  }
})
