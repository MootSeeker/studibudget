import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Card, Field, Form } from './ui'

describe('Form', { tags: ['negativ'] }, () => {
  it('zeigt eine Fehlermeldung, wenn das Absenden scheitert, und gibt den Knopf wieder frei', async () => {
    const user = userEvent.setup()
    render(
      <Form submitLabel="Los" onSubmit={() => Promise.reject(new Error('Nicht erreichbar'))}>
        <p>Inhalt</p>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Los' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nicht erreichbar')
    expect(screen.getByRole('button', { name: 'Los' })).toBeEnabled()
  })
  it('ein Fehler ohne Meldung wird zu «Unbekannter Fehler.»', async () => {
    const user = userEvent.setup()
    render(
      <Form submitLabel="Los" onSubmit={() => Promise.reject('kein Error-Objekt')}>
        x
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Los' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unbekannter Fehler.')
  })
  it('während des Absendens ist der Knopf gesperrt, ein früherer Fehler verschwindet', async () => {
    const user = userEvent.setup()
    let finish: () => void = () => {}
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Erster Versuch'))
      .mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
    render(
      <Form submitLabel="Los" onSubmit={onSubmit}>
        x
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Los' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Los' }))
    expect(await screen.findByRole('button', { name: 'Einen Moment …' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    finish()
    expect(await screen.findByRole('button', { name: 'Los' })).toBeEnabled()
  })
})

describe('Field und Card', () => {
  function Demo() {
    const [v, setV] = useState('')
    return <Field label="E-Mail" value={v} onChange={setV} hint="Dein Konto" />
  }
  it('Beschriftung gehört zum Feld, Hinweis wird gezeigt, Eingaben kommen an', async () => {
    render(<Demo />)
    await userEvent.setup().type(screen.getByLabelText('E-Mail'), 'a@b.ch')
    expect(screen.getByLabelText('E-Mail')).toHaveValue('a@b.ch')
    expect(screen.getByLabelText('E-Mail')).toBeRequired()
    expect(screen.getByText('Dein Konto')).toBeInTheDocument()
  })
  it('Card zeigt Titel und Inhalt', () => {
    render(<Card title="Anmelden">Inhalt</Card>)
    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })
})
