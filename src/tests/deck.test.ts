import { createDeck, dealInitialHands, shuffle } from '../game/deck'

describe('UNO deck', () => {
  it('creates exactly 108 cards with unique IDs', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(108)
    expect(new Set(deck.map((card) => card.id)).size).toBe(108)
  })

  it('matches the standard color composition', () => {
    const deck = createDeck()
    for (const color of ['red', 'blue', 'green', 'yellow'] as const) {
      const colored = deck.filter((card) => card.color === color)
      expect(colored).toHaveLength(25)
      expect(colored.filter((card) => card.kind === 'number' && card.number === 0)).toHaveLength(1)
      for (let number = 1; number <= 9; number += 1) {
        expect(colored.filter((card) => card.kind === 'number' && card.number === number)).toHaveLength(2)
      }
      expect(colored.filter((card) => card.kind === 'skip')).toHaveLength(2)
      expect(colored.filter((card) => card.kind === 'reverse')).toHaveLength(2)
      expect(colored.filter((card) => card.kind === 'draw-two')).toHaveLength(2)
    }
    expect(deck.filter((card) => card.kind === 'wild')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'wild-draw-four')).toHaveLength(4)
  })

  it('deals seven cards to each player and leaves a non-wild number on top', () => {
    const deal = dealInitialHands(shuffle(createDeck(), () => 0.37), ['player-a', 'player-b'])
    expect(deal.hands['player-a']).toHaveLength(7)
    expect(deal.hands['player-b']).toHaveLength(7)
    expect(deal.discardPile).toHaveLength(1)
    expect(deal.discardPile[0].kind).toBe('number')
    expect(deal.discardPile[0].color).not.toBe('wild')
    expect(deal.drawPile).toHaveLength(93)
  })
})
