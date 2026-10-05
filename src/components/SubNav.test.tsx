import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Collapsible } from './Collapsible'
import { SubNav } from './SubNav'
import { useState } from 'react'

const ITEMS = [
  { id: 'eins', label: 'Eins' },
  { id: 'zwei', label: 'Zwei' },
]
const Ort = () => <p data-testid="ort">{useLocation().search}</p>
const zeige = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SubNav param="a" items={ITEMS} label="Test" />
      <Ort />
    </MemoryRouter>,
  )

describe('SubNav', () => {
  it('markiert den ersten Reiter, wenn nichts oder Unbekanntes in der Adresse steht', () => {
    zeige('/x?a=nix')
    expect(screen.getByRole('button', { name: 'Eins' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Zwei' })).not.toHaveAttribute('aria-current')
  })

  it('ein Klick setzt die Adresse; der erste Reiter entfernt den Parameter', async () => {
    const user = userEvent.setup()
    zeige('/x')
    await user.click(screen.getByRole('button', { name: 'Zwei' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('?a=zwei')
    expect(screen.getByRole('button', { name: 'Zwei' })).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('button', { name: 'Eins' }))
    expect(screen.getByTestId('ort')).toHaveTextContent(/^$/)
  })

  it('andere Parameter der Adresse bleiben erhalten', async () => {
    const user = userEvent.setup()
    zeige('/x?b=1')
    await user.click(screen.getByRole('button', { name: 'Zwei' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('?b=1&a=zwei')
  })
})

describe('Collapsible', () => {
  function Demo() {
    const [open, setOpen] = useState(false)
    return (
      <Collapsible
        title="Wohnen"
        summary="3 Kategorien"
        open={open}
        onToggle={() => setOpen(!open)}
      >
        <p>Inhalt</p>
      </Collapsible>
    )
  }

  it('zeigt den Inhalt erst nach dem Aufklappen und meldet aria-expanded', async () => {
    const user = userEvent.setup()
    render(<Demo />)
    const kopf = screen.getByRole('button', { name: /Wohnen/ })
    expect(kopf).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Inhalt')).not.toBeInTheDocument()
    expect(kopf).toHaveTextContent('3 Kategorien')
    await user.click(kopf)
    expect(kopf).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
    expect(kopf).toHaveAttribute('aria-controls', screen.getByText('Inhalt').parentElement!.id)
  })

  it('lässt sich mit der Tastatur bedienen', async () => {
    const user = userEvent.setup()
    render(<Demo />)
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
    await user.keyboard(' ')
    expect(screen.queryByText('Inhalt')).not.toBeInTheDocument()
  })
})
