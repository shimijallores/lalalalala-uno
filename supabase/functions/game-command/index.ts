import {
  action,
  advanceAfterCard,
  advanceAfterAutomaticDraw,
  advanceAfterTimeout,
  advanceToPenalty,
  broadcast,
  fail,
  isValidColor,
  json,
  makePrivateView,
  opponentId,
  options,
  playerName,
  randomDraw,
  readRoom,
  requireUser,
  winnerState,
  type CommandAction,
  type PlayerRow,
  type ServerState,
} from '../_shared/server.ts'
import { isPlayable, type Card } from '../../../shared/uno-engine.ts'

interface CommandBody {
  action?: CommandAction
  roomId?: string
  cardId?: string
  color?: string
  expectedStateVersion?: number
  clientActionId?: string
}

function findCard(state: ServerState, playerId: string, cardId: string | undefined): { hand: Card[]; card: Card; index: number } | null {
  if (!cardId) return null
  const hand = state.hands[playerId] ?? []
  const index = hand.findIndex((card) => card.id === cardId)
  return index < 0 ? null : { hand, card: hand[index], index }
}

function setHand(state: ServerState, playerId: string, hand: Card[]): ServerState {
  return { ...state, hands: { ...state.hands, [playerId]: hand } }
}

function isPenaltyCard(card: Card): boolean {
  return card.kind === 'draw-two' || card.kind === 'wild-draw-four'
}

function autoResolveIfNoStack(state: ServerState, players: PlayerRow[]): ServerState {
  if (state.turnPhase !== 'penalty' || !state.currentPlayerId || state.pendingDrawCount <= 0) return state
  const hand = state.hands[state.currentPlayerId] ?? []
  if (hand.some(isPenaltyCard)) return state
  const currentIndex = players.findIndex((player) => player.player_id === state.currentPlayerId)
  const drawn = randomDraw(state, state.pendingDrawCount)
  const withCards = setHand(drawn.state, state.currentPlayerId, [...hand, ...drawn.cards])
  const next = advanceAfterAutomaticDraw(withCards, currentIndex, players)
  next.lastAction = action('card-drawn', playerName(players, state.currentPlayerId), `drew ${drawn.cards.length} penalty card${drawn.cards.length === 1 ? '' : 's'}.`)
  return next
}

function afterSuccessfulCard(state: ServerState, playerId: string, players: PlayerRow[], card: Card, index: number): ServerState {
  const nextDiscard = index < 0 ? state.discardPile : [...state.discardPile, card]
  let next = { ...setHand(state, playerId, (state.hands[playerId] ?? []).filter((_, cardIndex) => cardIndex !== index)), discardPile: nextDiscard }
  const handCount = next.hands[playerId].length
  if (handCount === 0) return winnerState(next, playerId)
  const withUno = handCount === 1 ? { ...next, unoPendingPlayerId: playerId, unoCalled: false } : next
  if (isPenaltyCard(card)) {
    const pendingDrawCount = state.pendingDrawCount + (card.kind === 'draw-two' ? 2 : 4)
    const penalty = advanceToPenalty({ ...withUno, pendingDrawCount }, players.findIndex((p) => p.player_id === playerId), players)
    return autoResolveIfNoStack(penalty, players)
  }
  return advanceAfterCard(withUno, card, players.findIndex((player) => player.player_id === playerId), players)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options()
  try {
    const { id: playerId, service } = await requireUser(request)
    const body = await request.json() as CommandBody
    if (!body.roomId || !body.action || !body.clientActionId || body.expectedStateVersion === undefined) return fail('This action is missing its table version. Refresh and try again.', 'invalid_command')
    const current = await readRoom(service, body.roomId)
    const { room, players } = current
    let state = current.state
    const me = players.find((player) => player.player_id === playerId)
    if (!me) return fail('You are not a player in this room.', 'not_a_player', 403)
    if (room.state_version !== body.expectedStateVersion) return fail('This table changed while you were playing. Refreshing your view.', 'stale_version', 409)

    if (body.action === 'turn_timeout') {
      if (room.status !== 'active' || !state.currentPlayerId || !state.turnDeadlineAt || Date.parse(state.turnDeadlineAt) > Date.now()) return fail('The turn clock has not expired yet.', 'timer_not_expired', 409)
      const expiredPlayer = state.currentPlayerId
      if (state.turnPhase === 'penalty' && state.pendingDrawCount > 0) {
        const drawn = randomDraw(state, state.pendingDrawCount)
        state = advanceAfterAutomaticDraw(setHand(drawn.state, expiredPlayer, [...(drawn.state.hands[expiredPlayer] ?? []), ...drawn.cards]), players.findIndex((player) => player.player_id === expiredPlayer), players)
        state.lastAction = action('card-drawn', playerName(players, expiredPlayer), `ran out of time and drew ${drawn.cards.length} penalty cards.`)
      } else if (state.turnPhase === 'playing') {
        const drawn = randomDraw(state, 1)
        let withCards = setHand(drawn.state, expiredPlayer, [...(drawn.state.hands[expiredPlayer] ?? []), ...drawn.cards])
        if (state.unoPendingPlayerId === expiredPlayer) withCards = { ...withCards, unoPendingPlayerId: null, unoCalled: false }
        state = advanceAfterAutomaticDraw(withCards, players.findIndex((player) => player.player_id === expiredPlayer), players)
        state.lastAction = action('card-drawn', playerName(players, expiredPlayer), 'ran out of time and drew one card. The turn moved on.')
      } else {
        state = advanceAfterTimeout(state, players.findIndex((player) => player.player_id === expiredPlayer), players)
        state.lastAction = action('turn-changed', playerName(players, expiredPlayer), 'ran out of time. The turn moved on.')
      }
    } else if (room.status === 'active' && state.turnDeadlineAt && Date.parse(state.turnDeadlineAt) <= Date.now()) {
      return fail('The turn clock expired. Waiting for the table to advance it.', 'turn_expired', 409)
    } else if (body.action === 'start_game') {
      if (!me.is_host || players.length !== 2 || room.status !== 'waiting') return fail('Both players must be present before the host can start.', 'not_ready', 409)
      state = (await import('../_shared/server.ts')).openingState(players.map((player) => player.player_id), room.scores)
      state.lastAction = action('turn-changed', me.display_name, 'started the round. You go first.')
      room.status = 'active'
    } else if (room.status === 'waiting') {
      return fail('The host needs to start the round first.', 'not_started', 409)
    } else if (body.action === 'play_card') {
      if (state.currentPlayerId !== playerId) return fail('It is not your turn.', 'wrong_player', 409)
        const found = findCard(state, playerId, body.cardId)
        if (!found) return fail('That card is not in your hand.', 'card_not_owned', 409)
        const top = state.discardPile[state.discardPile.length - 1]
        if (state.turnPhase === 'penalty') {
          if (!isPenaltyCard(found.card)) return fail('Only a Draw Two or Wild Draw Four can stack here.', 'illegal_move', 409)
        } else if (!top || !state.currentColor || !isPlayable(found.card, top, state.currentColor, found.hand)) return fail('That card is not legal on the current discard.', 'illegal_move', 409)
        if (found.card.color === 'wild') {
          state = { ...setHand(state, playerId, found.hand.filter((_, index) => index !== found.index)), discardPile: [...state.discardPile, found.card], turnPhase: 'choose-color', pendingWildCardId: found.card.id, drawnCardId: null }
          state.lastAction = action('card-played', me.display_name, `played ${found.card.label}. Pick a color.`)
        } else {
          state = afterSuccessfulCard(state, playerId, players, found.card, found.index)
          if (state.lastAction?.type !== 'card-drawn') state.lastAction = state.turnPhase === 'finished' ? action('winner-declared', me.display_name, 'played their last card.') : action('card-played', me.display_name, `played ${found.card.label}.`)
        }
    } else if (body.action === 'choose_color') {
      if (state.currentPlayerId !== playerId || state.turnPhase !== 'choose-color' || !state.pendingWildCardId || !isValidColor(body.color)) return fail('Choose one of the four UNO colors for this Wild card.', 'invalid_color', 409)
      const wild = state.discardPile[state.discardPile.length - 1]
      if (!wild || wild.id !== state.pendingWildCardId) return fail('That Wild card is no longer waiting for a color.', 'stale_command', 409)
      state = { ...state, currentColor: body.color, lastAction: action('color-chosen', me.display_name, `called ${body.color}.`), pendingWildCardId: null }
      state = afterSuccessfulCard(state, playerId, players, wild, -1)
      if (state.lastAction?.type !== 'card-drawn') state.lastAction = state.turnPhase === 'finished' ? action('winner-declared', me.display_name, 'played their last card.') : action('card-played', me.display_name, `played ${wild.label}.`)
    } else if (body.action === 'draw_card') {
        if (state.currentPlayerId !== playerId) return fail('You can draw only on your turn.', 'wrong_player', 409)
        if (state.turnPhase === 'penalty') {
          const penaltyCount = state.pendingDrawCount
          const drawn = randomDraw(state, penaltyCount)
          state = advanceAfterAutomaticDraw(setHand(drawn.state, playerId, [...(drawn.state.hands[playerId] ?? []), ...drawn.cards]), me.slot - 1, players)
          state.lastAction = action('card-drawn', me.display_name, `drew ${drawn.cards.length} penalty card${drawn.cards.length === 1 ? '' : 's'} and passed.`)
        } else if (state.turnPhase === 'playing') {
          const drawn = randomDraw(state, 1)
          let withCards = setHand(drawn.state, playerId, [...(drawn.state.hands[playerId] ?? []), ...drawn.cards])
          if (state.unoPendingPlayerId === playerId) withCards = { ...withCards, unoPendingPlayerId: null, unoCalled: false }
          state = advanceAfterAutomaticDraw(withCards, me.slot - 1, players)
          state.lastAction = action('card-drawn', me.display_name, 'drew one card and passed the turn.')
        } else {
          return fail('You can draw only on your turn.', 'wrong_player', 409)
        }
    } else if (body.action === 'call_uno') {
      if (room.status !== 'active' || state.unoPendingPlayerId !== playerId || state.unoCalled === true) return fail('UNO is not waiting for your call right now.', 'invalid_uno', 409)
      state = { ...state, unoPendingPlayerId: null, unoCalled: false, lastAction: action('uno-called', me.display_name, 'called UNO!') }
    } else if (body.action === 'catch_uno') {
      if (room.status !== 'active' || !state.unoPendingPlayerId || state.unoCalled || state.unoPendingPlayerId === playerId) return fail('There is no open UNO catch right now.', 'invalid_uno', 409)
      const target = state.unoPendingPlayerId
      const drawn = randomDraw(state, 2)
      state = { ...setHand(drawn.state, target, [...(drawn.state.hands[target] ?? []), ...drawn.cards]), unoPendingPlayerId: null, unoCalled: false, lastAction: action('uno-caught', me.display_name, `caught ${playerName(players, target)} before the call.`) }
    } else if (body.action === 'forfeit_game') {
      if (room.status !== 'active') return fail('There is no active round to forfeit.', 'wrong_phase', 409)
      const winner = opponentId(players, playerId)
      if (!winner) return fail('Your opponent is not in the room.', 'not_ready', 409)
      state = winnerState(state, winner)
      state.lastAction = action('winner-declared', playerName(players, winner), `${me.display_name} forfeited the round.`)
      room.status = 'finished'
    } else if (body.action === 'request_rematch' || body.action === 'accept_rematch') {
      if (room.status !== 'finished') return fail('A rematch is available after the round ends.', 'wrong_phase', 409)
      const other = opponentId(players, playerId)
      const otherRequested = room.rematch_requested_by === other
      if (otherRequested) {
        state = (await import('../_shared/server.ts')).openingState(players.map((player) => player.player_id), state.scores)
        room.status = 'active'
        room.rematch_requested_by = null
        state.lastAction = action('rematch-requested', me.display_name, 'accepted the rematch. New round starting.')
      } else {
        room.rematch_requested_by = playerId
        state.lastAction = action('rematch-requested', me.display_name, 'requested a rematch.')
      }
    } else if (body.action === 'leave_room') {
      const leaveUpdate = await service.from('uno_room_players').update({ is_online: false, last_seen_at: new Date().toISOString() }).eq('room_id', room.id).eq('player_id', playerId)
      if (leaveUpdate.error) return fail('We could not leave the room cleanly. Try again.', 'leave_failed', 500)
      const remaining = await service.from('uno_room_players').select('player_id', { count: 'exact', head: true }).eq('room_id', room.id).eq('is_online', true)
      if (!remaining.error && (remaining.count ?? 0) === 0) {
        const deleted = await service.from('uno_rooms').delete().eq('id', room.id)
        if (deleted.error) return fail('The room is empty but could not be cleaned up yet.', 'cleanup_failed', 500)
        return json({ roomDeleted: true })
      }
      state.lastAction = action('player-left', me.display_name, 'left the table.')
    } else {
      return fail('That table action is not supported.', 'unknown_command')
    }

    if (state.turnPhase === 'finished') room.status = 'finished'
    const nextPlayers = players.map((player) => player.player_id === playerId
      ? { ...player, is_online: body.action === 'leave_room' ? false : player.is_online, rematch_accepted: body.action === 'request_rematch' || body.action === 'accept_rematch' }
      : player)
    const publicRoom = { ...room, state_version: room.state_version + 1, status: room.status }
    const nextViews = nextPlayers.map((player) => makePrivateView(publicRoom, nextPlayers, state, player.player_id))
    const response = await service.rpc('commit_uno_command', {
      p_room_id: room.id,
      p_player_id: playerId,
      p_expected_version: body.expectedStateVersion,
      p_client_action_id: body.clientActionId,
      p_private_state: state,
      p_public_view: nextViews[0],
      p_private_view: nextViews.find((view) => view.selfPlayerId === playerId),
    })
    if (response.error) return fail('The table changed before this move could land. Refreshing your view.', 'stale_version', 409)
    if (response.data?.error) return json(response.data, response.data.code === 'stale_version' ? 409 : 400)
    await broadcast(service, room.id, nextViews)
    return json(response.data)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The table command failed. Refresh and try again.', 'command_failed', 500)
  }
})
