import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameBoard } from '../components/GameBoard'
import type { PrivatePlayerView } from '../game/types'

const redEight = { id: 'red-number-8', color: 'red' as const, kind: 'number' as const, number: 8, assetKey: 'Red_8', label: 'Red 8' }
const blueTwo = { id: 'blue-number-2', color: 'blue' as const, kind: 'number' as const, number: 2, assetKey: 'Blue_2', label: 'Blue 2' }
const wild = { id: 'wild-1', color: 'wild' as const, kind: 'wild' as const, assetKey: 'Wild', label: 'Wild' }
const top = { id: 'red-number-7', color: 'red' as const, kind: 'number' as const, number: 7, assetKey: 'Red_7', label: 'Red 7' }

const view: PrivatePlayerView = {
  roomId: 'room-1',
  roomCode: 'DUEL42',
  status: 'active',
  hostPlayerId: 'me',
  players: [
    { id: 'me', displayName: 'Alex', slot: 1, isHost: true, isOnline: true, handCount: 3, score: 0 },
    { id: 'them', displayName: 'Sam', slot: 2, isHost: false, isOnline: true, handCount: 5, score: 0 },
  ],
  currentPlayerId: 'me',
  currentColor: 'red',
  turnDeadlineAt: new Date(Date.now() + 30000).toISOString(),
  drawnCardId: null,
  topDiscard: top,
  drawPileCount: 87,
  scores: { me: 0, them: 0 },
  turnPhase: 'playing',
  lastAction: null,
  unoPendingPlayerId: null,
  unoCalled: false,
  stateVersion: 12,
  opponentDisconnectedAt: null,
  rematchRequestedBy: null,
  selfPlayerId: 'me',
  ownHand: [redEight, blueTwo, wild],
  legalActions: ['play-card', 'draw-card'],
}

describe('GameBoard', () => {
  it('highlights legal cards, disables illegal cards, and keeps opponent identities redacted', () => {
    render(<GameBoard view={view} connection="connected" pending={null} error={null} onCommand={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Play Red 8' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Play Blue 2' })).toBeDisabled()
    expect(screen.getByLabelText(/5 opponent cards, identities hidden/i)).toBeInTheDocument()
  })

  it('opens the required color picker for a Wild card', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn().mockResolvedValue(true)
    const { rerender } = render(<GameBoard view={view} connection="connected" pending={null} error={null} onCommand={onCommand} onLeave={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Play Wild' }))
    expect(onCommand).toHaveBeenCalledWith('play_card', { cardId: 'wild-1' })

    rerender(<GameBoard view={{ ...view, stateVersion: 13, turnPhase: 'choose-color', topDiscard: wild, ownHand: [redEight, blueTwo], players: view.players.map((player) => player.id === 'me' ? { ...player, handCount: 2 } : player) }} connection="connected" pending={null} error={null} onCommand={onCommand} onLeave={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: /Pick the next color/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose yellow' }))
    expect(onCommand).toHaveBeenCalledWith('choose_color', { cardId: 'wild-1', color: 'yellow' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Pick the next color/i })).not.toBeInTheDocument())
  })
})
