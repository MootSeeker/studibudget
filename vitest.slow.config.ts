import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Alle Tests mit künstlich verlangsamter Datenbank (siehe src/test/setup.ts). Findet Zeitfehler, die sonst nur auf der CI auftreten.
export default mergeConfig(viteConfig({ mode: 'test', command: 'serve' }), {
  test: { env: { SLOW_DB: process.env.SLOW_DB ?? '150' }, testTimeout: 30_000 },
})
