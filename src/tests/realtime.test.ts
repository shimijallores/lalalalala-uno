import { GatewayError } from '../game/types'
import { MockGateway } from '../realtime/MockGateway'

describe('realtime command boundary', () => {
  it('rejects a room with a third player', async () => {
    const host = new MockGateway('host-capacity', 'Alex')
    const first = new MockGateway('first-capacity', 'Sam')
    const third = new MockGateway('third-capacity', 'Jo')
    const room = await host.createRoom('Alex')
    await first.joinRoom(room.roomCode, 'Sam')
    await expect(third.joinRoom(room.roomCode, 'Jo')).rejects.toMatchObject({ code: 'room_full' })
  })

  it('rejects a wrong-player command and a stale state version', async () => {
    const host = new MockGateway('host-turn', 'Alex')
    const opponent = new MockGateway('opponent-turn', 'Sam')
    const room = await host.createRoom('Alex')
    const joined = await opponent.joinRoom(room.roomCode, 'Sam')
    const started = await host.sendCommand({ action: 'start_game', roomId: room.roomId, expectedStateVersion: joined.stateVersion, clientActionId: 'start-turn' })
    await expect(opponent.sendCommand({ action: 'draw_card', roomId: room.roomId, expectedStateVersion: started.stateVersion, clientActionId: 'wrong-turn' })).rejects.toBeInstanceOf(GatewayError)
    await expect(host.sendCommand({ action: 'draw_card', roomId: room.roomId, expectedStateVersion: started.stateVersion - 1, clientActionId: 'stale-turn' })).rejects.toMatchObject({ code: 'stale_version' })
  })
})
