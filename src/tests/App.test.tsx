import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../app/App'
import { MockGateway } from '../realtime/MockGateway'

afterEach(() => window.localStorage.clear())

describe('UNO DUEL entry flow', () => {
  it('shows an honest configuration error instead of pretending to be online', () => {
    const gateway = { isConfigured: false } as never
    render(<App gateway={gateway} />)
    expect(screen.getByText(/Add the two Vite Supabase variables/i)).toBeInTheDocument()
    expect(screen.getByText(/will not fall back to local multiplayer/i)).toBeInTheDocument()
  })

  it('creates a room and moves into the waiting lobby through the gateway', async () => {
    const user = userEvent.setup()
    render(<App gateway={new MockGateway('ui-host', 'Alex')} />)
    await user.type(screen.getByLabelText(/Display name/i), 'Alex')
    await user.click(screen.getByRole('button', { name: /Create room/i }))
    expect(await screen.findByText(/Waiting for opponent/i)).toBeInTheDocument()
    expect(screen.getByText(/Room code/i)).toBeInTheDocument()
  })
})
