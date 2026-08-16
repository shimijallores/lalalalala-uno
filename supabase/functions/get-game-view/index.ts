import { fail, json, makePrivateView, options, readRoom, requireUser } from '../_shared/server.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options()
  try {
    const { id: playerId, service } = await requireUser(request)
    const body = await request.json() as { roomId?: string }
    if (!body.roomId) return fail('A room is required to refresh the table.', 'missing_room')
    const current = await readRoom(service, body.roomId)
    if (!current.players.some((player) => player.player_id === playerId)) return fail('You are not a player in this room.', 'not_a_player', 403)
    return json(makePrivateView(current.room, current.players, current.state, playerId))
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'We could not refresh the table.', 'view_failed', 500)
  }
})
