/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/studibudget/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: [...configDefaults.exclude, '**/*.db.test.ts'],
  },
})
