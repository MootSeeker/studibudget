/** Hybride logische Uhr: ergibt Zeitstempel, die über Geräte hinweg sortierbar und nie rückwärts laufen. */
export interface ClockState {
  wall: number
  counter: number
}

/** Grösster Zählerstand, der in die 4 Hex-Stellen des Stempels passt. */
const MAX_COUNTER = 0xffff

export function format(s: ClockState, device: string): string {
  return `${String(s.wall).padStart(15, '0')}-${s.counter.toString(16).padStart(4, '0')}-${device}`
}

export function parse(hlc: string): ClockState {
  const [wall, counter] = hlc.split('-')
  return { wall: Number(wall), counter: parseInt(counter, 16) }
}

function isAfter(a: ClockState, b: ClockState): boolean {
  return a.wall > b.wall || (a.wall === b.wall && a.counter > b.counter)
}

/** Nächster eigener Zeitstempel; strikt grösser als alle bisherigen. */
export function tick(s: ClockState, now: number): ClockState {
  if (now > s.wall) return { wall: now, counter: 0 }
  // Läuft der Zähler über, würde der Text «10000» vor «ffff» sortieren: stattdessen rückt die Uhr um 1 vor.
  return s.counter >= MAX_COUNTER
    ? { wall: s.wall + 1, counter: 0 }
    : { wall: s.wall, counter: s.counter + 1 }
}

/** Fremden Zeitstempel zur Kenntnis nehmen, damit der nächste eigene garantiert grösser ist. */
export function receive(s: ClockState, remoteHlc: string): ClockState {
  const r = parse(remoteHlc)
  return isAfter(r, s) ? r : s
}
