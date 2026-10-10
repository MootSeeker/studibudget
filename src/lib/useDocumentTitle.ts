import { useEffect } from 'react'

/** Setzt den Dokumenttitel «Seite – StudiBudget» (Tabs, Verlauf, Screenreader; WCAG 2.4.2). */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} – StudiBudget`
  }, [title])
}
