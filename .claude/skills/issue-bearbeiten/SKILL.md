---
name: issue-bearbeiten
description: Bearbeitet ein GitHub-Issue von der Anforderung bis zum Code (Spec-getrieben). Aufruf mit /issue-bearbeiten <Nr>.
argument-hint: <Issue-Nummer>
disable-model-invocation: true
---

# Issue bearbeiten: #$ARGUMENTS

Das Issue ist die Anforderung. Halte dich an die Git-Regeln in `CLAUDE.md`.

1. **Anforderung lesen:** `gh issue view $ARGUMENTS --comments`. Notiere die nummerierten Akzeptanzkriterien (AK) und die Grösse (Klein, Mittel, Gross; ohne Angabe: Mittel).
   - Keine prüfbaren AK? Schlage dem Nutzer welche vor und frage, ob du sie als Kommentar ins Issue schreiben sollst. Ohne AK nicht weitermachen.
   - Labels fehlen? Ergänze passende aus `gh label list`.
2. **Belegen (Regel 4):** Kommentiere im Issue: «Ich arbeite daran, Branch `<name>`.» Prüfe vorher, dass nicht schon jemand anderes dort angemeldet ist.
3. **Branch:** Hole den neuesten Stand des Hauptzweigs und lege davon einen Branch `<typ>/<nr>-<kurz>` an (z. B. `feat/78-statistik-ausgleich`). Nie im Hauptzweig arbeiten.
4. **Ablauf nach Grösse:**
   - **Klein:** weiter mit Schritt 5.
   - **Mittel:** Skill `plan-schreiben` ausführen, Plan als Kommentar posten, weiter.
   - **Gross:** wie Mittel, danach **auf das OK des Nutzers warten**.
5. **Tests zuerst:** Schreibe die geplanten Tests und lass sie scheitern (`npm test`, rot aus dem richtigen Grund). Logik gehört in `src/domain/` als reine Funktion; Oberfläche über E2E oder Referenzbild.
6. **Umsetzen**, bis die Tests grün sind. Nur, was die AK verlangen; Ausuferndes als eigenes Issue vorschlagen.
7. **Prüfen:** `npm run verify` und `npm run test:slow`.
8. **Abschluss:** Skill `pr-abschliessen` ausführen.

Bei Unklarheit in den AK: nachfragen statt raten.
