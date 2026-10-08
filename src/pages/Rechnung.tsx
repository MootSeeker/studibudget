import { Link, useParams } from 'react-router'
import { buttonClass } from '../auth/ui'
import {
  useAllTransactions,
  useCategories,
  usePersons,
  useSettings,
  useSettlements,
} from '../data/hooks'
import type { BankDetails } from '../domain/types'
import { formatIban } from '../domain/iban'
import { buildInvoice } from '../domain/invoice'
import { formatMoney } from '../domain/money'
import { buildQrPayload, isExampleIban, qrBillStatus, validateQrPayload } from '../domain/qrBill'
import { SwissQr } from '../components/SwissQr'

const day = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Rechnung an eine Person als Druckansicht (Issue #105). Zeigt nur an, schreibt nichts. */
export function Rechnung() {
  const { personId = '' } = useParams()
  const settings = useSettings()
  const persons = usePersons()
  const txs = useAllTransactions()
  const settlements = useSettlements()
  const categories = useCategories()
  if (!settings) return null

  const person = persons.find((p) => p.id === personId)
  if (!person) {
    return (
      <section className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Rechnung</h1>
        <p>Diese Person gibt es nicht.</p>
        <Link to="/ausgleich" className="text-accent underline">
          Zurück zum Ausgleich
        </Link>
      </section>
    )
  }

  const money = (c: number) => formatMoney(c, settings.country)
  const invoice = buildInvoice(personId, txs, settlements, categories)
  const bank = settings.bank
  const qr = qrBillStatus(settings.country, bank, invoice.totalCents)
  const qrPayload = qr.ok ? buildQrPayload(qr.bank, invoice.totalCents) : ''
  const qrProblems = qr.ok ? validateQrPayload(qrPayload) : []
  // Fehlt nur die Bankverbindung, sagt das schon der Hinweis oben.
  const qrHint = !qr.ok && !(settings.country === 'CH' && !bank) ? qr.reason : undefined

  return (
    <section className="max-w-3xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/ausgleich" className="text-accent underline">
          Zurück zum Ausgleich
        </Link>
        <button type="button" className={buttonClass} onClick={() => window.print()}>
          Drucken oder als PDF speichern
        </button>
      </div>

      {!bank && (
        <p role="note" className="rounded-md border border-border bg-surface p-3 text-sm">
          Du hast noch keine Bankverbindung hinterlegt. Trage sie in den{' '}
          <Link to="/einstellungen" className="text-accent underline">
            Einstellungen
          </Link>{' '}
          ein, damit sie auf der Rechnung steht.
        </p>
      )}

      {qr.ok && isExampleIban(qr.bank.iban) && (
        <p
          role="note"
          className="rounded-md border border-border bg-surface p-3 text-sm print:hidden"
        >
          Das ist die Beispiel-IBAN aus der Dokumentation der Banken, keine echte Kontonummer. Eine
          Zahlung mit diesem Zahlteil kann nicht ankommen. Trage deine eigene IBAN in den
          Einstellungen ein.
        </p>
      )}
      {qrProblems.length > 0 && (
        <p
          role="note"
          className="rounded-md border border-border bg-surface p-3 text-sm print:hidden"
        >
          Der Zahlteil kann nicht erstellt werden: {qrProblems.join(' ')}
        </p>
      )}
      {qrHint && (
        <p
          role="note"
          className="rounded-md border border-border bg-surface p-3 text-sm print:hidden"
        >
          {qrHint}
        </p>
      )}

      <article aria-labelledby="rechnung-titel" className="space-y-6">
        <header className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 id="rechnung-titel" className="text-2xl font-semibold">
              Rechnung
            </h1>
            <p>Rechnungsdatum: {day(todayIso())}</p>
            <p>An: {person.name}</p>
          </div>
          {bank && (
            <address className="not-italic">
              {bank.holder}
              <br />
              {bank.street}
              <br />
              {bank.zip} {bank.town}
              <br />
              IBAN {formatIban(bank.iban)}
            </address>
          )}
        </header>

        <table className="w-full text-sm">
          <caption className="sr-only">Positionen und Abzüge</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-1 pr-3">
                Datum
              </th>
              <th scope="col" className="py-1 pr-3">
                Beschreibung
              </th>
              <th scope="col" className="py-1 text-right">
                Betrag
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.positions.map((l, i) => (
              <tr key={`p${i}`} className="border-b border-border">
                <td className="py-1 pr-3">{day(l.date)}</td>
                <td className="py-1 pr-3">{l.description}</td>
                <td className="py-1 text-right tabular-nums">{money(l.cents)}</td>
              </tr>
            ))}
            {invoice.deductions.length > 0 && (
              <tr>
                <th scope="rowgroup" colSpan={3} className="pt-3 pb-1 text-left">
                  Bereits bezahlt
                </th>
              </tr>
            )}
            {invoice.deductions.map((l, i) => (
              <tr key={`d${i}`} className="border-b border-border">
                <td className="py-1 pr-3">{day(l.date)}</td>
                <td className="py-1 pr-3">{l.description}</td>
                <td className="py-1 text-right tabular-nums">{money(l.cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" colSpan={2} className="pt-3 text-left">
                Total
              </th>
              <td className="pt-3 text-right tabular-nums">{money(invoice.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </article>

      {qr.ok && qrProblems.length === 0 && (
        <section
          aria-label="Zahlteil"
          className="flex h-[105mm] w-[210mm] max-w-full border-t border-dashed border-black bg-white p-[5mm] text-black print:fixed print:bottom-0 print:left-0 print:max-w-none print:border-t print:break-inside-avoid"
        >
          <div className="w-[62mm] border-r border-dashed border-black pr-[5mm] text-[8pt] leading-tight">
            <h2 className="text-[11pt] font-bold">Empfangsschein</h2>
            <PaymentParty title="Konto / Zahlbar an" bank={qr.bank} />
            <PaymentParty title="Zahlbar durch" name={person.name} />
            <Amount cents={invoice.totalCents} small />
          </div>
          <div className="flex-1 pl-[5mm] text-[8pt] leading-tight">
            <h2 className="text-[11pt] font-bold">Zahlteil</h2>
            <div className="flex gap-[5mm]">
              <div>
                <SwissQr payload={qrPayload} label="Swiss QR Code zur Zahlung" />
                <Amount cents={invoice.totalCents} />
              </div>
              <div>
                <PaymentParty title="Konto / Zahlbar an" bank={qr.bank} />
                <PaymentParty title="Zahlbar durch" name={person.name} />
              </div>
            </div>
          </div>
        </section>
      )}
    </section>
  )
}

function PaymentParty({ title, bank, name }: { title: string; bank?: BankDetails; name?: string }) {
  return (
    <div className="mt-2">
      <h3 className="font-bold">{title}</h3>
      {bank ? (
        <p>
          {formatIban(bank.iban)}
          <br />
          {bank.holder}
          <br />
          {bank.street}
          <br />
          {bank.zip} {bank.town}
        </p>
      ) : (
        <p>{name}</p>
      )}
    </div>
  )
}

function Amount({ cents, small }: { cents: number; small?: boolean }) {
  return (
    <div className={`mt-2 flex gap-6 ${small ? '' : 'text-[10pt]'}`}>
      <p>
        <b>Währung</b>
        <br />
        CHF
      </p>
      <p>
        <b>Betrag</b>
        <br />
        {formatMoney(cents, 'CH').replace(/^CHF\s?/, '')}
      </p>
    </div>
  )
}
