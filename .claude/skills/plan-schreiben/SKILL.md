---
name: plan-schreiben
description: Schreibt zu einem Issue einen kurzen Umsetzungsplan mit Testliste, die jedem Akzeptanzkriterium einen Test zuordnet, und postet ihn als Issue-Kommentar.
argument-hint: <Issue-Nummer>
---

# Plan zu Issue $ARGUMENTS

Lies das Issue und nur den Code, den du für den Plan brauchst (gezielt suchen, nicht alles lesen). Schreibe einen Plan von höchstens etwa 40 Zeilen und poste ihn mit `gh issue comment $ARGUMENTS --body-file <Datei>`. Die Datei kommt in das Scratchpad, nicht ins Repo.

Format (die Überschrift `## Plan` ist wichtig, der Reviewer sucht danach):

```
## Plan
**Ansatz:** 3 bis 6 Zeilen, welche Schichten betroffen sind (domain, data, Seite, Sync, Schema).
**Dateien:** neue und geänderte Dateien.

**Tests (zuerst schreiben):**
| AK | Test | Datei | Art |
| AK-1 | Name des Tests, als Satz | src/domain/….test.ts | Unit |
| AK-2 | … | e2e/….spec.ts | E2E |

**Nicht Teil:** was bewusst nicht gemacht wird.
**Risiken / Fragen:** nur, was den Nutzer betrifft (Schema, Sync, Rückwärtsverträglichkeit).
```

Regeln:

- **Jedes AK hat mindestens einen Test.** Ein AK, das sich nicht testen lässt, wird im Plan als «Sichtprüfung» mit Begründung markiert.
- Logik als Unit-Test in `src/domain/`; Oberfläche über Komponententest, E2E oder Referenzbild; Fehlerbehebung mit Regressionstest (`regression`-Tag).
- Berücksichtige die Leitplanken aus `CLAUDE.md` (Geld in Rappen, ein Schreibweg über `store`, Grabsteine, neue Felder optional).
- Keine Schema-Änderung ohne Hinweis unter «Risiken»: Migrationen auf das echte Supabase-Projekt nur nach Rückfrage.
