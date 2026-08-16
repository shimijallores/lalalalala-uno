import type { ConnectionState, PrivatePlayerView } from './types'

export interface ClientGameState {
  view: PrivatePlayerView | null
  connection: ConnectionState
  pendingCommand: string | null
  error: string | null
  notice: string | null
}

export const initialClientGameState: ClientGameState = {
  view: null,
  connection: 'connecting',
  pendingCommand: null,
  error: null,
  notice: null,
}

export type ClientGameAction =
  | { type: 'view-received'; view: PrivatePlayerView }
  | { type: 'connection-changed'; connection: ConnectionState }
  | { type: 'command-started'; commandId: string }
  | { type: 'command-finished' }
  | { type: 'error'; message: string }
  | { type: 'notice'; message: string }
  | { type: 'clear-message' }
  | { type: 'reset' }

export function clientGameReducer(state: ClientGameState, action: ClientGameAction): ClientGameState {
  switch (action.type) {
    case 'view-received':
      return { ...state, view: action.view, pendingCommand: null, error: null }
    case 'connection-changed':
      return { ...state, connection: action.connection }
    case 'command-started':
      return { ...state, pendingCommand: action.commandId, error: null }
    case 'command-finished':
      return { ...state, pendingCommand: null }
    case 'error':
      return { ...state, pendingCommand: null, error: action.message }
    case 'notice':
      return { ...state, notice: action.message, error: null }
    case 'clear-message':
      return { ...state, error: null, notice: null }
    case 'reset':
      return initialClientGameState
    default:
      return state
  }
}
