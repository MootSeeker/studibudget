import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'onFocus' | 'defaultValue'
> & {
  /** Gespeicherter Wert, schon formatiert. */
  value: string
  /**
   * Wird beim Verlassen des Feldes mit dem getippten Text aufgerufen. `false` heisst «nichts geändert / abgelehnt»,
   * dann zeigt das Feld wieder den gespeicherten Wert; eine Exception wirkt genauso.
   */
  onCommit: (text: string) => boolean | void | Promise<boolean | void>
}

/**
 * Eingabefeld, das den getippten Text behält, solange man darin schreibt, auch wenn sich der gespeicherte Wert
 * zwischendurch ändert (Speichern kommt zurück, ein anderes Gerät synchronisiert). Erst wenn der gespeicherte Wert
 * danach ein anderer ist, zeigt das Feld ihn an.
 */
export function DraftInput({ value, onCommit, ...rest }: Props) {
  const [draft, setDraft] = useState<{ text: string; base: string } | null>(null)
  const [focused, setFocused] = useState(false)
  const shown = draft && (focused || draft.base === value) ? draft.text : value

  return (
    <input
      {...rest}
      value={shown}
      onFocus={() => {
        setFocused(true)
        // Ein Entwurf zu einem früheren gespeicherten Wert ist veraltet.
        if (draft && draft.base !== value) setDraft(null)
      }}
      onChange={(e) =>
        // Basis bleibt nur, solange der Entwurf noch zum gespeicherten Wert gehört oder man gerade darin tippt.
        setDraft({
          text: e.target.value,
          base: draft && (focused || draft.base === value) ? draft.base : value,
        })
      }
      onBlur={async (e) => {
        setFocused(false)
        const text = e.target.value
        if (text === value) return setDraft(null)
        try {
          const changed = await onCommit(text)
          if (changed === false) setDraft(null)
        } catch {
          setDraft(null)
        }
      }}
    />
  )
}
