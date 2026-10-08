---
name: issue-bearbeiten
description: Bearbeitet ein GitHub-Issue von der Anforderung bis zum Draft-PR (Spec-getrieben). Bei Mittel und Gross plant der Subagent planer (Opus), der umsetzer (Haiku) führt aus, die Hauptsitzung (Sonnet) steuert nur. Aufruf mit /issue-bearbeiten <Nr>.
argument-hint: <Issue-Nummer>
disable-model-invocation: true
model: sonnet
---

# Issue bearbeiten: #$ARGUMENTS

Das Issue ist die Anforderung. Halte dich an die Git-Regeln in `CLAUDE.md`.

**Rollen** (siehe `vault/30 Entscheide/Entscheid - Rollen der Modelle im Agenten-Ablauf.md`): Die Hauptsitzung läuft mit **Sonnet** und **steuert nur**. Bei Mittel und Gross schreibt sie keinen Code und trifft keine inhaltlichen Entscheidungen: Sie ruft die Subagenten auf, leitet ihre Meldungen **unverändert** weiter, zählt die Runden, committet, öffnet den PR und stellt als Einzige Fragen an den Nutzer. Inhaltlich entscheidet nur der `planer` (Opus); der `umsetzer` (Haiku) führt aus.

1. **Anforderung lesen:** `gh issue view $ARGUMENTS --comments`. Notiere die nummerierten Akzeptanzkriterien (AK) und die Grösse (Klein, Mittel, Gross; ohne Angabe: Mittel).
   - Keine prüfbaren AK? Schlage dem Nutzer welche vor und frage, ob du sie als Kommentar ins Issue schreiben sollst. Ohne AK nicht weitermachen.
   - Labels fehlen? Ergänze passende aus `gh label list`.
2. **Belegen (Regel 4):** Kommentiere im Issue: «Ich arbeite daran, Branch `<name>`.» Prüfe vorher, dass nicht schon jemand anderes dort angemeldet ist.
3. **Branch:** Hole den neuesten Stand des Hauptzweigs und lege davon einen Branch `<typ>/<nr>-<kurz>` an (z. B. `feat/78-statistik-ausgleich`). Nie im Hauptzweig arbeiten.
4. **Klein:** wie bisher ohne Subagenten: Tests zuerst (rot aus dem richtigen Grund), umsetzen, bis sie grün sind, dann Schritt 9.

Ab hier **Mittel und Gross**. Plan-Datei: `<Scratchpad>/plan-$ARGUMENTS.md`. Zähler `Nachbesserungen` = 0.

5. **Plan:** `planer` mit `PLAN $ARGUMENTS <Plan-Datei>` aufrufen. Beginnt seine Antwort mit `FRAGE AN DEN NUTZER`, stelle dem Nutzer die offenen Fragen aus dem Plan und gib die Antwort als `NACHTRAG` weiter.
6. **Trockenlauf:** `umsetzer` mit `TROCKENLAUF <Plan-Datei>` aufrufen.
   - `TROCKENLAUF OK`: weiter.
   - Liste `ENTSCHEIDUNG: …`: unverändert als `NACHTRAG $ARGUMENTS <Plan-Datei>` an den `planer` (fortsetzen mit `SendMessage`, sonst neu aufrufen), `Nachbesserungen` + 1, dann Schritt 6 wiederholen.
7. **Gross:** Hier anhalten, den Plan (Link zum Kommentar) zeigen und auf das OK des Nutzers warten. Mittel: weiter.
8. **Umsetzen und prüfen:**
   - `umsetzer` mit `UMSETZEN <Plan-Datei>` aufrufen.
   - `PLAN UNKLAR: …` in der Antwort: unverändert als `NACHTRAG` an den `planer`, `Nachbesserungen` + 1, dann `UMSETZEN` erneut.
   - Danach `npm run verify:kurz -- --plan <Plan-Datei>`. Grün: weiter mit Schritt 9.
   - Erstes Rot: `umsetzer` mit `NACHBESSERN <Plan-Datei>` und dem Bericht, dann erneut `verify:kurz`.
   - Zweites Rot in Folge: Bericht unverändert als `NACHTRAG` an den `planer`, `Nachbesserungen` + 1, dann `UMSETZEN` erneut.
9. **Abschluss:** Skill `pr-abschliessen` ausführen.

**Rundengrenze:** Wäre `Nachbesserungen` grösser als 3 (Trockenlauf, Unklarheiten, Rot und NACHARBEIT des Reviewers zusammen), halte an und frage den Nutzer, mit den letzten Meldungen. Ebenso, wenn der `umsetzer` zweimal hintereinander dieselbe Meldung liefert.

Bei Unklarheit in den AK: nachfragen statt raten.
