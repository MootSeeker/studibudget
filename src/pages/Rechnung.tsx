import { Link, useParams } from 'react-router'
import { buttonClass } from '../auth/ui'
import {
  useAllTransactions,
  useCategories,
  usePersons,
  useSettings,
  useSettlements,
} from '../data/hooks'
import { formatIban } from '../domain/iban'
import { buildInvoice } from '../domain/invoice'
import { formatMoney } from '../domain/money'

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
    </section>
  )
}
