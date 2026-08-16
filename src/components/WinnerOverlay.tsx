import { motion } from 'motion/react'
import type { PrivatePlayerView } from '../game/types'

export function WinnerOverlay({ view, pending, onRequestRematch, onLeave }: {
  view: PrivatePlayerView
  pending: boolean
  onRequestRematch: () => void
  onLeave: () => void
}) {
  const winner = view.players.find((player) => player.handCount === 0) ?? view.players.find((player) => player.displayName === view.lastAction?.playerName)
  const requestedBy = view.players.find((player) => player.id === view.rematchRequestedBy)
  const winnerName = view.lastAction?.type === 'winner-declared' ? view.lastAction.playerName : winner?.displayName ?? 'Winner'

  return (
    <div className="winner-backdrop" role="dialog" aria-modal="true" aria-labelledby="winner-title">
      <motion.div className="winner-card" initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
        <span className="confetti" aria-hidden="true" />
        <span className="confetti" aria-hidden="true" />
        <span className="confetti" aria-hidden="true" />
        <span className="confetti" aria-hidden="true" />
        <span className="confetti" aria-hidden="true" />
        <div className="winner-kicker">Round complete</div>
        <h2 className="winner-heading" id="winner-title">{winnerName} wins!</h2>
        <p className="winner-copy">That last card landed. Ready to run it back?</p>
        <div className="winner-scores">
          {view.players.map((player) => (
            <div className="winner-score" key={player.id}>
              <strong>{view.scores[player.id] ?? player.score}</strong>
              <span>{player.displayName}</span>
            </div>
          ))}
        </div>
        {requestedBy && <p className="rematch-note">{requestedBy.id === view.selfPlayerId ? 'Rematch requested. Waiting on your friend.' : `${requestedBy.displayName} wants a rematch.`}</p>}
        <div className="winner-actions">
          <button type="button" className="button button-primary" disabled={pending || requestedBy?.id === view.selfPlayerId} onClick={onRequestRematch}>
            {pending ? 'Sending...' : requestedBy?.id === view.selfPlayerId ? 'Rematch requested' : 'Request rematch'}
          </button>
          <button type="button" className="button button-quiet" onClick={onLeave}>Leave room</button>
        </div>
      </motion.div>
    </div>
  )
}
