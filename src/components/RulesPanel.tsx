import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function RulesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <aside className="rules-sheet" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <header>
        <h2 id="rules-title">Quick rules</h2>
        <button ref={closeButton} type="button" className="button button-quiet" aria-label="Close rules" onClick={onClose}><X size={17} aria-hidden="true" /></button>
      </header>
      <ul>
        <li>Match the top card by color, number, or action. Wild cards are always playable.</li>
        <li>Wild Draw Four is legal only when you have no card matching the current color.</li>
        <li>Draw exactly one card when you have no legal play. If it fits, play it; otherwise the turn advances automatically.</li>
        <li>Skip, Reverse, Draw Two, and Wild Draw Four all move the turn to your opponent in a 1v1.</li>
        <li>When you reach one card, call UNO before your next move. A catch adds two cards.</li>
      </ul>
    </aside>
  )
}
