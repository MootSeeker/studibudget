import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DraftInput } from './DraftInput'

function Harness({
  initial,
  onCommit,
}: {
  initial: string
  onCommit: (t: string) => boolean | void | Promise<boolean | void>
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DraftInput aria-label="Betrag" value={value} onCommit={onCommit} />
      <button onClick={() => setValue('999.00')}>Extern ändern</button>
    </>
  )
}

describe('DraftInput', () => {
  it('behält den getippten Text, wenn sich der gespeicherte Wert währenddessen ändert (Sync, Speichern kommt zurück)', async () => {
    const user = userEvent.setup()
    render(<Harness initial="800.00" onCommit={() => {}} />)
    const input = screen.getByLabelText('Betrag')
    await user.clear(input)
    await user.type(input, '85')
    fireEvent.click(screen.getByText('Extern ändern')) // Wert ändert sich mitten im Tippen
    expect(input).toHaveValue('85')
    await user.type(input, '0')
    expect(input).toHaveValue('850')
  })

  it('ruft onCommit beim Verlassen mit dem Text auf, nicht bei unverändertem Wert', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<Harness initial="800.00" onCommit={onCommit} />)
    const input = screen.getByLabelText('Betrag')
    await user.click(input)
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, '850')
    await user.tab()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('850')
  })

  it('zeigt nach dem Verlassen den neuen gespeicherten Wert, sobald er da ist', async () => {
    const user = userEvent.setup()
    render(<Harness initial="800.00" onCommit={() => {}} />)
    const input = screen.getByLabelText('Betrag')
    await user.clear(input)
    await user.type(input, '850')
    await user.tab()
    expect(input).toHaveValue('850') // noch nicht gespeichert: getippter Text bleibt stehen, kein Flackern
    fireEvent.click(screen.getByText('Extern ändern'))
    expect(input).toHaveValue('999.00')
  })

  it('bei abgelehntem Wert (false oder Exception) erscheint wieder der gespeicherte', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Harness initial="800.00" onCommit={() => false} />)
    const input = screen.getByLabelText('Betrag')
    await user.clear(input)
    await user.type(input, 'abc')
    await user.tab()
    expect(input).toHaveValue('800.00')
    rerender(<Harness initial="800.00" onCommit={() => Promise.reject(new Error('ungültig'))} />)
    await user.clear(input)
    await user.type(input, 'xyz')
    await user.tab()
    await vi.waitFor(() => expect(input).toHaveValue('800.00'))
  })

  it('ein neuer Entwurf geht vom aktuell gespeicherten Wert aus, nicht von einem früheren (Regression)', async () => {
    const onCommit = vi.fn()
    render(<Harness initial="800.00" onCommit={onCommit} />)
    const input = screen.getByLabelText('Betrag')
    fireEvent.change(input, { target: { value: '850' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenLastCalledWith('850')
    fireEvent.click(screen.getByText('Extern ändern')) // gespeichert: 999.00
    expect(input).toHaveValue('999.00')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenLastCalledWith('')
    expect(onCommit).toHaveBeenCalledTimes(2)
  })
})
