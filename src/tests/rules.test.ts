import { applyCardEffect, createDeck, drawCards, getWinner, hasPlayableCard, isPlayable, reshuffleDiscardPile, resolveUnoState } from '../game/deck'
import type { Card } from '../game/types'

const card = (color: Card['color'], kind: Card['kind'], number?: number): Card => ({
  id: `${color}-${kind}-${number ?? 'x'}`,
  color,
  kind,
  ...(number === undefined ? {} : { number }),
  assetKey: 'Red_0',
  label: `${color} ${kind}`,
})

describe('UNO rules', () => {
  it('supports color, number, action, and wild matching', () => {
    const top = card('red', 'number', 7)
    expect(isPlayable(card('red', 'number', 2), top, 'red')).toBe(true)
    expect(isPlayable(card('blue', 'number', 7), top, 'red')).toBe(true)
    expect(isPlayable(card('blue', 'number', 2), top, 'red')).toBe(false)
    expect(isPlayable(card('wild', 'wild'), top, 'red')).toBe(true)
    expect(hasPlayableCard([card('blue', 'number', 7)], top, 'red')).toBe(true)
  })

  it('matches actions by kind and restricts Wild Draw Four by color', () => {
    const skip = card('blue', 'skip')
    expect(isPlayable(card('red', 'skip'), skip, 'blue')).toBe(true)
    const wildDrawFour = card('wild', 'wild-draw-four')
    expect(isPlayable(wildDrawFour, skip, 'blue', [card('blue', 'number', 4)])).toBe(false)
    expect(isPlayable(wildDrawFour, skip, 'blue', [card('red', 'number', 4)])).toBe(true)
  })

  it('treats Reverse as Skip in a two-player game and applies draw effects', () => {
    expect(applyCardEffect(card('red', 'skip'), 0, 2)).toMatchObject({ nextPlayerIndex: 0, skip: true, drawCount: 0 })
    expect(applyCardEffect(card('red', 'reverse'), 0, 2)).toMatchObject({ nextPlayerIndex: 0, skip: true, drawCount: 0 })
    expect(applyCardEffect(card('red', 'draw-two'), 0, 2)).toMatchObject({ nextPlayerIndex: 0, skip: true, drawCount: 2 })
    expect(applyCardEffect(card('wild', 'wild-draw-four'), 0, 2)).toMatchObject({ nextPlayerIndex: 0, skip: true, drawCount: 4 })
  })

  it('reshuffles the discard pile except its top card when drawing', () => {
    const deck = createDeck()
    const discard = [deck[0], deck[1], deck[2]]
    const reshuffled = reshuffleDiscardPile(discard, () => 0.2)
    expect(reshuffled.discardPile).toEqual([deck[2]])
    expect(reshuffled.drawPile).toHaveLength(2)
    const result = drawCards([], discard, 2, () => 0.2)
    expect(result.cards).toHaveLength(2)
    expect(result.discardPile).toEqual([deck[2]])
  })

  it('resolves UNO call, catch, penalty, and winner states', () => {
    expect(resolveUnoState({ handCount: 1, called: false })).toBe('pending')
    expect(resolveUnoState({ handCount: 1, called: true })).toBe('called')
    expect(resolveUnoState({ handCount: 1, called: false, caught: true })).toBe('penalty')
    expect(resolveUnoState({ handCount: 1, called: false, continuedWithoutCall: true })).toBe('penalty')
    expect(getWinner({ a: [], b: [card('blue', 'number', 1)] })).toBe('a')
  })
})
