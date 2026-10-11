import { useState } from 'react'
import { buttonClass, Field, inputClass } from '../../auth/ui'
import { buildBank } from '../../domain/bank'
import { formatIban, normalizeIban } from '../../domain/iban'
import type { BankDetails, Settings } from '../../domain/types'
import { saveSettings } from './saveSettings'
import { useSectionDraft } from './useSectionDraft'
import { Section } from './Sections'
import { useRegisterUnsaved } from './useUnsaved'

type BankDraft = {
  holder: string
  street: string
  zip: string
  town: string
  country: 'CH' | 'LI'
  iban: string
}

function toDraft(b: BankDetails | undefined): BankDraft {
  return {
    holder: b?.holder ?? '',
    street: b?.street ?? '',
    zip: b?.zip ?? '',
    town: b?.town ?? '',
    country: b?.country ?? 'CH',
    iban: b ? formatIban(b.iban) : '',
  }
}

/** Bankverbindung und Adresse für Rechnungen (Issue #104). Alle Angaben sind freiwillig. */
export function BankSection({ settings }: { settings: Settings }) {
  const d = useSectionDraft(toDraft(settings.bank))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const edit = (next: BankDraft) => {
    setSaved(false)
    d.setDraft(next)
  }

  // Solange eine andere IBAN eingegeben als gespeichert ist, gilt auf der Rechnung noch die gespeicherte (Issue #120)
  const gilt =
    settings.bank?.iban && normalizeIban(d.draft.iban) !== settings.bank.iban
      ? settings.bank.iban
      : null

  async function save(force = false): Promise<boolean> {
    if (d.stale && !force) return false
    setSaved(false)
    const result = buildBank({
      holder: d.draft.holder,
      street: d.draft.street,
      zip: d.draft.zip,
      town: d.draft.town,
      country: d.draft.country,
      iban: d.draft.iban,
    })
    if (!result.ok) {
      setError(result.error)
      return false
    }
    setError(null)
    try {
      await saveSettings(settings, { bank: result.bank })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
      return false
    }
    // Die bereinigte Fassung zeigen (IBAN in Vierergruppen, überflüssige Leerzeichen weg)
    d.markSaved(toDraft(result.bank))
    setSaved(true)
    return true
  }
  useRegisterUnsaved('bank', d.dirty, { save: () => save(), discard: d.reset })

  return (
    <Section title="Bankverbindung">
      <p data-testid="bank-hinweis" className="text-sm text-muted">
        Diese Angaben brauchst du nur für Rechnungen. Sie werden nur verschlüsselt synchronisiert.
        In der Backup-Datei stehen sie unverschlüsselt.
      </p>
      {d.stale && (
        <div className="space-y-2">
          <p role="note" className="text-sm">
            Die gespeicherten Werte haben sich geändert.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2"
              onClick={d.adoptSaved}
            >
              Gespeicherte Werte übernehmen
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2"
              onClick={() => void save(true)}
            >
              Trotzdem speichern
            </button>
          </div>
        </div>
      )}
      <Field
        label="Kontoinhaber/in"
        value={d.draft.holder}
        onChange={(v) => edit({ ...d.draft, holder: v })}
        required={false}
      />
      <Field
        label="Strasse und Nr."
        value={d.draft.street}
        onChange={(v) => edit({ ...d.draft, street: v })}
        required={false}
      />
      <div className="grid grid-cols-3 gap-3">
        <Field
          label="PLZ"
          value={d.draft.zip}
          onChange={(v) => edit({ ...d.draft, zip: v })}
          required={false}
        />
        <div className="col-span-2">
          <Field
            label="Ort"
            value={d.draft.town}
            onChange={(v) => edit({ ...d.draft, town: v })}
            required={false}
          />
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Land der Bank</span>
        <select
          className={inputClass}
          value={d.draft.country}
          onChange={(e) => edit({ ...d.draft, country: e.target.value as 'CH' | 'LI' })}
        >
          <option value="CH">Schweiz</option>
          <option value="LI">Liechtenstein</option>
        </select>
      </label>
      <Field
        label="IBAN"
        value={d.draft.iban}
        onChange={(v) => edit({ ...d.draft, iban: v })}
        required={false}
        hint="Schweizer oder Liechtensteiner IBAN, zum Beispiel CH93 0076 2011 6238 5295 7."
      />
      {gilt && (
        <p data-testid="bank-iban-gilt" className="text-sm text-muted">
          Gespeichert ist noch {formatIban(gilt)}; diese IBAN steht weiterhin auf der Rechnung.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {d.dirty && <p className="text-sm text-amber-700">Nicht gespeichert</p>}
      <div className="flex items-center gap-3">
        <button className={buttonClass} disabled={d.stale} onClick={() => void save()}>
          Bankverbindung speichern
        </button>
        {saved && (
          <span role="status" className="text-sm">
            Gespeichert.
          </span>
        )}
      </div>
    </Section>
  )
}
