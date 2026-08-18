import { legalCardIds } from '../game/rules'
import type { Card, PrivatePlayerView } from '../game/types'
import { UnoCard } from './UnoCard'

interface HandProps {
  view: PrivatePlayerView
  pendingCommand: string | null
  draggedCardId?: string | null
  onPlay: (card: Card) => void
  onCardDragStart?: (card: Card) => void
  onCardDragEnd?: () => void
  onCardDrop?: (card: Card) => void
}

export function Hand({ view, pendingCommand, draggedCardId, onPlay, onCardDragStart, onCardDragEnd, onCardDrop }: HandProps) {
  const isMyTurn = view.currentPlayerId === view.selfPlayerId
  const playable = view.turnPhase === 'penalty'
    ? new Set(view.ownHand.filter((card) => card.kind === 'draw-two' || card.kind === 'wild-draw-four').map((card) => card.id))
    : view.currentColor && view.topDiscard ? legalCardIds(view.ownHand, view.topDiscard, view.currentColor) : new Set<string>()

  return (
    <div className="hand-wrap" aria-label={`Your hand, ${view.ownHand.length} cards`}>
      <div className="hand-scroll">
        {view.ownHand.map((card, index) => {
          const legal = playable.has(card.id)
          return (
            <UnoCard
              key={card.id}
              card={card}
              index={index}
              legal={legal && isMyTurn}
              pending={Boolean(pendingCommand)}
              dragging={draggedCardId === card.id}
              disabled={!isMyTurn || !legal || Boolean(pendingCommand)}
              onPlay={onPlay}
              onCardDragStart={onCardDragStart}
              onCardDragEnd={onCardDragEnd}
              onCardDrop={onCardDrop}
            />
          )
        })}
      </div>
    </div>
  )
}
