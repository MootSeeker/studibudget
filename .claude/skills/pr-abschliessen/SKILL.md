---
name: pr-abschliessen
description: Schliesst die Arbeit an einem Issue ab: Vault und CHANGELOG nachführen, committen, PR als Draft öffnen, Reviewer-Subagent laufen lassen und beim Draft anhalten. Freigabe nur auf Anweisung des Nutzers. Aufruf mit /pr-abschliessen <Nr>.
argument-hint: <Issue-Nummer>
disable-model-invocation: true
---

# PR abschliessen: Issue #$ARGUMENTS

Voraussetzung: `npm run verify:kurz` (bei Mittel und Gross mit `-- --plan <Plan-Datei>`) war lokal grün. Sonst zuerst beheben, bei Mittel und Gross über den Ablauf in `issue-bearbeiten`.

1. **Nachführen:**
   - `CHANGELOG.md` unter `[Unreleased]`, wenn sich für Nutzende etwas ändert (mit Issue-Nummer).
   - Vault: Journal von heute in `vault/60 Journal/`, `vault/10 Projekt/Offene Punkte.md` und, falls vorhanden, die Notiz in `vault/50 Issues/`. Bei jeder Notiz `aktualisiert` nachziehen. `npm run check:vault` muss grün sein.
2. **Commit** (durch die Hauptsitzung, nie durch den `umsetzer`) ohne Claude-Kennzeichnung (Regel 1), Nachricht auf Deutsch mit Issue-Nummer wie in der bisherigen Historie. Dann den Branch mit Upstream pushen (`-u origin HEAD`).
3. **PR als Draft öffnen** (`gh pr create --draft`): Titel mit Issue-Nummer, Beschreibung nach `.github/pull_request_template.md` (mit `Closes #$ARGUMENTS`), gleiche Labels wie das Issue. Als Draft läuft die schwere CI noch nicht (siehe `vault/40 Betrieb/Betrieb.md`).
4. **Reviewer** (nur bei Grösse Mittel und Gross; bei Klein überspringen): Subagent `reviewer` aufrufen und ihm mitgeben:
   - Issue-Nummer und PR-Nummer,
   - den Plan als Text (Plan-Datei samt Nachträgen),
   - das Ergebnis des letzten lokalen Testlaufs: die Ausgabe von `verify:kurz`.

   **Modell:** Trägt das Issue das Label `sync` oder ändert der Diff Dateien in `src/crypto/` oder `src/sync/` (`gh pr diff <PR> --name-only`), dann den `reviewer` mit dem Modell `opus` aufrufen; sonst ohne Modellangabe (Sonnet aus dem Frontmatter).
   - **NACHARBEIT:** Das Urteil unverändert als `NACHTRAG` an den `planer`; der Zähler `Nachbesserungen` aus `issue-bearbeiten` zählt mit (Grenze 3). Danach `umsetzer` mit `UMSETZEN`, `verify:kurz`, Schritt 2 und Reviewer erneut. Bei Klein gibt es keinen Reviewer.
   - **BEREIT:** weiter.

5. **Anhalten beim Draft:** Sage dem Nutzer, dass der Draft-PR bereit ist (Link, Urteil des Reviewers, Zahl der Nachbesserungen), und höre auf. `gh pr ready <PR>` nur auf ausdrückliche Anweisung des Nutzers; erst dann startet die volle CI.
6. **Nicht auf die CI warten** (Regel 2): Nach der Freigabe sagen, dass die CI läuft, und aufhören. Der Nutzer meldet das Ergebnis. Bei Rot: Protokoll des fehlgeschlagenen Jobs lesen, Ursache beheben, nicht umgehen.
7. **Merge nur mit ausdrücklichem OK des Nutzers** (Regel 6) und wenn er «CI grün» gemeldet hat (oder «mergen, wenn CI grün» sagt: dann einmal `gh pr checks <PR>` prüfen, nicht warten). Dann `gh pr merge <PR> --squash --delete-branch`, danach den Hauptzweig lokal aktualisieren und `git fetch --prune`.
8. **Issue:** Wird durch `Closes` geschlossen (sonst von Hand schliessen); kommentiere kurz, was umgesetzt wurde und in welchem PR.
