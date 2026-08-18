import type { Card, UnoColor } from '../../shared/uno-engine'

export type { Card, CardColor, CardKind, UnoColor } from '../../shared/uno-engine'

export type RoomStatus = 'waiting' | 'active' | 'finished'
export type TurnPhase = 'waiting' | 'playing' | 'drawn' | 'choose-color' | 'uno-pending' | 'penalty' | 'finished'
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'configuration-error'

export interface PublicPlayer {
  id: string
  displayName: string
  slot: 1 | 2
  isHost: boolean
  isOnline: boolean
  handCount: number
  score: number
}

export interface LastAction {
  type: 'player-joined' | 'player-left' | 'card-played' | 'card-drawn' | 'color-chosen' | 'uno-called' | 'uno-caught' | 'turn-changed' | 'winner-declared' | 'rematch-requested'
  playerName: string
  detail: string
  at: string
}

export interface PublicGameView {
  roomId: string
  roomCode: string
  status: RoomStatus
  hostPlayerId: string
  players: PublicPlayer[]
  currentPlayerId: string | null
  currentColor: UnoColor | null
  turnDeadlineAt: string | null
  topDiscard: Card
  drawPileCount: number
  scores: Record<string, number>
  turnPhase: TurnPhase
  lastAction: LastAction | null
  unoPendingPlayerId: string | null
  unoCalled: boolean
  stateVersion: number
  opponentDisconnectedAt: string | null
  rematchRequestedBy: string | null
}

export type LegalAction =
  | 'play-card'
  | 'draw-card'
  | 'choose-color'
  | 'call-uno'
  | 'catch-uno'
  | 'start-game'
  | 'request-rematch'
  | 'accept-rematch'
  | 'leave-room'
  | 'forfeit-game'

export interface PrivatePlayerView extends PublicGameView {
  selfPlayerId: string
  ownHand: Card[]
  drawnCardId: string | null
  legalActions: LegalAction[]
}

export type CommandName =
  | 'create_room'
  | 'join_room'
  | 'start_game'
  | 'get_game_view'
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

export interface CommandInput {
  action: CommandName
  roomId?: string
  roomCode?: string
  displayName?: string
  cardId?: string
  color?: UnoColor
  expectedStateVersion?: number
  clientActionId: string
}

export interface AuthenticatedPlayer {
  id: string
  displayName: string | null
}

export interface GatewayEvent {
  type: 'player-joined' | 'player-left' | 'player-connected' | 'player-disconnected' | 'state-updated'
  roomId: string
  playerId?: string
}

export interface EmojiReaction {
  id: string
  emojiKey: string
  playerId: string
  playerName: string
}

export interface GatewayCallbacks {
  onEvent: (event: GatewayEvent) => void
  onView: (view: PrivatePlayerView) => void
  onConnection: (state: ConnectionState) => void
  onReaction?: (reaction: EmojiReaction) => void
}

export interface RealtimeGateway {
  readonly isConfigured: boolean
  ensureSession(): Promise<AuthenticatedPlayer>
  createRoom(displayName: string): Promise<PrivatePlayerView>
  joinRoom(roomCode: string, displayName: string): Promise<PrivatePlayerView>
  getGameView(roomId: string): Promise<PrivatePlayerView>
  sendCommand(input: CommandInput): Promise<PrivatePlayerView>
  sendReaction(roomId: string, reaction: EmojiReaction): Promise<void>
  subscribe(roomId: string, playerId: string, callbacks: GatewayCallbacks): Promise<() => Promise<void>>
}

export class GatewayError extends Error {
  code: string
  stateVersion?: number

  constructor(message: string, code = 'gateway_error', stateVersion?: number) {
    super(message)
    this.name = 'GatewayError'
    this.code = code
    this.stateVersion = stateVersion
  }
}

export type { Card as GameCard }
