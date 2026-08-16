import {
  action,
  createWaitingState,
  fail,
  json,
  makePrivateView,
  makeRoomCode,
  options,
  requireUser,
} from '../_shared/server.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options()
  try {
    const { id: playerId, service } = await requireUser(request)
    const body = await request.json() as { displayName?: string }
    const displayName = body.displayName?.trim()
    if (!displayName || displayName.length > 20) return fail('Choose a display name between 1 and 20 characters.', 'invalid_name')

    let roomCode = makeRoomCode()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: existing } = await service.from('uno_rooms').select('id').eq('room_code', roomCode).maybeSingle()
      if (!existing) break
      roomCode = makeRoomCode()
    }

    const waitingState = createWaitingState()
    const { data: room, error: roomError } = await service.from('uno_rooms').insert({
      room_code: roomCode,
      host_player_id: playerId,
      top_discard: waitingState.discardPile[0],
    }).select('*').single()
    if (roomError || !room) return fail('We could not open a private room. Try again.', 'create_failed', 500)

    const { error: playerError } = await service.from('uno_room_players').insert({ room_id: room.id, player_id: playerId, display_name: displayName, slot: 1, is_host: true })
    const { error: stateError } = await service.from('uno_private_states').insert({ room_id: room.id, state: waitingState })
    if (playerError || stateError) return fail('We opened the room but could not seat you. Try again.', 'create_failed', 500)

    const view = makePrivateView(room, [{ room_id: room.id, player_id: playerId, display_name: displayName, slot: 1, is_host: true, is_online: true, rematch_accepted: false }], waitingState, playerId)
    return json(view)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Your session could not create a room.', 'auth_error', 401)
  }
})
