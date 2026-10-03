import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate'
import { checkPassword, MIN_PASSWORD_LENGTH } from './flows'

const auth = {
  configured: true,
  state: { status: 'out', email: null, notice: null } as Record<string, unknown>,
}
vi.mock('./AuthProvider', () => ({ useAuth: () => auth }))

beforeEach(() => {
  auth.configured = true
  auth.state = { status: 'out', email: null, notice: null }
})

describe('AuthGate', () => {
  it('ohne Serverkonfiguration erscheint ein Hinweis statt der App', () => {
    auth.configured = false
    render(<AuthGate>GEHEIM</AuthGate>)
    expect(screen.getByText('Server nicht konfiguriert')).toBeInTheDocument()
    expect(screen.queryByText('GEHEIM')).not.toBeInTheDocument()
  })
  it('abgemeldet zeigt die Anmeldung und nicht die App', () => {
    render(<AuthGate>GEHEIM</AuthGate>)
    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.queryByText('GEHEIM')).not.toBeInTheDocument()
  })
  it('zeigt einen Hinweis nach dem Bestätigungslink', () => {
    auth.state = {
      status: 'out',
      email: null,
      notice: 'E-Mail bestätigt. Bitte melde dich jetzt an.',
    }
    render(<AuthGate>x</AuthGate>)
    expect(screen.getByRole('status')).toHaveTextContent('E-Mail bestätigt')
  })
  it('im Wiederherstellungsmodus verlangt die Seite den Schlüssel', () => {
    auth.state = { status: 'recovery', email: 'a@b.ch', notice: null }
    render(<AuthGate>GEHEIM</AuthGate>)
    expect(screen.getByLabelText('Wiederherstellungsschlüssel')).toBeInTheDocument()
    expect(screen.queryByText('GEHEIM')).not.toBeInTheDocument()
  })
  it('angemeldet zeigt die App', () => {
    auth.state = { status: 'in', email: 'a@b.ch', notice: null }
    render(<AuthGate>GEHEIM</AuthGate>)
    expect(screen.getByText('GEHEIM')).toBeInTheDocument()
  })
})

describe('Rechtliche Seiten vor der Anmeldung', () => {
  it('Datenschutz und Impressum sind von der Anmeldung aus erreichbar und führen zurück', async () => {
    const user = userEvent.setup()
    render(<AuthGate>GEHEIM</AuthGate>)
    await user.click(screen.getByRole('button', { name: 'Datenschutz' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeInTheDocument()
    expect(screen.queryByText('GEHEIM')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Zurück' }))
    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Impressum' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument()
  })
})

describe('Passwortregel', () => {
  it('verlangt mindestens 12 Zeichen', () => {
    expect(checkPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull()
    expect(checkPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
  })
})
