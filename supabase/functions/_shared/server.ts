import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import {
  applyCardEffect,
  createDeck,
  dealInitialHands,
  drawCards,
  hasPlayableCard,
  isPlayable,
  shuffle,
  type Card,
  type UnoColor,
} from '../../../shared/uno-engine.ts'

export type CommandAction =
  | 'start_game'
  | 'play_card'
  | 'draw_card'
  | 'turn_timeout'
  | 'choose_color'
  | 'call_uno'
  | 'catch_uno'
  | 'leave_room'
  | 'forfeit_game'
  | 'request_rematch'
  | 'accept_rematch'

export interface RoomRow {
  id: string
  room_code: string
  host_player_id: string
  status: 'waiting' | 'active' | 'finished'
  state_version: number
  current_player_id: string | null
  current_color: UnoColor | null
  turn_deadline_at?: string | null
  top_discard: Card | null
  draw_pile_count: number
  scores: Record<string, number>
  turn_phase: string
  last_action: PublicAction | null
  rematch_requested_by: string | null
  opponent_disconnected_at: string | null
}

export interface PlayerRow {
  room_id: string
  player_id: string
  display_name: string
  slot: 1 | 2
  is_host: boolean
  is_online: boolean
  rematch_accepted: boolean
}

export interface PublicAction {
  type: 'player-joined' | 'player-left' | 'card-played' | 'card-drawn' | 'color-chosen' | 'uno-called' | 'uno-caught' | 'turn-changed' | 'winner-declared' | 'rematch-requested'
  playerName: string
  detail: string
  at: string
}

export interface ServerState {
  drawPile: Card[]
  discardPile: Card[]
  hands: Record<string, Card[]>
  currentPlayerId: string | null
  currentColor: UnoColor | null
  turnDeadlineAt: string | null
  turnPhase: 'waiting' | 'playing' | 'drawn' | 'choose-color' | 'uno-pending' | 'penalty' | 'finished'
  pendingDrawCount: number
  drawnCardId: string | null
  pendingWildCardId: string | null
  unoPendingPlayerId: string | null
  unoCalled: boolean
  winnerId: string | null
  scores: Record<string, number>
  lastAction: PublicAction | null
}

export interface PublicView {
  roomId: string
  roomCode: string
  status: RoomRow['status']
  hostPlayerId: string
  players: Array<{
    id: string
    displayName: string
    slot: 1 | 2
    isHost: boolean
    isOnline: boolean
    handCount: number
    score: number
  }>
  currentPlayerId: string | null
  currentColor: UnoColor | null
  turnDeadlineAt: string | null
  topDiscard: Card
  drawPileCount: number
  scores: Record<string, number>
  turnPhase: ServerState['turnPhase']
  lastAction: PublicAction | null
  stateVersion: number
  opponentDisconnectedAt: string | null
  rematchRequestedBy: string | null
}

export interface PrivateView extends PublicView {
  selfPlayerId: string
  ownHand: Card[]
  drawnCardId: string | null
  legalActions: string[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export function options(): Response {
  return new Response('ok', { headers: corsHeaders })
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
}

export async function requireUser(request: Request): Promise<{ id: string; service: SupabaseClient }> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new Error('Missing bearer token')
  const token = authorization.slice('Bearer '.length)
  const service = serviceClient()
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) throw new Error('Your anonymous session is not valid anymore. Refresh and try again.')
  return { id: data.user.id, service }
}

export async function readRoom(service: SupabaseClient, roomId: string): Promise<{ room: RoomRow; players: PlayerRow[]; state: ServerState }> {
  const [{ data: room, error: roomError }, { data: players, error: playersError }, { data: privateState, error: stateError }] = await Promise.all([
    service.from('uno_rooms').select('*').eq('id', roomId).single(),
    service.from('uno_room_players').select('*').eq('room_id', roomId).order('slot'),
    service.from('uno_private_states').select('state').eq('room_id', roomId).single(),
  ])
  if (roomError || !room || playersError || stateError || !privateState) throw new Error('That room is no longer available.')
  return { room: room as RoomRow, players: (players ?? []) as PlayerRow[], state: privateState.state as ServerState }
}

function randomValue(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
}

export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(randomValue() * alphabet.length)]).join('')
}

export function createWaitingState(): ServerState {
  return {
    drawPile: [],
    discardPile: [createDeck()[0]],
    hands: {},
    currentPlayerId: null,
    currentColor: null,
    turnDeadlineAt: null,
    turnPhase: 'waiting',
    pendingDrawCount: 0,
    drawnCardId: null,
    pendingWildCardId: null,
    unoPendingPlayerId: null,
    unoCalled: false,
    winnerId: null,
    scores: {},
    lastAction: null,
  }
}

export function openingState(playerIds: string[], previousScores: Record<string, number> = {}): ServerState {
  const deal = dealInitialHands(shuffle(createDeck(), randomValue), playerIds)
  const openingCard = deal.discardPile[0]
  return {
    drawPile: deal.drawPile,
    discardPile: deal.discardPile,
    hands: deal.hands,
    currentPlayerId: playerIds[0],
    currentColor: openingCard.color as UnoColor,
    turnDeadlineAt: new Date(Date.now() + 30000).toISOString(),
    turnPhase: 'playing',
    pendingDrawCount: 0,
    drawnCardId: null,
    pendingWildCardId: null,
    unoPendingPlayerId: null,
    unoCalled: false,
    winnerId: null,
    scores: Object.fromEntries(playerIds.map((id) => [id, previousScores[id] ?? 0])),
    lastAction: null,
  }
}

export function makePublicView(room: RoomRow, players: PlayerRow[], state: ServerState): PublicView {
  const topDiscard = state.discardPile[state.discardPile.length - 1] ?? createDeck()[0]
  return {
    roomId: room.id,
    roomCode: room.room_code,
    status: room.status,
    hostPlayerId: room.host_player_id,
    players: players.map((player) => ({
      id: player.player_id,
      displayName: player.display_name,
      slot: player.slot,
      isHost: player.is_host,
      isOnline: player.is_online,
      handCount: state.hands[player.player_id]?.length ?? 0,
      score: state.scores[player.player_id] ?? 0,
    })),
    currentPlayerId: state.currentPlayerId,
    currentColor: state.currentColor,
    turnDeadlineAt: state.turnDeadlineAt ?? null,
    topDiscard,
    drawPileCount: state.drawPile.length,
    scores: state.scores,
    turnPhase: state.turnPhase,
    lastAction: state.lastAction,
    stateVersion: room.state_version,
    opponentDisconnectedAt: room.opponent_disconnected_at,
    rematchRequestedBy: room.rematch_requested_by,
  }
}

export function legalActions(room: RoomRow, players: PlayerRow[], state: ServerState, playerId: string): string[] {
  const self = players.find((player) => player.player_id === playerId)
  if (!self) return []
  if (room.status === 'waiting') return self.is_host && players.length === 2 ? ['start-game'] : []
  if (room.status === 'finished') return room.rematch_requested_by === playerId ? [] : ['request-rematch']
  if (state.currentPlayerId !== playerId) return []
  if (state.turnPhase === 'choose-color') return ['choose-color']
  const hand = state.hands[playerId] ?? []
  const top = state.discardPile[state.discardPile.length - 1]
  const actions = ['draw-card']
  if (top && state.currentColor && hasPlayableCard(hand, top, state.currentColor)) actions.push('play-card')
  else actions.push('play-card')
  return actions
}

export function makePrivateView(room: RoomRow, players: PlayerRow[], state: ServerState, playerId: string): PrivateView {
  const publicView = makePublicView(room, players, state)
  return { ...publicView, selfPlayerId: playerId, ownHand: [...(state.hands[playerId] ?? [])], drawnCardId: state.drawnCardId, legalActions: legalActions(room, players, state, playerId) }
}

export function playerName(players: PlayerRow[], playerId: string): string {
  return players.find((player) => player.player_id === playerId)?.display_name ?? 'Player'
}

export function action(type: PublicAction['type'], playerNameValue: string, detail: string): PublicAction {
  return { type, playerName: playerNameValue, detail, at: new Date().toISOString() }
}

export function fail(message: string, code: string, status = 400): Response {
  return json({ error: true, code, message }, status)
}

export async function broadcast(service: SupabaseClient, roomId: string, views: PrivateView[]): Promise<void> {
  const publicChannel = service.channel(`room:${roomId}`, { config: { private: true } })
  await publicChannel.subscribe()
  await publicChannel.send({ type: 'broadcast', event: 'state_update', payload: { roomId, stateVersion: views[0]?.stateVersion } })
  for (const view of views) {
    const privateChannel = service.channel(`player:${view.selfPlayerId}`, { config: { private: true } })
    await privateChannel.subscribe()
    await privateChannel.send({ type: 'broadcast', event: 'private_state', payload: view })
    await service.removeChannel(privateChannel)
  }
  await service.removeChannel(publicChannel)
}

export function randomDraw(state: ServerState, count: number): { state: ServerState; cards: Card[] } {
  const result = drawCards(state.drawPile, state.discardPile, count, randomValue)
  return { state: { ...state, drawPile: result.drawPile, discardPile: result.discardPile }, cards: result.cards }
}

export function advanceAfterCard(state: ServerState, card: Card, currentPlayerIndex: number, players: PlayerRow[]): ServerState {
  const effect = applyCardEffect(card, currentPlayerIndex, players.length)
  const nextPlayer = players[effect.nextPlayerIndex]?.player_id ?? null
  return { ...state, currentPlayerId: nextPlayer, currentColor: card.color === 'wild' ? state.currentColor : card.color as UnoColor, turnPhase: 'playing', turnDeadlineAt: new Date(Date.now() + 30000).toISOString(), pendingDrawCount: 0, drawnCardId: null, pendingWildCardId: null, unoPendingPlayerId: null, unoCalled: false }
}

export function advanceToPenalty(state: ServerState, currentPlayerIndex: number, players: PlayerRow[]): ServerState {
  const nextPlayer = players[(currentPlayerIndex + 1) % players.length]?.player_id ?? null
  return { ...state, currentPlayerId: nextPlayer, turnPhase: 'penalty', turnDeadlineAt: new Date(Date.now() + 30000).toISOString(), drawnCardId: null, pendingWildCardId: null, unoPendingPlayerId: null, unoCalled: false }
}

export function advanceAfterAutomaticDraw(state: ServerState, currentPlayerIndex: number, players: PlayerRow[]): ServerState {
  const nextPlayer = players[(currentPlayerIndex + 1) % players.length]?.player_id ?? null
  return { ...state, currentPlayerId: nextPlayer, turnPhase: 'playing', turnDeadlineAt: new Date(Date.now() + 30000).toISOString(), pendingDrawCount: 0, drawnCardId: null, pendingWildCardId: null }
}

export function advanceAfterTimeout(state: ServerState, currentPlayerIndex: number, players: PlayerRow[]): ServerState {
  const top = state.discardPile[state.discardPile.length - 1]
  if (state.turnPhase === 'choose-color' && top?.color === 'wild') {
    return advanceAfterCard({ ...state, currentColor: state.currentColor ?? 'red' }, top, currentPlayerIndex, players)
  }
  return advanceAfterAutomaticDraw(state, currentPlayerIndex, players)
}

export function winnerState(state: ServerState, playerId: string): ServerState {
  return { ...state, winnerId: playerId, turnPhase: 'finished', turnDeadlineAt: null, pendingDrawCount: 0, currentPlayerId: null, scores: { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + 1 } }
}

export function opponentId(players: PlayerRow[], playerId: string): string | null {
  return players.find((player) => player.player_id !== playerId)?.player_id ?? null
}

export function isValidColor(color: unknown): color is UnoColor {
  return color === 'red' || color === 'blue' || color === 'green' || color === 'yellow'
}
