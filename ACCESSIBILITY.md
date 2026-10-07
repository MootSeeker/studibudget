# Barrierefreiheit

StudiBudget soll für alle bedienbar sein, auch mit Tastatur, Screenreader oder hohem Kontrast.

## Unser Ziel

Wir streben die [WCAG 2.2](https://www.w3.org/TR/WCAG22/) auf Stufe AA an.

## Was wir tun

- Eine automatische Prüfung mit axe (WCAG 2.0 bis 2.2, A und AA) läuft über alle Seiten, im hellen und dunklen Design, auf Handy- und Desktop-Grösse. Sie ist Teil der CI; Ausnahmen brauchen eine Issue-Nummer (siehe [docs/testing.md](docs/testing.md)).
- Bedienung per Tastatur, sichtbarer Fokus, «Zum Inhalt springen»-Knopf, Seitentitel pro Seite.
- Helles und dunkles Design.

## Unterstützte Umgebung

Aktuelle Versionen gängiger Browser (Chromium-basiert, Firefox, Safari) auf Desktop und Handy.

## Bekannte Einschränkungen

Automatische Prüfungen finden nur einen Teil der Probleme. Eine umfassende manuelle Prüfung mit Screenreadern steht noch aus. Bekannte Ausnahmen stehen in `AUSNAHMEN` in `e2e/barrierefreiheit.spec.ts`.

## Hindernis melden

Stösst du auf eine Barriere, lege ein [Issue](https://github.com/MootSeeker/studibudget/issues/new/choose) mit dem Fehlerformular an und nenne Seite, Gerät, Browser und ggf. die Hilfstechnik. Wir kümmern uns darum.
