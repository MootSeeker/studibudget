---
typ: entscheid
bereich: produkt
status: entschieden
datum: 2026-10-04
aktualisiert: 2026-10-04
repo-quelle:
  - src/domain/templates.ts
tags:
  - typ/entscheid
  - status/entschieden
---

# Grosse Intervalle über Vorlagen und Rückstellungs-Hinweis

**Status: entschieden** (Issue #18)

## Frage

Einnahmen und Ausgaben, die jährlich oder vierteljährlich anfallen: als Budget pro Jahr, als Verteilung auf Monate oder anders?

## Entscheid

- Das Intervall ist nur eine Eingabehilfe über den Fälligkeitsmonaten der Fixkosten-Vorlage (`Template.months`); keine Migration.
- Grosse Posten zählen weiter im Zahlungsmonat (Entscheid aus der Planung).
- Die «Verteilung auf Monate» ist nur ein **Hinweis** (Jahresbetrag ÷ 12) auf Monats- und Budgetseite; Saldo und Ampel bleiben
  unverändert, pro Vorlage abschaltbar.
- Nicht gebaut: Budgets pro Jahr/Quartal, Ansicht «verteilt» in Monat und Statistik.
