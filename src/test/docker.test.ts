import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Dockerfile für den lokalen Betrieb (#169): Aufbau als Text geprüft; der echte Build steht im PR.
const lese = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const dockerfile = lese('Dockerfile')
const nginx = lese('docker/nginx.conf')
const ignore = lese('.dockerignore')
  .split('\n')
  .map((z) => z.trim())
const base = /const BASE = '([^']+)'/.exec(lese('vite.config.ts'))![1]

describe('Docker (#169)', () => {
  it('AK-1: Supabase-Werte als Build-Argumente, ohne sie scheitert der Build mit Hinweis', () => {
    expect(dockerfile).toMatch(/^ARG VITE_SUPABASE_URL$/m)
    expect(dockerfile).toMatch(/^ARG VITE_SUPABASE_ANON_KEY$/m)
    expect(dockerfile).toMatch(
      /test -n "\$VITE_SUPABASE_URL" && test -n "\$VITE_SUPABASE_ANON_KEY"/,
    )
  })

  it('AK-1: nginx liefert unter der Basis der App aus, mit Rückfall auf index.html', () => {
    expect(base).toBe('/studibudget/')
    expect(dockerfile).toMatch(
      /COPY --from=build \/app\/dist \/usr\/share\/nginx\/html\/studibudget$/m,
    )
    expect(nginx).toContain(`location ${base} {`)
    expect(nginx).toContain(`try_files $uri $uri/ ${base}index.html;`)
  })

  it('AK-1: Node-Version wie in .nvmrc', () => {
    const node = lese('.nvmrc').trim().split('.')[0]
    expect(dockerfile).toMatch(new RegExp(`^FROM node:${node}-alpine AS build$`, 'm'))
  })

  it('AK-4: keine lokalen Geheimnisse ins Image', () => {
    for (const muster of ['.env', '.env.*', '*.local', '.git', 'node_modules'])
      expect(ignore).toContain(muster)
    expect(ignore).toContain('!.env.example')
    expect(dockerfile).not.toMatch(/service_role|SERVICE_ROLE/i)
  })

  it('AK-3: Befehle in docs/docker.md, ohne Werte, und Verweise aus README und Betrieb', () => {
    const doku = lese('docs/docker.md')
    expect(doku).toContain('--build-arg VITE_SUPABASE_URL=<API_URL>')
    expect(doku).toContain('--build-arg VITE_SUPABASE_ANON_KEY=<ANON_KEY>')
    expect(doku).not.toMatch(/eyJ[a-zA-Z0-9_-]{10,}/) // kein JWT
    expect(lese('README.md')).toContain('docs/docker.md')
    expect(lese('vault/40 Betrieb/Betrieb.md')).toContain('docs/docker.md')
  })
})
