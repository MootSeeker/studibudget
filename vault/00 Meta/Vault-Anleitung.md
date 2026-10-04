---
typ: meta
bereich: meta
aktualisiert: 2026-10-04
tags:
  - typ/meta
---

# Vault-Anleitung

## Was hier hineingehört

Wissen, das **nicht aus dem Repository ablesbar** ist: das Warum, Betriebswissen, offene Fragen, der Verlauf.

## Was nicht

- Codestruktur und Feldlisten. Das steht im Code und in `docs/entscheidungen.md`; hier verlinken.
- Rechtstexte (Datenschutz, Impressum): menschliche Arbeit, siehe `src/legal/content.ts`.
- **Geheimnisse jeder Art.** Das Repo ist öffentlich, also auch dieser Ordner.

## Ordner

| Ordner | Inhalt |
| --- | --- |
| `00 Meta` | Diese Anleitung. Standardort für neue Notizen. |
| `10 Projekt` | Projekt-Hub und offene Punkte. |
| `20 Architektur` | Wie die App gebaut ist. |
| `30 Entscheide` | Je ein Entscheid pro Notiz, mit Datum und Begründung. |
| `40 Betrieb` | Supabase, Deployment, Start-Checkliste. |
| `50 Issues` | Arbeitsnotiz pro GitHub-Issue. |
| `60 Journal` | Tagesnotizen. |
| `_Vorlagen` | Vorlagen für das Templates-Plugin. |

## Eigenschaften

```yaml
---
typ: referenz # hub | referenz | entscheid | issue | journal | meta
bereich: architektur # architektur | betrieb | qualitaet | produkt | meta
status: aktiv # offen | aktiv | erledigt | entschieden | verworfen
aktualisiert: 2026-10-04
repo-quelle: # Pfade im Repo
tags:
  - typ/referenz
---
```

Beim Ändern einer Notiz `aktualisiert` nachziehen.
