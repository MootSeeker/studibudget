import { inputClass } from '../auth/ui'
import { MONTH_NAMES } from '../lib/months'

/** Monat 1–12 auswählen. */
export function MonthSelect(props: {
  label: string
  value: number
  onChange: (m: number) => void
}) {
  return (
    <select
      aria-label={props.label}
      className={inputClass}
      value={props.value}
      onChange={(e) => props.onChange(Number(e.target.value))}
    >
      {MONTH_NAMES.map((n, i) => (
        <option key={n} value={i + 1}>
          {n}
        </option>
      ))}
    </select>
  )
}
