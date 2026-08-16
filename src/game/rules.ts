import { hasPlayableCard, isPlayable } from './deck'
import type { Card, UnoColor } from './types'

export function canPlayCard(card: Card, hand: Card[], topCard: Card, currentColor: UnoColor): boolean {
  return isPlayable(card, topCard, currentColor, hand)
}

export function legalCardIds(hand: Card[], topCard: Card, currentColor: UnoColor): Set<string> {
  return new Set(hand.filter((card) => canPlayCard(card, hand, topCard, currentColor)).map((card) => card.id))
}

export { hasPlayableCard, isPlayable }
