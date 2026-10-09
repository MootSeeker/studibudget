---
name: plan-schreiben
description: Schreibt zu einem Issue einen ausführbaren Umsetzungsplan mit Testfällen pro Akzeptanzkriterium, Dateiliste und maschinenlesbaren Blöcken, und postet ihn als Issue-Kommentar. Vorlage für den Subagenten planer.
argument-hint: <Issue-Nummer>
---

# Plan zu Issue $ARGUMENTS

Lies das Issue und nur den Code, den du für den Plan brauchst (gezielt suchen, nicht alles lesen). Schreibe den Plan in eine Datei im Scratchpad (nicht ins Repo) und poste ihn mit `gh issue comment $ARGUMENTS --body-file <Datei>`. Die Datei bleibt liegen: `npm run verify:kurz -- --plan <Datei>` liest sie.

Der Plan wird vom Subagenten `umsetzer` (Haiku) **wörtlich ausgeführt**, der nichts selbst entscheiden darf. Er muss deshalb vollständig sein, nicht lang: Jede Entscheidung ist getroffen.

Format (die Überschrift `## Plan` ist wichtig, der Reviewer sucht danach):

````
## Plan
**Ansatz:** 3 bis 6 Zeilen, welche Schichten betroffen sind (domain, data, Seite, Sync, Schema).

**Dateien und Signaturen:**
- `src/domain/beispiel.ts` (neu): `export function rundeRappen(betrag: number): number`
- `src/pages/Beispiel.tsx` (geändert): ruft `rundeRappen` in `speichern()` auf, Zeile 42
- verwendet: `parseAmount` aus `src/domain/amount.ts:12`, `(text: string) => number | null`

**Schritte:** nummeriert, in der Reihenfolge der Umsetzung (Tests zuerst).

**Tests (zuerst schreiben):**
| AK | Datei | Testname | Eingabe → Erwartung | Art |
| AK-1 | src/domain/beispiel.test.ts | AK-1: rundet auf ganze Rappen | `1.005` → `101` | Unit |
| AK-2 | e2e/beispiel.spec.ts | AK-2: zeigt den Fehler | leeres Feld, Speichern → Meldung «Betrag fehlt» | E2E |

**Nicht anfassen:** Dateien und Verhalten, die ausdrücklich unverändert bleiben.
**Offene Fragen:** keine
**Nicht Teil:** was bewusst nicht gemacht wird.
**Risiken:** nur, was den Nutzer betrifft (Schema, Sync, Rückwärtsverträglichkeit).

```plan-dateien
src/domain/beispiel.ts
src/domain/beispiel.test.ts
src/pages/Beispiel.tsx
e2e/beispiel.spec.ts
```

```plan-tests
src/domain/beispiel.test.ts :: AK-1: rundet auf ganze Rappen
e2e/beispiel.spec.ts :: AK-2: zeigt den Fehler
```
````

Die **Blöcke** liest `npm run verify:kurz -- --plan <Datei>` (siehe `scripts/lib/verify-kurz.mjs`): `plan-dateien` enthält jede Datei, die neu ist oder geändert wird, ein Pfad pro Zeile; `plan-tests` enthält jeden geplanten Test als `Datei :: Testname`, mit dem Namen genau so, wie er im Test steht. `CHANGELOG.md` und `vault/` stehen nicht in der Liste und nicht in den Schritten: Sie führt die Hauptsitzung in `pr-abschliessen` nach, nicht der `umsetzer`. Den gewünschten CHANGELOG-Text darf der Plan unter «Nicht Teil» als Vorschlag für die Hauptsitzung nennen. `verify:kurz` meldet rot, wenn der Diff gegenüber `main` eine Datei ausserhalb der Liste ändert oder ein Test aus `plan-tests` in seiner Datei fehlt. Bei einem Nachtrag gilt jeweils der letzte Block in der Datei.

Regeln:

- **Jedes AK hat mindestens einen Test** mit «Eingabe → Erwartung». Ein AK, das sich nicht testen lässt, wird als «Sichtprüfung» mit Begründung markiert.
- Logik als Unit-Test in `src/domain/`; Oberfläche über Komponententest, E2E oder Referenzbild; Fehlerbehebung mit Regressionstest (`regression`-Tag).
- Berücksichtige die Leitplanken aus `CLAUDE.md` (Geld in Rappen, ein Schreibweg über `store`, Grabsteine, neue Felder optional).
- Keine unscharfen Wörter: «ggf.», «z. B.», «usw.», «…», «TBD», «evtl.», «o. ä.», «nach Bedarf». Entscheide stattdessen.
- **Offene Fragen** nur, wenn sie der Nutzer entscheiden muss (Schema, Sync, Verhalten für Nutzende); sonst «keine».
- Keine Schema-Änderung ohne Hinweis unter «Risiken»: Migrationen auf das echte Supabase-Projekt nur nach Rückfrage.
