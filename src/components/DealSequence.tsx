import { motion } from 'motion/react'
import { useEffect } from 'react'

export function DealSequence({ phase, onComplete }: { phase: 'mixing' | 'dealing'; onComplete: () => void }) {
  const dealing = phase === 'dealing'

  useEffect(() => {
    const timer = window.setTimeout(onComplete, 3000)
    return () => window.clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="deal-sequence" aria-live="polite" aria-label={dealing ? 'Dealing cards' : 'Shuffling cards'}>
      <div className="deal-deck" aria-hidden="true">
        {[0, 1, 2, 3].map((card) => <motion.img key={card} src="/assets/uno/Deck.png" alt="" initial={{ x: 0, y: 0, rotate: card * 2 - 3 }} animate={dealing ? { x: [0, (card - 1.5) * 42, 0], y: [0, card % 2 === 0 ? -18 : 18, 0], rotate: [0, (card - 1.5) * 8, 0] } : { x: [0, (card - 1.5) * 20, 0], y: [0, card % 2 === 0 ? -14 : 14, 0], rotate: [card * 2 - 3, card % 2 === 0 ? -12 : 12, card * 2 - 3] }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut', delay: card * 0.05 }} />)}
      </div>
      <strong>{dealing ? 'Dealing hands' : 'Shuffling deck'}</strong>
    </div>
  )
}
