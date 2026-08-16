import { LogOut, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function LeaveConfirmDialog({ open, pending, onCancel, onConfirm }: { open: boolean; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, open, pending])

  if (!open) return null

  return (
    <div className="leave-confirm-backdrop" role="presentation">
      <section className="leave-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
        <header>
          <div><span className="leave-confirm-kicker">Leave table</span><h2 id="leave-confirm-title">Leave this room?</h2></div>
          <button type="button" className="button button-quiet header-icon-button" aria-label="Keep playing" disabled={pending} onClick={onCancel}><X size={17} aria-hidden="true" /></button>
        </header>
        <p>Your opponent will see you leave. You can rejoin with the room code later.</p>
        <div className="leave-confirm-actions">
          <button ref={cancelButton} type="button" className="button button-secondary" disabled={pending} onClick={onCancel}>Keep playing</button>
          <button type="button" className="button button-leave" disabled={pending} onClick={onConfirm}><LogOut size={16} aria-hidden="true" />{pending ? 'Leaving...' : 'Leave room'}</button>
        </div>
      </section>
    </div>
  )
}
