import { defineConfig } from 'vitest/config'

// Tests gegen das lokale Supabase (braucht Docker und `npx supabase start`).
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.db.test.ts'], testTimeout: 30000 },
})
