---
typ: hub
bereich: betrieb
status: offen
aktualisiert: 2026-10-06
repo-quelle:
  - docs/start-checkliste.md
tags:
  - typ/hub
  - status/offen
---

# Offene Punkte

Offene GitHub-Issues (Stand 2026-10-06): #48 (Analyse `records_seq`), #65 (Ausgleichsrechnungen mit QR; aufgeteilt in #104 Bankverbindung, #105 Druckansicht, #106 QR-Code),
#72 (CI-Artefakte aufs NAS), #76 (Synchronisation von Informationen), #104 bis #106 (siehe #65; #104 als PR in Arbeit). Offen ist
ausserdem der **öffentliche Start**. Die vollständige Liste steht in `docs/start-checkliste.md`; hier der Stand:

## Blocker (Kevin)

- [ ] Datenschutzerklärung und Impressum ausfüllen (`src/legal/content.ts`, alle `TODO(human)` entfernen); danach `npm run check:launch`.
- [ ] Eigenen SMTP-Anbieter in Supabase einrichten (der Standardversand ist stark begrenzt).
- [ ] Region des Supabase-Projekts und Auftragsverarbeitungsvertrag (DPA) prüfen.
- [ ] «Allow new users to sign up» bewusst steuern, bis alles erledigt ist.

## Test-Suite (erledigt, `v1.1.0`)

- [x] Baustein 1 bis 13; Ausgangswert der Mutationstests 82,26 %, `break` = 80
- [ ] Mutationstests: überlebende Mutanten in `src/data/hooks.ts` (134, von keinem Unit-Test erfasst), `period.ts`, `monthView.ts`
- [ ] CI schneller machen (#62): Cache-Wirkung messen; falls `docker load` nicht schneller ist als der Download, Image-Cache entfernen

## Tests auf echten Geräten

- [ ] Offline-Start und Installation (der Service Worker liess sich in der Entwicklungsumgebung nicht ausführen).
- [ ] Zweites Gerät: Sync, Offline-Buchung, Passwort vergessen mit Wiederherstellungsschlüssel, Backup einspielen.
- [ ] Neues Layout (Issue #17) und die Reiter (#84) bei Handy-, Tablet- und Desktop-Breite ansehen: über Tests und Referenzbilder abgesichert, nicht von Hand geprüft.

Erledigte Issues: [[Issues]]
