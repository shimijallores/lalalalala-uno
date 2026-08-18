import {
  applyCardEffect,
  createDeck,
  dealInitialHands,
  drawCards,
  isPlayable,
  shuffle,
} from '../game/deck'
import { GatewayError } from '../game/types'
import type {
  AuthenticatedPlayer,
  CommandInput,
  EmojiReaction,
  GatewayCallbacks,
  LegalAction,
  PrivatePlayerView,
  PublicPlayer,
  RealtimeGateway,
} from '../game/types'
import type { Card, UnoColor } from '../game/types'

interface MockPlayer {
  id: string
  displayName: string
  slot: 1 | 2
  isHost: boolean
  isOnline: boolean
  hand: Card[]
  score: number
}

interface MockRoom {
  id: string
  code: string
  status: 'waiting' | 'active' | 'finished'
  players: MockPlayer[]
  drawPile: Card[]
  discardPile: Card[]
  currentPlayerId: string | null
  currentColor: UnoColor | null
  turnDeadlineAt: string | null
  stateVersion: number
  callbacks: Map<string, GatewayCallbacks>
}

const rooms = new Map<string, MockRoom>()
let mockSequence = 0

const nextId = (prefix: string) => `${prefix}-${++mockSequence}`

/** In-memory gateway for unit/UI tests only. Production never imports or selects it. */
export class MockGateway implements RealtimeGateway {
  readonly isConfigured = true
  private readonly playerId: string
  private readonly playerName: string

  constructor(playerId = nextId('mock-player'), playerName = 'Test player') {
    this.playerId = playerId
    this.playerName = playerName
  }

  async ensureSession(): Promise<AuthenticatedPlayer> {
    return { id: this.playerId, displayName: this.playerName }
  }

  private view(room: MockRoom, requestedPlayerId = this.playerId): PrivatePlayerView {
    const me = room.players.find((player) => player.id === requestedPlayerId)
    if (!me) throw new GatewayError('You are not in this room.', 'not_a_player')
    const topDiscard = room.discardPile[room.discardPile.length - 1]
    const publicPlayers: PublicPlayer[] = room.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      slot: player.slot,
      isHost: player.isHost,
      isOnline: player.isOnline,
      handCount: player.hand.length,
      score: player.score,
    }))
    const legalActions: LegalAction[] = room.status === 'waiting'
      ? (me.isHost && room.players.length === 2 ? ['start-game'] : [])
      : room.status === 'finished'
        ? ['request-rematch']
        : room.currentPlayerId === me.id
          ? ['play-card', 'draw-card', 'call-uno']
          : []
    return {
      roomId: room.id,
      roomCode: room.code,
      status: room.status,
      hostPlayerId: room.players[0]?.id ?? '',
      players: publicPlayers,
      currentPlayerId: room.currentPlayerId,
      currentColor: room.currentColor,
      turnDeadlineAt: room.turnDeadlineAt,
      drawnCardId: null,
      topDiscard,
      drawPileCount: room.drawPile.length,
      scores: Object.fromEntries(room.players.map((player) => [player.id, player.score])),
      turnPhase: room.status === 'waiting' ? 'waiting' : room.status === 'finished' ? 'finished' : 'playing',
      lastAction: null,
      unoPendingPlayerId: null,
      unoCalled: false,
      stateVersion: room.stateVersion,
      opponentDisconnectedAt: null,
      rematchRequestedBy: null,
      selfPlayerId: me.id,
      ownHand: [...me.hand],
      legalActions,
    }
  }

  private notify(room: MockRoom): void {
    for (const [playerId, callbacks] of room.callbacks) {
      const player = room.players.find((entry) => entry.id === playerId)
      if (player) callbacks.onView(this.view(room, playerId))
    }
  }

  async createRoom(displayName: string): Promise<PrivatePlayerView> {
    const id = nextId('mock-room')
    const player = { id: this.playerId, displayName, slot: 1 as const, isHost: true, isOnline: true, hand: [], score: 0 }
    const room: MockRoom = {
      id,
      code: `DUEL${String(mockSequence).padStart(2, '0')}`,
      status: 'waiting',
      players: [player],
      drawPile: [],
      discardPile: [createDeck()[0]],
      currentPlayerId: null,
      currentColor: null,
      turnDeadlineAt: null,
      stateVersion: 1,
      callbacks: new Map(),
    }
    rooms.set(id, room)
    return this.view(room)
  }

  async joinRoom(roomCode: string, displayName: string): Promise<PrivatePlayerView> {
    const room = [...rooms.values()].find((candidate) => candidate.code === roomCode.toUpperCase())
    if (!room) throw new GatewayError('That room code is not active.', 'room_not_found')
    if (room.players.length >= 2) throw new GatewayError('That room already has two players.', 'room_full')
    room.players.push({ id: this.playerId, displayName, slot: 2, isHost: false, isOnline: true, hand: [], score: 0 })
    room.stateVersion += 1
    this.notify(room)
    return this.view(room)
  }

  async getGameView(roomId: string): Promise<PrivatePlayerView> {
    const room = rooms.get(roomId)
    if (!room) throw new GatewayError('That room is no longer available.', 'room_not_found')
    return this.view(room)
  }

  async sendCommand(input: CommandInput): Promise<PrivatePlayerView> {
    if (!input.roomId) throw new GatewayError('A room is required for this command.', 'missing_room')
    const room = rooms.get(input.roomId)
    if (!room) throw new GatewayError('That room is no longer available.', 'room_not_found')
    if (input.expectedStateVersion !== undefined && input.expectedStateVersion !== room.stateVersion) {
      throw new GatewayError('This table changed while you were playing. Resyncing now.', 'stale_version', room.stateVersion)
    }
    const me = room.players.find((player) => player.id === this.playerId)
    if (!me) throw new GatewayError('You are not in this room.', 'not_a_player')

    if (input.action === 'start_game') {
      if (room.players.length !== 2 || me.id !== room.players[0]?.id) throw new GatewayError('Both players must be present before starting.', 'not_ready')
      const deal = dealInitialHands(shuffle(createDeck()), room.players.map((player) => player.id))
      room.players.forEach((player) => { player.hand = deal.hands[player.id] })
      room.drawPile = deal.drawPile
      room.discardPile = deal.discardPile
      room.status = 'active'
      room.currentPlayerId = room.players[0].id
      room.currentColor = room.discardPile[0].color as UnoColor
      room.turnDeadlineAt = new Date(Date.now() + 30000).toISOString()
    }

    if (input.action === 'play_card') {
      if (room.currentPlayerId !== me.id) throw new GatewayError('It is not your turn.', 'wrong_player')
      const cardIndex = me.hand.findIndex((card) => card.id === input.cardId)
      if (cardIndex < 0) throw new GatewayError('That card is not in your hand.', 'card_not_owned')
      const card = me.hand[cardIndex]
      const top = room.discardPile[room.discardPile.length - 1]
      if (!room.currentColor || !isPlayable(card, top, room.currentColor, me.hand)) throw new GatewayError('That card cannot be played here.', 'illegal_move')
      me.hand = me.hand.filter((_, index) => index !== cardIndex)
      room.discardPile = [...room.discardPile, card]
      const effect = applyCardEffect(card, me.slot - 1, room.players.length)
      room.currentPlayerId = room.players[effect.nextPlayerIndex].id
      room.currentColor = card.color === 'wild' ? room.currentColor : card.color
    }

    if (input.action === 'draw_card') {
      if (room.currentPlayerId !== me.id || !room.currentColor) throw new GatewayError('It is not your turn.', 'wrong_player')
      const drawn = drawCards(room.drawPile, room.discardPile, 1)
      me.hand = [...me.hand, ...drawn.cards]
      room.drawPile = drawn.drawPile
      room.discardPile = drawn.discardPile
    }

    room.stateVersion += 1
    this.notify(room)
    return this.view(room)
  }

  async sendReaction(roomId: string, reaction: EmojiReaction): Promise<void> {
    const room = rooms.get(roomId)
    if (!room) throw new GatewayError('That room is no longer available.', 'room_not_found')
    for (const [playerId, callbacks] of room.callbacks) {
      if (playerId !== this.playerId) callbacks.onReaction?.(reaction)
    }
  }

  async subscribe(roomId: string, playerId: string, callbacks: GatewayCallbacks): Promise<() => Promise<void>> {
    const room = rooms.get(roomId)
    if (!room || playerId !== this.playerId) throw new GatewayError('That room is no longer available.', 'room_not_found')
    room.callbacks.set(playerId, callbacks)
    callbacks.onConnection('connected')
    callbacks.onView(this.view(room))
    return async () => { room.callbacks.delete(playerId) }
  }
}
