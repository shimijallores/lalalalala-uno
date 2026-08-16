import type { Card } from './types'

export const UNO_ASSET_BASE = '/assets/uno'

export function getCardAssetPath(card: Pick<Card, 'assetKey'>): string {
  return `${UNO_ASSET_BASE}/${card.assetKey}.png`
}

export function getCardAlt(card: Pick<Card, 'label' | 'kind'>): string {
  return card.kind === 'wild-draw-four' ? 'Wild Draw Four card' : `${card.label} card`
}

export const DECK_BACK_ASSET = `${UNO_ASSET_BASE}/Deck.png`
export const LANDING_BANNER_ASSET = `${UNO_ASSET_BASE}/Banner.png`
export const TABLE_ASSET = `${UNO_ASSET_BASE}/Table_3.png`
