---
name: pr-abschliessen
description: Schliesst die Arbeit an einem Issue ab: Vault und CHANGELOG nachführen, PR als Draft öffnen, Reviewer-Subagent laufen lassen, freigeben, auf grüne CI warten. Aufruf mit /pr-abschliessen <Nr>.
argument-hint: <Issue-Nummer>
disable-model-invocation: true
---

# PR abschliessen: Issue #$ARGUMENTS

Voraussetzung: `npm run verify` und `npm run test:slow` waren lokal grün. Sonst zuerst beheben.

1. **Nachführen:**
   - `CHANGELOG.md` unter `[Unreleased]`, wenn sich für Nutzende etwas ändert (mit Issue-Nummer).
   - Vault: Journal von heute in `vault/60 Journal/`, `vault/10 Projekt/Offene Punkte.md` und, falls vorhanden, die Notiz in `vault/50 Issues/`. Bei jeder Notiz `aktualisiert` nachziehen. `npm run check:vault` muss grün sein.
2. **Commit** ohne Claude-Kennzeichnung (Regel 1), Nachricht auf Deutsch mit Issue-Nummer wie in der bisherigen Historie. Dann den Branch mit Upstream pushen (`-u origin HEAD`).
3. **PR als Draft öffnen** (`gh pr create --draft`): Titel mit Issue-Nummer, Beschreibung nach `.github/pull_request_template.md` (mit `Closes #$ARGUMENTS`), gleiche Labels wie das Issue. Als Draft läuft die schwere CI noch nicht (siehe `vault/40 Betrieb/Betrieb.md`).
4. **Reviewer** (nur bei Grösse Mittel und Gross; bei Klein überspringen): Subagent `reviewer` mit Issue-Nummer und PR-Nummer aufrufen. Sage ihm, dass der PR ein Draft ist und die CI erst nach der Freigabe läuft, damit er sie nicht bewertet.
   - **NACHARBEIT:** Befunde beheben, Schritt 1 und 2 wiederholen, Reviewer erneut. Höchstens zwei Runden, danach den Nutzer fragen.
   - **BEREIT:** weiter.
5. **Freigeben:** `gh pr ready <PR>`. Jetzt startet die volle CI.
6. **Nicht auf die CI warten** (Regel 2): Sage dem Nutzer, dass die CI läuft, und höre auf. Der Nutzer meldet das Ergebnis. Bei Rot: Protokoll des fehlgeschlagenen Jobs lesen, Ursache beheben, nicht umgehen.
7. **Merge nur mit ausdrücklichem OK des Nutzers** (Regel 6) und wenn er «CI grün» gemeldet hat (oder «mergen, wenn CI grün» sagt: dann einmal `gh pr checks <PR>` prüfen, nicht warten). Dann `gh pr merge <PR> --squash --delete-branch`, danach den Hauptzweig lokal aktualisieren und `git fetch --prune`.
8. **Issue:** Wird durch `Closes` geschlossen; kommentiere kurz, was umgesetzt wurde und in welchem PR.
