# Sicherheitsrichtlinie

StudiBudget speichert Budgetdaten Ende-zu-Ende-verschlüsselt; der Server sieht nie Klartext. Wenn du eine Schwachstelle findest, melde sie bitte verantwortungsvoll.

## Unterstützte Versionen

Sicherheitskorrekturen gibt es für die jeweils aktuelle Version (siehe [CHANGELOG.md](CHANGELOG.md)). Die App aktualisiert sich als PWA selbst.

## Schwachstelle melden

Eröffne **kein öffentliches Issue** mit Details. Nutze stattdessen den Reiter «Security» des Repositories und dort «Report a vulnerability» (vertrauliche Meldung an die Projektverantwortlichen).

Bitte nenne, soweit möglich: betroffener Bereich (z. B. Verschlüsselung, Sync, Anmeldung), Schritte zum Nachstellen und die möglichen Folgen. Schicke keine echten Nutzerdaten.

Wir bestätigen die Meldung so bald wie möglich, melden uns mit einer Einschätzung und nennen dich auf Wunsch in den Änderungen, sobald die Lücke behoben ist.

## Im Rahmen

- Verschlüsselung (`src/crypto/`), Sync (`src/sync/`), Anmeldung, Row-Level-Security in `supabase/`
- die veröffentlichte App

Nicht im Rahmen: Angriffe auf fremde Dienste (GitHub, Supabase selbst), Denial-of-Service, Social Engineering.
