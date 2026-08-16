import { BookOpen, LogOut, Volume2, VolumeX } from 'lucide-react'
import type { PrivatePlayerView } from '../game/types'

export function GameHeader({ view, muted, onToggleMute, onRules, onLeave }: {
  view: PrivatePlayerView
  muted: boolean
  onToggleMute: () => void
  onRules: () => void
  onLeave: () => void
}) {
  return (
    <header className="game-topbar">
      <div className="game-context">
        <div className="topbar-brand">UNO <span>DUEL</span></div>
        <span className="room-tag">Room <strong>{view.roomCode}</strong></span>
        {view.currentColor && <span className={`color-tag ${view.currentColor}`}>Color <strong>{view.currentColor}</strong></span>}
        <span className="score-tag">Score <strong>{view.players.map((player) => `${player.displayName} ${view.scores[player.id] ?? 0}`).join(' · ')}</strong></span>
      </div>
      <div className="topbar-actions">
        <button type="button" className="button button-quiet header-icon-button" aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} onClick={onToggleMute}>{muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}</button>
        <button type="button" className="button button-quiet header-icon-button" aria-label="Open rules" onClick={onRules}><BookOpen size={16} aria-hidden="true" /></button>
        <button type="button" className="button button-leave" aria-label="Leave game" onClick={onLeave}><LogOut size={16} aria-hidden="true" /><span>Leave</span></button>
      </div>
    </header>
  )
}
