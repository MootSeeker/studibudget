---
typ: hub
bereich: betrieb
status: offen
aktualisiert: 2026-10-09
repo-quelle:
  - docs/start-checkliste.md
tags:
  - typ/hub
  - status/offen
---

# Offene Punkte

Offene GitHub-Issues (Stand 2026-10-09): #48 (Analyse `records_seq`), #72 (CI-Artefakte aufs NAS), #76 (Synchronisation von Informationen), #112 und #113 (Konten: Zeitdarstellung, Verlauf-Chart).
Offen ist ausserdem der **öffentliche Start**. Die vollständige Liste steht in `docs/start-checkliste.md`; hier der Stand:

## Pilot Agenten-Ablauf (#128)

Sitzung mit Sonnet starten, `/issue-bearbeiten <Nr>` mit 2–3 Issues der Grösse Mittel. Pro Issue festhalten (Tokens und Aufrufe stehen in jeder Rückmeldung eines Subagenten):

| Issue | Planer (Opus) | Umsetzer (Haiku) | Reviewer | Hauptsitzung | Nachbesserungen | Umsetzungsrunden | Nacharbeit nach PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #126 | 2 Aufrufe, 84 k + 94 k Tokens (24 + 8 Werkzeugaufrufe) | Trockenlauf 70 k + 62 k, Umsetzen 44 k (24 Aufrufe) | 2 Aufrufe: 43 k (NACHARBEIT, nur formal: AK-2/AK-3 damals offen, CHANGELOG-Begründung), danach BEREIT | offen | 2 (Trockenlauf: Befehl für den Rot-Lauf fehlte; Reviewer-NACHARBEIT, vom Planer ohne Codeänderung beschieden) | 1 | 1 (nur formal) |

- Zusätzlich messen: wie viel die Hauptsitzung für PR-Beschreibung, Journal und CHANGELOG braucht (Entscheid über einen Agenten `schreiber`).
- Vergleich: ein ähnlich grosses Issue mit dem früheren Ablauf, sonst der Probelauf an #120 (PR #133).

## Blocker (Kevin)

- [ ] Datenschutzerklärung und Impressum ausfüllen (`src/legal/content.ts`, alle `TODO(human)` entfernen); danach `npm run check:launch`.
- [ ] Eigenen SMTP-Anbieter in Supabase einrichten (der Standardversand ist stark begrenzt).
- [ ] Region des Supabase-Projekts und Auftragsverarbeitungsvertrag (DPA) prüfen.
- [ ] «Allow new users to sign up» bewusst steuern, bis alles erledigt ist.

## Test-Suite (erledigt, `v1.1.0`)

- [x] Baustein 1 bis 13; Ausgangswert der Mutationstests 82,26 %, `break` = 80
- [ ] Mutationstests: überlebende Mutanten in `src/data/hooks.ts` (134, von keinem Unit-Test erfasst), `period.ts`, `monthView.ts`
- [ ] E2E-Test «Passwort vergessen» (WebKit, `e2e/auth.spec.ts`) ist instabil (Issue #116, ohne gefundene Ursache geschlossen, bei neuer Rötung neues Issue): in CI einmal rot (Überschrift nach dem Mail-Link fehlt), lokal in WebKit 2 von rund 190 Läufen rot, beide direkt nach der Browser-Installation und an anderer Stelle (nach dem Setzen des neuen Passworts). Mit mehr Last nicht herbeizuführen. Bei der nächsten Rötung Trace und Fehlermeldung (Link und Zielseite) sichern, bevor aufgeräumt wird.
- [ ] Branch-Schutz (Kevin): `ci-gesamt` deckt nur den Workflow «Deploy» ab. Die Prüfungen aus «Doku» (format, links, vault, geheimnisse, claude-konfiguration) laufen bei Änderungen an Markdown und Doku-Pfaden, auch in gemischten PRs, und sind kein Teil von `ci-gesamt`. Doku-PRs lösen «Deploy» nicht aus, sodass `ci-gesamt` dort fehlt: für den Schutz braucht es einen zweiten Sammelstatus für «Doku» (und eine Antwort auf das Fehlen bei Doku-PRs), sonst blockiert er sie.
- [x] Bildtest «Konto» (#126, erledigt mit PR #135): Testadresse hat feste Länge, neue Referenzbilder, 120 grüne Wiederholungen im Workflow «Referenzbilder» (Eingabe `wiederholungen`).
- [ ] CI schneller machen (#62): Cache-Wirkung messen; falls `docker load` nicht schneller ist als der Download, Image-Cache entfernen

## Tests auf echten Geräten

- [ ] Rechnung (#105, #106, #121): Zahlteil drucken und den Swiss QR Code mit einer echten Banking-App scannen, mit **echter IBAN** (nicht der Beispiel-IBAN) und einem Umlaut in Name oder Ort; Layout des Zahlteils (Schriftgrössen, Kreuz) von Hand prüfen. Lehnt die App ihn weiter ab, die genaue Meldung festhalten und ein neues Issue anlegen (#121 ist geschlossen, AK-3 war nur teilweise belegt).
- [ ] Offline-Start und Installation (der Service Worker liess sich in der Entwicklungsumgebung nicht ausführen).
- [ ] Zweites Gerät: Sync, Offline-Buchung, Passwort vergessen mit Wiederherstellungsschlüssel, Backup einspielen.
- [ ] Neues Layout (Issue #17) und die Reiter (#84) bei Handy-, Tablet- und Desktop-Breite ansehen: über Tests und Referenzbilder abgesichert, nicht von Hand geprüft.

Erledigte Issues: [[Issues]]
