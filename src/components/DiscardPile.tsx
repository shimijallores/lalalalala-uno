import { motion } from 'motion/react'
import { getCardAlt, getCardAssetPath } from '../game/assets'
import type { Card } from '../game/types'

export function DiscardPile({ card, dropActive = false, onDrop }: { card: Card; dropActive?: boolean; onDrop?: () => void }) {
  return (
    <div className="pile-area">
      <div
        className={`discard-card ${dropActive ? 'drop-target' : ''}`}
        data-discard-drop-target="true"
        aria-label={`Top discard: ${card.label}. Drop a playable card here.`}
        onDragOver={(event) => {
          if (!dropActive) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (dropActive) onDrop?.()
        }}
      >
        <motion.img
          key={card.id}
          className="discard-image"
          src={getCardAssetPath(card)}
          alt={getCardAlt(card)}
          draggable={false}
          initial={{ opacity: 0, y: -26, rotate: -8, scale: 1.08 }}
          animate={{ opacity: 1, y: 0, rotate: 2, scale: 1 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="pile-label">Discard</span>
      <span className="pile-count">Face up</span>
    </div>
  )
}
