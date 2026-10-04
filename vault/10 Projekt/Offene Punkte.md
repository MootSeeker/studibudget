---
typ: hub
bereich: betrieb
status: offen
aktualisiert: 2026-10-04
repo-quelle:
  - docs/start-checkliste.md
tags:
  - typ/hub
  - status/offen
---

# Offene Punkte

Keine offenen GitHub-Issues (Stand 2026-10-04). Offen ist der **öffentliche Start**. Die vollständige Liste steht in
`docs/start-checkliste.md`; hier der Stand:

## Blocker (Kevin)

- [ ] Datenschutzerklärung und Impressum ausfüllen (`src/legal/content.ts`, alle `TODO(human)` entfernen); danach `npm run check:launch`.
- [ ] Eigenen SMTP-Anbieter in Supabase einrichten (der Standardversand ist stark begrenzt).
- [ ] Region des Supabase-Projekts und Auftragsverarbeitungsvertrag (DPA) prüfen.
- [ ] «Allow new users to sign up» bewusst steuern, bis alles erledigt ist.

## Test-Suite v1.1.0 (läuft)

- [x] Baustein 1 bis 7 (Infrastruktur, Berichte, Supabase-CI, Fehlerpfade, Oberfläche, Eigenschaftstests)
- [ ] 8 Mutationstests (Stryker, Spike zuerst) · 9/10 Playwright-E2E · 11 axe · 12 visuelle Regression · 13 Doku, CHANGELOG, Release v1.1.0
- Plan: `~/.claude/plans/cozy-sparking-perlis.md`; Hintergrund: [[Tests und Zeitfehler]]

## Tests auf echten Geräten

- [ ] Offline-Start und Installation (der Service Worker liess sich in der Entwicklungsumgebung nicht ausführen).
- [ ] Zweites Gerät: Sync, Offline-Buchung, Passwort vergessen mit Wiederherstellungsschlüssel, Backup einspielen.
- [ ] Neues Layout (Issue #17) bei Handy-, Tablet- und Desktop-Breite ansehen: nur über Tests abgesichert, nicht im Browser geprüft.

Erledigte Issues: [[Issues]]
