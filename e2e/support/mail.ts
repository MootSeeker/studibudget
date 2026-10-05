import { supabaseUmgebung } from './umgebung'

const base = supabaseUmgebung().mailUrl

interface MailKopf {
  ID: string
  To: { Address: string }[]
  Subject: string
}

/** Wartet auf die neueste Mail an `an` (Mailpit-API des lokalen Supabase) und gibt den Text zurück. */
export async function mailAbwarten(
  an: string,
  timeoutMs = 20_000,
): Promise<{ betreff: string; text: string }> {
  const ende = Date.now() + timeoutMs
  while (Date.now() < ende) {
    const res = await fetch(`${base}/api/v1/messages`)
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: MailKopf[] }
      const m = messages.find((x) => x.To.some((t) => t.Address.toLowerCase() === an.toLowerCase()))
      if (m) {
        const voll = (await (await fetch(`${base}/api/v1/message/${m.ID}`)).json()) as {
          Text: string
          HTML: string
        }
        return { betreff: m.Subject, text: voll.Text || voll.HTML }
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Keine Mail an ${an} innerhalb von ${timeoutMs} ms`)
}

/** Der erste Link in der Mail, der auf die App oder den Auth-Dienst zeigt. */
export function linkAusMail(text: string): string {
  const treffer = text.match(/https?:\/\/[^\s"<>)]+/g)?.map((l) => l.replace(/&amp;/g, '&'))
  const link = treffer?.find((l) => /verify|token|code=/.test(l)) ?? treffer?.[0]
  if (!link) throw new Error(`Kein Link in der Mail:\n${text}`)
  return link
}
