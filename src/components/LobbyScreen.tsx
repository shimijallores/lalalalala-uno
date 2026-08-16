import { AlertTriangle, Check, Copy, LogOut, Play, Share2, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import type { ConnectionState, PrivatePlayerView } from '../game/types'
import { ConnectionStatus } from './ConnectionStatus'
import { PlayerAvatar } from './PlayerPanel'

function inviteUrl(code: string): string {
  if (typeof window === 'undefined') return `/?room=${code}`
  return `${window.location.origin}/?room=${code}`
}

export function LobbyScreen({ view, connection, pending, error, copied, onCopy, onStart, onLeave }: {
  view: PrivatePlayerView
  connection: ConnectionState
  pending: string | null
  error: string | null
  copied: boolean
  onCopy: () => void
  onStart: () => void
  onLeave: () => void
}) {
  const isHost = view.selfPlayerId === view.hostPlayerId
  const canStart = isHost && view.players.length === 2 && !pending && connection === 'connected'
  return (
    <main id="main-content" className="lobby-shell">
      <header className="lobby-topbar">
        <div className="topbar-brand">UNO <span>DUEL</span></div>
        <div className="topbar-actions"><ConnectionStatus state={connection} /><button type="button" className="button button-leave" onClick={onLeave}><LogOut size={16} aria-hidden="true" /><span>Leave room</span></button></div>
      </header>

      <div className="lobby-main">
        <motion.section className="lobby-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1>Bring your friend.<br /><strong>Deal the drama.</strong></h1>
          <p>Share the room link, then start when both seats are online. Your hands stay private on the server.</p>
          <div className="room-code-block" aria-label={`Room code ${view.roomCode}`}>
            <div><small>Room code</small><span className="room-code">{view.roomCode}</span></div>
            <button type="button" className="button button-secondary" onClick={onCopy} aria-label="Copy room invite link">{copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{copied ? <span className="copy-feedback">Copied</span> : <span>Copy invite</span>}</button>
          </div>
          <p className="field-hint" style={{ marginTop: '0.75rem' }}>Invite link: <span>{inviteUrl(view.roomCode)}</span></p>
        </motion.section>

        <motion.section className="lobby-card" aria-labelledby="lobby-title" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <div className="lobby-card-head"><div><h2 id="lobby-title">The table</h2><p className="section-description">Private room · {view.players.length}/2 seats</p></div><Share2 size={22} color="var(--color-teal-bright)" aria-hidden="true" /></div>
          <div className="player-list">
            {view.players.map((player) => <div className="player-row" key={player.id}><PlayerAvatar name={player.displayName} pink={player.id === view.selfPlayerId} /><div className="player-meta"><strong>{player.displayName}</strong><span>{player.isHost ? 'Host · Player 1' : 'Player 2'}</span></div><span className={`player-status ${player.isOnline ? '' : 'offline'}`}>{player.isOnline ? 'Online' : 'Offline'}</span></div>)}
            {view.players.length < 2 && <div className="player-row" aria-label="Empty opponent seat"><div className="player-avatar" style={{ opacity: 0.35 }}><Sparkles size={18} aria-hidden="true" /></div><div className="player-meta"><strong>Waiting for opponent</strong><span>Send the invite above</span></div></div>}
          </div>
          {view.players.length === 2 && <div className="inline-message success"><Check size={17} aria-hidden="true" /><span>{isHost ? 'Both players are here. You can start the round.' : 'Waiting for the host to start.'}</span></div>}
          {error && <div className="inline-message error" role="alert"><AlertTriangle size={17} aria-hidden="true" /><span>{error}</span></div>}
          <div className="lobby-actions"><button type="button" className="button button-primary" disabled={!canStart} onClick={onStart}><Play size={17} aria-hidden="true" />{pending === 'start_game' ? 'Dealing...' : 'Start game'}</button><span className="field-hint">{isHost ? (view.players.length < 2 ? 'Start unlocks when your friend joins.' : 'You are Player 1 and will take the first turn.') : 'Waiting for the host to start.'}</span></div>
        </motion.section>
      </div>
    </main>
  )
}
