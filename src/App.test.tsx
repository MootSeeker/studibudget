import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { PAGES } from './pages'

describe('App', () => {
  it('zeigt alle sieben Seiten in der Navigation', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    for (const p of PAGES) {
      expect(nav).toHaveTextContent(p.label)
    }
    expect(PAGES).toHaveLength(7)
  })

  it('leitet auf die Eingabe-Seite weiter', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Eingabe')
  })
})
