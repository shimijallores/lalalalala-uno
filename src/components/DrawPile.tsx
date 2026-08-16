import { motion } from 'motion/react'
import { DECK_BACK_ASSET } from '../game/assets'

export function DrawPile({ count, disabled, onDraw }: { count: number; disabled: boolean; onDraw: () => void }) {
  return (
    <div className="pile-area">
      <motion.button
        type="button"
        className="deck-button"
        aria-label={`Draw a card. ${count} cards remain in the draw pile.`}
        disabled={disabled}
        onClick={onDraw}
        whileTap={!disabled ? { scale: 0.96, rotate: -3 } : undefined}
        whileHover={!disabled ? { y: -5, rotate: -2 } : undefined}
        transition={{ duration: 0.18 }}
      >
        <img src={DECK_BACK_ASSET} alt="UNO draw pile card back" draggable={false} />
      </motion.button>
      <span className="pile-label">Draw pile</span>
      <span className="pile-count" aria-live="polite">{count} cards</span>
    </div>
  )
}
