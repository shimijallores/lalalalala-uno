import { useEffect, useRef, useState } from 'react'
import { DECK_BACK_ASSET, getCardAlt, getCardAssetPath } from '../game/assets'
import type { Card } from '../game/types'

interface UnoCardProps {
  card?: Card
  faceDown?: boolean
  disabled?: boolean
  legal?: boolean
  pending?: boolean
  dragging?: boolean
  index?: number
  onPlay?: (card: Card) => void
  onCardDragStart?: (card: Card) => void
  onCardDragEnd?: () => void
  onCardDrop?: (card: Card) => void
}

export function UnoCard({ card, faceDown = false, disabled = false, legal = false, pending = false, dragging = false, index = 0, onPlay, onCardDragStart, onCardDragEnd, onCardDrop }: UnoCardProps) {
  const pointerStart = useRef<{ id: number; x: number; y: number; type: string } | null>(null)
  const didPointerDrag = useRef(false)
  const [pointerDragging, setPointerDragging] = useState(false)
  const cardLabel = faceDown ? 'Hidden UNO card back' : card ? `Play ${card.label}` : 'UNO card'
  const classes = [
    'uno-card',
    legal ? 'legal' : '',
    !legal && !faceDown ? 'invalid' : '',
    pending ? 'pending' : '',
    dragging || pointerDragging ? 'dragging' : '',
  ].filter(Boolean).join(' ')

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const start = pointerStart.current
      if (!start || !card || event.pointerId !== start.id || start.type === 'mouse') return
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
      if (distance < 10) return
      event.preventDefault()
      if (!pointerDragging) {
        didPointerDrag.current = true
        setPointerDragging(true)
        onCardDragStart?.(card)
      }
    }
    const handleUp = (event: PointerEvent) => {
      const start = pointerStart.current
      if (!start || event.pointerId !== start.id) return
      if (pointerDragging && card) {
        const target = document.elementFromPoint(event.clientX, event.clientY)
        if (target?.closest('[data-discard-drop-target="true"]')) onCardDrop?.(card)
        onCardDragEnd?.()
      }
      pointerStart.current = null
      setPointerDragging(false)
    }
    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [card, onCardDragEnd, onCardDragStart, onCardDrop, pointerDragging])

  return (
    <button
      type="button"
      className={classes}
      style={{ '--card-index': index } as React.CSSProperties}
      aria-label={cardLabel}
      disabled={disabled || faceDown || !card}
      draggable={!disabled && !faceDown && Boolean(card)}
      onPointerDown={(event) => {
        if (!disabled && !faceDown && card) pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType }
      }}
      onClick={() => {
        if (didPointerDrag.current) {
          didPointerDrag.current = false
          return
        }
        if (card) onPlay?.(card)
      }}
      onDragStart={(event) => {
        if (!card) return
        const dataTransfer = 'dataTransfer' in event ? event.dataTransfer as DataTransfer : null
        if (dataTransfer) {
          dataTransfer.effectAllowed = 'move'
          dataTransfer.setData('text/plain', card.id)
        }
        onCardDragStart?.(card)
      }}
      onDragEnd={() => onCardDragEnd?.()}
    >
      <img src={faceDown ? DECK_BACK_ASSET : card ? getCardAssetPath(card) : DECK_BACK_ASSET} alt={faceDown ? 'Hidden UNO card back' : card ? getCardAlt(card) : 'UNO card'} draggable={false} />
    </button>
  )
}
