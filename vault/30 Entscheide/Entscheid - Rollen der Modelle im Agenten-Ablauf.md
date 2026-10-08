---
typ: entscheid
bereich: meta
status: entschieden
datum: 2026-10-08
aktualisiert: 2026-10-08
repo-quelle:
  - .claude/agents/planer.md
  - .claude/agents/umsetzer.md
  - .claude/skills/issue-bearbeiten/SKILL.md
  - .claude/skills/pr-abschliessen/SKILL.md
  - .claude/hooks/guard-bash.mjs
tags:
  - typ/entscheid
  - status/entschieden
---

# Opus plant, Haiku setzt um, Sonnet steuert

**Status: entschieden** (Issue #128; Grundlagen #129 `verify:kurz` und #130 Reviewer, siehe [[Entscheid - Reviewer mit Sonnet]])

## Frage

Die Arbeit mit Claude soll günstiger werden, ohne dass die Qualität leidet. Bisher erledigte die Hauptsitzung Plan, Umsetzung und Abschluss mit einem Modell. Welches Modell übernimmt welche Rolle?

## Optionen

| Option | Verhalten | Kosten |
| --- | --- | --- |
| Ein Modell für alles | einfach, keine Übergaben | Umsetzung, der grösste Teil der Tokens, läuft auf dem teuren Modell |
| Opus plant, Sonnet setzt um | robuste Umsetzung | Umsetzung bleibt teuer |
| Opus plant, Haiku setzt um, Sonnet steuert | Umsetzung auf dem günstigsten Modell | Plan muss vollständig sein; mehr Übergaben |

## Was der Code heute tut

`issue-bearbeiten` und `pr-abschliessen` führten die Hauptsitzung durch Plan, Tests zuerst, Umsetzung und Review; nur der Reviewer war ein eigener Subagent.

## Entscheid

- **Hauptsitzung (Sonnet)** steuert nur. Sie leitet Meldungen unverändert weiter, entscheidet nichts inhaltlich und stellt als Einzige Fragen an den Nutzer (Subagenten haben kein `AskUserQuestion`).
- **`planer` (Opus)** schreibt einen Plan, den ein kleines Modell ohne eigene Entscheidungen ausführen kann (Vorlage in `plan-schreiben`), und beantwortet jede Rückfrage mit einem Nachtrag.
- **`umsetzer` (Haiku)** führt aus. Vor der Umsetzung liest er den Plan im **Trockenlauf** und listet jede Stelle, an der er wählen müsste. Bei Lücken meldet er «PLAN UNKLAR», statt zu raten.
- **Durchsetzung statt Hoffnung:** Der Git-Wächter sperrt für `agent_type == "umsetzer"` Commit, Push und `gh`; `verify:kurz --plan` meldet rot, wenn Dateien ausserhalb des Plans geändert wurden oder geplante Tests fehlen.
- **Runden:** Beim ersten Rot bessert der Umsetzer selbst nach, beim zweiten entscheidet der Planer. Höchstens drei Nachbesserungen des Planers pro Lauf, dann fragt die Hauptsitzung.
- **Ende beim Draft-PR**; freigegeben wird nur auf Anweisung des Nutzers. Grösse Klein bleibt ohne Subagenten.

## Begründung

Haiku kostet pro Token einen Bruchteil von Sonnet und Opus. Die Umsetzung (Dateien lesen, schreiben, Tests laufen lassen) verbraucht die meisten Tokens, braucht aber wenig Urteil, wenn der Plan alles festlegt. Das Urteil wird in den Plan verlegt, wo Opus es einmal fällt. Der Trockenlauf prüft genau die Eigenschaft, auf die es ankommt: ob dieses Modell den Plan ohne Erfinden ausführen kann. Der Reviewer prüft den Plan bewusst nicht, damit er die Umsetzung später unabhängig beurteilt.

## Folgen

- Der Plan ist der Hebel: Ein schwacher Plan wirkt sich auf jeden folgenden Schritt aus.
- Mehr Übergaben; jeder Subagent liest sich neu ein. Ob sich das rechnet, zeigt der Pilot mit 2–3 echten Issues (Tokens pro Modell, Runden, Nacharbeit).
- Haiku kostet über 100K Tokens Prompt fünfmal mehr; der Plan hält den Kontext des Umsetzers klein.
- Sitzungen für den Ablauf mit Sonnet starten: `model` im Skill gilt nur bis zum Ende des Zugs.

Verwandt: [[StudiBudget]], [[Entscheid - Reviewer mit Sonnet]]
