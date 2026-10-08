import { useState } from 'react'
import { buttonClass, Field, inputClass } from '../../auth/ui'
import { buildBank } from '../../domain/bank'
import { formatIban, normalizeIban } from '../../domain/iban'
import type { Settings } from '../../domain/types'
import { saveSettings } from './saveSettings'
import { Section } from './Sections'

/** Bankverbindung und Adresse für Rechnungen (Issue #104). Alle Angaben sind freiwillig. */
export function BankSection({ settings }: { settings: Settings }) {
  const bank = settings.bank
  const [holder, setHolder] = useState(bank?.holder ?? '')
  const [street, setStreet] = useState(bank?.street ?? '')
  const [zip, setZip] = useState(bank?.zip ?? '')
  const [town, setTown] = useState(bank?.town ?? '')
  const [country, setCountry] = useState<'CH' | 'LI'>(bank?.country ?? 'CH')
  const [iban, setIban] = useState(bank ? formatIban(bank.iban) : '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Solange eine andere IBAN eingegeben als gespeichert ist, gilt auf der Rechnung noch die gespeicherte (Issue #120)
  const gilt = bank?.iban && normalizeIban(iban) !== bank.iban ? bank.iban : null

  async function save() {
    setSaved(false)
    const result = buildBank({ holder, street, zip, town, country, iban })
    if (!result.ok) return setError(result.error)
    setError(null)
    await saveSettings(settings, { bank: result.bank })
    // Die bereinigte Fassung zeigen (IBAN in Vierergruppen, überflüssige Leerzeichen weg)
    setHolder(result.bank?.holder ?? '')
    setStreet(result.bank?.street ?? '')
    setZip(result.bank?.zip ?? '')
    setTown(result.bank?.town ?? '')
    setIban(result.bank ? formatIban(result.bank.iban) : '')
    setSaved(true)
  }

  return (
    <Section title="Bankverbindung">
      <p data-testid="bank-hinweis" className="text-sm text-muted">
        Diese Angaben brauchst du nur für Rechnungen. Sie werden nur verschlüsselt synchronisiert.
        In der Backup-Datei stehen sie unverschlüsselt.
      </p>
      <Field label="Kontoinhaber/in" value={holder} onChange={setHolder} required={false} />
      <Field label="Strasse und Nr." value={street} onChange={setStreet} required={false} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="PLZ" value={zip} onChange={setZip} required={false} />
        <div className="col-span-2">
          <Field label="Ort" value={town} onChange={setTown} required={false} />
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Land der Bank</span>
        <select
          className={inputClass}
          value={country}
          onChange={(e) => setCountry(e.target.value as 'CH' | 'LI')}
        >
          <option value="CH">Schweiz</option>
          <option value="LI">Liechtenstein</option>
        </select>
      </label>
      <Field
        label="IBAN"
        value={iban}
        onChange={setIban}
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
      <div className="flex items-center gap-3">
        <button className={buttonClass} onClick={() => void save()}>
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
