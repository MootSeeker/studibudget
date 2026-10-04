import { execSync } from 'node:child_process'

/** Adressen und Schlüssel des lokalen Supabase (`npx supabase start`) als Name → Wert. */
export function supabaseStatus(): Record<string, string> {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
  return Object.fromEntries([...out.matchAll(/^(\w+)="(.*)"$/gm)].map((m) => [m[1], m[2]]))
}
