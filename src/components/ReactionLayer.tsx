import { AnimatePresence, motion } from 'motion/react'
import { findEmojiAsset } from '../game/emojis'
import type { EmojiReaction } from '../game/types'

export function ReactionLayer({ reactions, selfPlayerId }: { reactions: EmojiReaction[]; selfPlayerId: string }) {
  return (
    <div className="reaction-layer" aria-live="polite">
      <AnimatePresence initial={false}>
        {reactions.map((reaction, index) => {
          const emoji = findEmojiAsset(reaction.emojiKey)
          if (!emoji) return null
          const mine = reaction.playerId === selfPlayerId
          return (
            <motion.div
              key={reaction.id}
              className={`reaction-burst ${mine ? 'mine' : 'opponent'}`}
              style={{ '--reaction-index': index } as React.CSSProperties}
              initial={{ opacity: 0, scale: 0.45, y: mine ? 24 : -24, rotate: mine ? -12 : 12 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: mine ? -4 : 4 }}
              exit={{ opacity: 0, scale: 0.7, y: mine ? -30 : 30 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <img src={emoji.src} alt={`${reaction.playerName} sent ${emoji.label}`} />
              <span>{reaction.playerName}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
