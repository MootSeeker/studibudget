import { defineConfig } from 'vite'

// MCP-Server für Claude Desktop (#158): eine Datei für Node, ohne Abhängigkeiten zur Laufzeit.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'src/mcp/main.ts',
    outDir: 'mcp-dist',
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    rolldownOptions: {
      output: { format: 'es', entryFileNames: 'studibudget-mcp.mjs' },
    },
  },
})
