---
typ: entscheid
bereich: meta
status: entschieden
datum: 2026-10-08
aktualisiert: 2026-10-08
repo-quelle:
  - .claude/agents/reviewer.md
  - .claude/skills/pr-abschliessen/SKILL.md
tags:
  - typ/entscheid
  - status/entschieden
---

# Der Reviewer läuft mit Sonnet und bekommt Plan und Testergebnis mitgegeben

**Status: entschieden** (Issue #130, Teil des Umbaus aus #128)

## Frage

Am 2026-10-06 wurde entschieden: «Reviewer läuft immer mit dem günstigsten Modell (Haiku)» (siehe [[2026-10-06]]). In der Praxis lief er lange, wirkte ziellos und brauchte bei #111 vier Durchgänge ohne BEREIT. Bleibt es bei Haiku?

## Optionen

| Option | Verhalten | Kosten |
| --- | --- | --- |
| Haiku wie bisher | sucht Plan, Diff und CI selbst zusammen | günstig pro Token, viele Aufrufe, schwache Urteile |
| Sonnet mit Kontext | bekommt Plan und lokales Testergebnis, prüft keine CI beim Draft | teurer pro Token, weniger Suche |
| Opus immer | gründlichstes Urteil | für die meisten PRs zu teuer |

## Was der Code heute tut

`reviewer.md` verlangte einen CI-Beleg mit `gh pr checks`, obwohl `pr-abschliessen` den Reviewer beim Draft aufruft, wo die schwere CI noch nicht läuft. Der Skill musste ihm das jedes Mal extra sagen. Den Plan holte er sich selbst aus den Issue-Kommentaren.

## Entscheid

- `reviewer` läuft mit **Sonnet**.
- **Opus**, wenn das Issue das Label `sync` trägt oder der Diff Dateien in `src/crypto/` oder `src/sync/` ändert: Dort wäre ein übersehener Fehler am teuersten (der Server darf nie Klartext sehen).
- `pr-abschliessen` gibt ihm den Plan als Text und das Ergebnis des lokalen Testlaufs mit. Die CI bewertet er nicht.

## Begründung

Der Auftrag des Reviewers (Gegenprobe pro AK, Belege mit Datei:Zeile, Leitplanken) ist der anspruchsvollste im Ablauf; dafür ist Haiku zu knapp. Was er sich bisher selbst suchen musste, liegt beim Aufrufer ohnehin vor. Die CI-Pflicht stammte aus einem Probelauf, in dem er «Tests bestanden» behauptete, obwohl Jobs rot waren; das deckt jetzt das übergebene Testergebnis ab, und rote Tests machen ein AK höchstens «teilweise».

## Folgen

- Ein Review kostet pro Token mehr; das soll sich über weniger Aufrufe und weniger Durchgänge ausgleichen. Messung im Pilot nach #128.
- Wer den Reviewer aufruft, muss Plan und Testergebnis mitgeben, sonst meldet er die Lücke.
- Die Modellwahl pro Aufruf greift nicht, wenn `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` gesetzt ist.

Verwandt: [[StudiBudget]], [[2026-10-06]]
