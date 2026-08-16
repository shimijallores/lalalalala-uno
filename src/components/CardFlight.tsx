import { motion } from 'motion/react'
import { DECK_BACK_ASSET, getCardAlt, getCardAssetPath } from '../game/assets'
import type { Card } from '../game/types'

export type CardFlightOrigin = 'self-play' | 'opponent-play' | 'self-draw' | 'opponent-draw'

export interface CardFlightState {
  id: string
  origin: CardFlightOrigin
  card?: Card
}

export function CardFlight({ flight }: { flight: CardFlightState }) {
  const isDraw = flight.origin.endsWith('draw')
  const goesDown = flight.origin === 'self-play' || flight.origin === 'self-draw'
  const startY = goesDown ? 230 : -230
  return (
    <div className="card-flight-layer" aria-hidden="true">
      <motion.div
        key={flight.id}
        className={`card-flight ${isDraw ? 'draw-flight' : 'play-flight'}`}
        initial={isDraw ? { opacity: 0.9, y: 0, scale: 0.72, rotate: goesDown ? -5 : 5 } : { opacity: 0.78, y: startY, scale: 0.72, rotate: goesDown ? -9 : 9 }}
        animate={isDraw ? { opacity: [0.9, 1, 0], y: startY, scale: [0.72, 1, 0.82], rotate: goesDown ? -3 : 3 } : { opacity: [0.78, 1, 1, 0], y: 0, scale: [0.72, 1, 1, 0.88], rotate: 2 }}
        transition={{ duration: isDraw ? 0.58 : 0.68, ease: [0.16, 1, 0.3, 1], times: isDraw ? [0, 0.42, 1] : [0, 0.32, 0.7, 1] }}
      >
        <img src={flight.card ? getCardAssetPath(flight.card) : DECK_BACK_ASSET} alt={flight.card ? getCardAlt(flight.card) : 'UNO card back'} draggable={false} />
      </motion.div>
    </div>
  )
}
