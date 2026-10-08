// verify:kurz (Issue #129): reine Hilfen für den knappen Prüfbericht, aufgerufen von scripts/verify-kurz.mjs und
// getestet in src/test/verifyKurz.test.ts.

export const MAX_ZEILEN = 30
const MAX_TESTS = 5
const MAX_DETAILS = 5

/** Schritte aus dem Skript `verify` (`npm run a && npm run b …`), danach `test:slow`. */
export function schritteAusVerify(skript) {
  const schritte = skript
    .split('&&')
    .map((teil) => teil.trim().replace(/^npm run\s+/, ''))
    .filter(Boolean)
  return [...schritte, 'test:slow']
}

/** Führt die Schritte nacheinander aus und hält nach dem ersten roten an; die übrigen sind «nicht gelaufen». */
export async function planlauf(schritte, ausfuehren) {
  const ergebnisse = []
  let abgebrochen = false
  for (const name of schritte) {
    if (abgebrochen) {
      ergebnisse.push({ name, status: 'nicht gelaufen', tests: [], ausgabe: [] })
      continue
    }
    const ergebnis = { name, ...(await ausfuehren(name)) }
    ergebnisse.push(ergebnis)
    if (ergebnis.status === 'rot') abgebrochen = true
  }
  return ergebnisse
}

const ANZEIGE = {
  gruen: 'grün',
  rot: 'rot',
  'nicht gelaufen': 'nicht gelaufen',
  uebersprungen: 'übersprungen',
}
const zeile = (status, name) => `${ANZEIGE[status].padEnd(15)}${name}`

function begrenzt(eintraege, max) {
  const rest = eintraege.length - max
  return rest > 0 ? [...eintraege.slice(0, max), `und ${rest} weitere`] : eintraege
}

/**
 * Bericht mit höchstens MAX_ZEILEN Zeilen: zuerst eine Zeile pro Schritt und Zusatzprüfung, dann Einzelheiten zu
 * roten Schritten (rote Tests oder letzte Ausgabezeilen) und roten Zusatzprüfungen.
 */
export function bericht({ schritte, zusatz }) {
  const kopf = [
    ...schritte.map((s) => zeile(s.status, s.name)),
    ...zusatz.map((z) => zeile(z.status, z.name)),
  ]
  const details = []
  for (const s of schritte.filter((s) => s.status === 'rot')) {
    details.push('', `${s.name}:`)
    const eintraege = s.tests.length
      ? s.tests.map((t) => `${t.datei} › ${t.name}: ${t.meldung.split('\n')[0]}`)
      : s.ausgabe.slice(-MAX_DETAILS)
    details.push(...begrenzt(eintraege, MAX_TESTS).map((e) => `  ${e}`))
  }
  for (const z of zusatz.filter((z) => z.status === 'rot')) {
    details.push('', `${z.name}:`, ...begrenzt(z.befunde, MAX_DETAILS).map((e) => `  ${e}`))
  }
  const alle = [...kopf, ...details]
  if (alle.length <= MAX_ZEILEN) return alle
  return [...alle.slice(0, MAX_ZEILEN - 1), '… (gekürzt)']
}

/** 1, wenn ein Schritt oder eine Zusatzprüfung rot ist, sonst 0. */
export function exitCode({ schritte, zusatz }) {
  return [...schritte, ...zusatz].some((e) => e.status === 'rot') ? 1 : 0
}

/** Hinzugefügte Zeilen aus einem Diff mit `-U0`, mit Datei und Zeilennummer in der neuen Fassung. */
export function hinzugefuegteZeilen(diff) {
  const zeilen = []
  let datei = null
  let nummer = 0
  for (const z of diff.split('\n')) {
    if (z.startsWith('+++ ')) {
      datei = z === '+++ /dev/null' ? null : z.slice(4).replace(/^b\//, '')
      continue
    }
    if (z.startsWith('--- ')) continue
    const kopf = z.match(/^@@ -\S+ \+(\d+)/)
    if (kopf) {
      nummer = Number(kopf[1])
      continue
    }
    if (datei && z.startsWith('+')) zeilen.push({ datei, zeile: nummer++, text: z.slice(1) })
  }
  return zeilen
}

// Zeichen und Muster zusammengesetzt, damit diese Datei selbst die Prüfung besteht (Prettier schreibt \u-Escapes aus).
const SCHARFES_S = String.fromCharCode(0xdf)
const KENNZEICHNUNG = [
  ['co-authored', '-by:.*(claude|anthropic)'],
  ['generated with', '\\s*\\[?claude'],
  ['noreply@', 'anthropic\\.com'],
].map((teile) => new RegExp(teile.join(''), 'i'))

/** Befunde «Datei:Zeile: Art» für das scharfe S und die Claude-Kennzeichnung; Dateien der Ausnahmeliste zählen nicht. */
export function pruefeLeitplanken(zeilen, ausnahmen) {
  const ausgenommen = new Set(ausnahmen.map((a) => a.datei))
  const befunde = []
  for (const z of zeilen) {
    if (ausgenommen.has(z.datei)) continue
    if (z.text.includes(SCHARFES_S)) befunde.push(`${z.datei}:${z.zeile}: ${SCHARFES_S} statt ss`)
    if (KENNZEICHNUNG.some((m) => m.test(z.text)))
      befunde.push(`${z.datei}:${z.zeile}: Claude-Kennzeichnung`)
  }
  return befunde
}

function block(text, art) {
  const treffer = text.match(new RegExp('```' + art + '[^\\n]*\\n([\\s\\S]*?)```'))
  if (!treffer) return null
  return treffer[1]
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)
}

/** Dateiliste und geplante Tests aus den Blöcken «plan-dateien» und «plan-tests»; null ohne Dateiblock. */
export function lesePlanBlock(text) {
  const dateien = block(text, 'plan-dateien')
  if (!dateien) return null
  const tests = (block(text, 'plan-tests') ?? []).map((z) => {
    const [datei, ...name] = z.split('::')
    return { datei: datei.trim(), name: name.join('::').trim() }
  })
  return { dateien, tests }
}

const IMMER_ERLAUBT = [/^CHANGELOG\.md$/, /^vault\//]

/**
 * Befunde zum Plan: geänderte Dateien ausserhalb der Dateiliste und geplante Tests, deren Name in der Datei fehlt.
 * `inhalt(datei)` liefert den Dateitext oder null.
 */
export function pruefePlan(plan, geaendert, inhalt) {
  const erlaubt = new Set(plan.dateien)
  const befunde = geaendert
    .filter((d) => !erlaubt.has(d) && !IMMER_ERLAUBT.some((m) => m.test(d)))
    .map((d) => `${d}: nicht in der Dateiliste des Plans`)
  for (const t of plan.tests) {
    const text = inhalt(t.datei)
    if (text === null || !text.includes(t.name))
      befunde.push(`${t.datei}: geplanter Test fehlt: ${t.name}`)
  }
  return befunde
}

/** Zusatzprüfung «Plan»: ohne Plan übersprungen, ohne Block rot, sonst nach den Befunden. */
export function planpruefung(planText, geaendert, inhalt) {
  if (planText === undefined) return { name: 'Plan', status: 'uebersprungen', befunde: [] }
  const plan = lesePlanBlock(planText)
  if (!plan) return { name: 'Plan', status: 'rot', befunde: ['Plan hat kein Block «plan-dateien»'] }
  const befunde = pruefePlan(plan, geaendert, inhalt)
  return { name: 'Plan', status: befunde.length ? 'rot' : 'gruen', befunde }
}
