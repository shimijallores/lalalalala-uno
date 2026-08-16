export const UNO_COLORS = ['red', 'blue', 'green', 'yellow'] as const
export type UnoColor = (typeof UNO_COLORS)[number]
export type CardColor = UnoColor | 'wild'

export const CARD_KINDS = ['number', 'skip', 'reverse', 'draw-two', 'wild', 'wild-draw-four'] as const
export type CardKind = (typeof CARD_KINDS)[number]

export interface Card {
  id: string
  color: CardColor
  kind: CardKind
  number?: number
  assetKey: string
  label: string
}

export interface InitialDeal {
  hands: Record<string, Card[]>
  drawPile: Card[]
  discardPile: Card[]
}

export interface DrawResult {
  cards: Card[]
  drawPile: Card[]
  discardPile: Card[]
}

export interface DrawUntilPlayableResult extends DrawResult {
  cards: Card[]
  playableCard: Card | null
}

export interface CardEffect {
  drawCount: number
  skip: boolean
  nextPlayerIndex: number
}

export type UnoResolution = 'none' | 'pending' | 'called' | 'penalty'

const colorTitle = (color: UnoColor) => color[0].toUpperCase() + color.slice(1)
const kindTitle = (kind: CardKind) => kind === 'draw-two' ? 'Draw Two' : kind === 'wild-draw-four' ? 'Wild Draw Four' : kind[0].toUpperCase() + kind.slice(1)

const makeCard = (color: UnoColor, kind: CardKind, copy: number, number?: number): Card => {
  const prefix = colorTitle(color)
  const suffix = kind === 'number' ? String(number) : kind === 'draw-two' || kind === 'wild-draw-four' ? 'Draw' : kindTitle(kind)
  const assetKey = kind === 'number' ? `${prefix}_${number}` : `${prefix}_${suffix}`
  const label = kind === 'number' ? `${prefix} ${number}` : `${prefix} ${kindTitle(kind)}`

  return {
    id: `${color}-${kind}-${number ?? 'action'}-${copy}`,
    color,
    kind,
    ...(number === undefined ? {} : { number }),
    assetKey,
    label,
  }
}

const makeWild = (kind: Extract<CardKind, 'wild' | 'wild-draw-four'>, copy: number): Card => ({
  id: `${kind}-${copy}`,
  color: 'wild',
  kind,
  assetKey: kind === 'wild' ? 'Wild' : 'Wild_Draw',
  label: kind === 'wild' ? 'Wild' : 'Wild Draw Four',
})

/** Creates the complete standard 108-card UNO deck with stable, unique IDs. */
export function createDeck(): Card[] {
  const deck: Card[] = []

  for (const color of UNO_COLORS) {
    deck.push(makeCard(color, 'number', 1, 0))
    for (let number = 1; number <= 9; number += 1) {
      deck.push(makeCard(color, 'number', 1, number))
      deck.push(makeCard(color, 'number', 2, number))
    }
    for (const kind of ['skip', 'reverse', 'draw-two'] as const) {
      deck.push(makeCard(color, kind, 1))
      deck.push(makeCard(color, kind, 2))
    }
  }

  for (let copy = 1; copy <= 4; copy += 1) {
    deck.push(makeWild('wild', copy))
    deck.push(makeWild('wild-draw-four', copy))
  }

  return deck
}

/** Fisher-Yates shuffle with injectable randomness for deterministic tests and server seeds. */
export function shuffle<T>(cards: T[], random: () => number = Math.random): T[] {
  const shuffled = [...cards]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = current
  }
  return shuffled
}

/** Deals seven cards and chooses a non-wild number for the opening discard. */
export function dealInitialHands(deck: Card[], playerIds: string[]): InitialDeal {
  if (playerIds.length < 2) {
    throw new Error('UNO requires two players to deal a game')
  }

  const working = [...deck]
  const hands: Record<string, Card[]> = {}
  for (const playerId of playerIds) {
    hands[playerId] = []
    for (let card = 0; card < 7; card += 1) {
      const dealt = working.shift()
      if (!dealt) throw new Error('Not enough cards to deal a seven-card hand')
      hands[playerId].push(dealt)
    }
  }

  const openingIndex = working.findIndex((card) => card.kind === 'number' && card.color !== 'wild')
  if (openingIndex < 0) throw new Error('A shuffled deck must contain an opening number card')
  const openingCard = working.splice(openingIndex, 1)[0]

  return {
    hands,
    drawPile: working,
    discardPile: [openingCard],
  }
}

export function isPlayable(card: Card, topCard: Card, currentColor: UnoColor, hand: Card[] = []): boolean {
  if (card.kind === 'wild') return true
  if (card.kind === 'wild-draw-four') {
    return !hand.some((handCard) => handCard.color === currentColor)
  }
  if (card.color === currentColor) return true
  if (card.kind === 'number' && topCard.kind === 'number' && card.number === topCard.number) return true
  if (card.kind !== 'number' && card.kind === topCard.kind) return true
  return false
}

export function hasPlayableCard(hand: Card[], topCard: Card, currentColor: UnoColor): boolean {
  return hand.some((card) => isPlayable(card, topCard, currentColor, hand))
}

export function getNextPlayer(currentPlayerIndex: number, playerCount: number, steps = 1): number {
  if (playerCount < 2) throw new Error('A turn requires at least two players')
  return (currentPlayerIndex + steps) % playerCount
}

export function applyCardEffect(card: Card, currentPlayerIndex: number, playerCount: number): CardEffect {
  const skip = card.kind === 'skip' || card.kind === 'reverse' || card.kind === 'draw-two' || card.kind === 'wild-draw-four'
  const drawCount = card.kind === 'draw-two' ? 2 : card.kind === 'wild-draw-four' ? 4 : 0
  return {
    drawCount,
    skip,
    nextPlayerIndex: getNextPlayer(currentPlayerIndex, playerCount, skip ? 2 : 1),
  }
}

export function reshuffleDiscardPile(discardPile: Card[], random: () => number = Math.random): { drawPile: Card[]; discardPile: Card[] } {
  if (discardPile.length <= 1) {
    return { drawPile: [], discardPile: [...discardPile] }
  }
  const topCard = discardPile[discardPile.length - 1]
  return {
    drawPile: shuffle(discardPile.slice(0, -1), random),
    discardPile: [topCard],
  }
}

/** Draws cards and reshuffles every discard except the visible top card when needed. */
export function drawCards(drawPile: Card[], discardPile: Card[], count: number, random: () => number = Math.random): DrawResult {
  if (count < 0) throw new Error('Cannot draw a negative number of cards')
  let nextDrawPile = [...drawPile]
  let nextDiscardPile = [...discardPile]
  const cards: Card[] = []

  while (cards.length < count) {
    if (nextDrawPile.length === 0) {
      const reshuffled = reshuffleDiscardPile(nextDiscardPile, random)
      nextDrawPile = reshuffled.drawPile
      nextDiscardPile = reshuffled.discardPile
      if (nextDrawPile.length === 0) break
    }
    cards.push(nextDrawPile.shift() as Card)
  }

  return { cards, drawPile: nextDrawPile, discardPile: nextDiscardPile }
}

/** Draws until the first playable card is found, keeping every drawn card in the hand. */
export function drawUntilPlayable(
  drawPile: Card[],
  discardPile: Card[],
  hand: Card[],
  topCard: Card,
  currentColor: UnoColor,
  random: () => number = Math.random,
): DrawUntilPlayableResult {
  let nextDrawPile = [...drawPile]
  let nextDiscardPile = [...discardPile]
  const cards: Card[] = []
  let playableCard: Card | null = null
  let nextHand = [...hand]

  while (!playableCard) {
    const result = drawCards(nextDrawPile, nextDiscardPile, 1, random)
    nextDrawPile = result.drawPile
    nextDiscardPile = result.discardPile
    const drawnCard = result.cards[0]
    if (!drawnCard) break
    cards.push(drawnCard)
    nextHand = [...nextHand, drawnCard]
    if (isPlayable(drawnCard, topCard, currentColor, nextHand)) playableCard = drawnCard
  }

  return { cards, playableCard, drawPile: nextDrawPile, discardPile: nextDiscardPile }
}

export function resolveUnoState(input: {
  handCount: number
  called: boolean
  caught?: boolean
  continuedWithoutCall?: boolean
}): UnoResolution {
  if (input.handCount !== 1) return 'none'
  if (input.called) return 'called'
  if (input.caught || input.continuedWithoutCall) return 'penalty'
  return 'pending'
}

export function getWinner(hands: Record<string, Card[]>): string | null {
  return Object.entries(hands).find(([, hand]) => hand.length === 0)?.[0] ?? null
}
