import { MockGateway } from '../realtime/MockGateway'

describe('player view redaction', () => {
  it('returns only the authenticated player hand and public opponent count', async () => {
    const host = new MockGateway('host', 'Alex')
    const opponent = new MockGateway('opponent', 'Sam')
    const created = await host.createRoom('Alex')
    const joined = await opponent.joinRoom(created.roomCode, 'Sam')
    const hostView = await host.getGameView(created.roomId)
    expect(hostView.ownHand).toEqual([])
    expect(hostView.players.find((player) => player.id === 'opponent')?.handCount).toBe(0)
    expect('opponentHand' in hostView).toBe(false)
    expect('drawPile' in hostView).toBe(false)
    expect(joined.ownHand).toEqual([])
  })
})
