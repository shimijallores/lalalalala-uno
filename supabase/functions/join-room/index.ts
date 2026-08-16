import {
  action,
  broadcast,
  fail,
  json,
  makePrivateView,
  options,
  readRoom,
  requireUser,
} from '../_shared/server.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options()
  try {
    const { id: playerId, service } = await requireUser(request)
    const body = await request.json() as { roomCode?: string; displayName?: string }
    const displayName = body.displayName?.trim()
    const roomCode = body.roomCode?.trim().toUpperCase()
    if (!displayName || displayName.length > 20) return fail('Choose a display name between 1 and 20 characters.', 'invalid_name')
    if (!roomCode || !/^[A-Z2-9]{6,8}$/.test(roomCode)) return fail('Enter the 6-8 character room code your friend shared.', 'invalid_room_code')

    const { data: room, error: roomError } = await service.from('uno_rooms').select('*').eq('room_code', roomCode).maybeSingle()
    if (roomError || !room) return fail('That room code is not active.', 'room_not_found', 404)
    const { data: players } = await service.from('uno_room_players').select('*').eq('room_id', room.id).order('slot')
    if ((players ?? []).some((player) => player.player_id === playerId)) {
      const existingPlayer = (players ?? []).find((player) => player.player_id === playerId)
      const rejoinedAction = action('player-joined', displayName || existingPlayer?.display_name || 'Player', 'rejoined the table.')
      await service.from('uno_room_players').update({ display_name: displayName || existingPlayer?.display_name, is_online: true, last_seen_at: new Date().toISOString() }).eq('room_id', room.id).eq('player_id', playerId)
      await service.from('uno_rooms').update({ state_version: room.state_version + 1, last_action: rejoinedAction, updated_at: new Date().toISOString() }).eq('id', room.id)
      const current = await readRoom(service, room.id)
      current.state.lastAction = rejoinedAction
      const views = current.players.map((player) => makePrivateView(current.room, current.players, current.state, player.player_id))
      await broadcast(service, room.id, views)
      return json(views.find((view) => view.selfPlayerId === playerId))
    }
    if (room.status !== 'waiting' || (players ?? []).length >= 2) return fail('That room already has two players or has already started.', 'room_full', 409)

    const { error: insertError } = await service.from('uno_room_players').insert({ room_id: room.id, player_id: playerId, display_name: displayName, slot: 2, is_host: false })
    if (insertError) return fail('That seat was just taken. Try another room.', 'room_full', 409)
    const joinedAction = action('player-joined', displayName, 'joined the table.')
    await service.from('uno_rooms').update({ state_version: room.state_version + 1, last_action: joinedAction, updated_at: new Date().toISOString() }).eq('id', room.id)
    const current = await readRoom(service, room.id)
    current.state.lastAction = joinedAction
    const views = current.players.map((player) => makePrivateView(current.room, current.players, current.state, player.player_id))
    await broadcast(service, room.id, views)
    const view = views.find((candidate) => candidate.selfPlayerId === playerId)
    return json(view)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Your session could not join this room.', 'auth_error', 401)
  }
})
