import { Megaphone, ShieldAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function UnoCallControl({ canCall, canCatch, disabled, onCall, onCatch }: {
  canCall: boolean
  canCatch: boolean
  disabled: boolean
  onCall: () => void
  onCatch: () => void
}) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!canCall && !canCatch) setDismissed(false)
  }, [canCall, canCatch])

  if ((!canCall && !canCatch) || (dismissed && canCatch)) return null

  return (
    <>
      <div className="required-overlay" aria-hidden="true" />
      <div className="uno-modal" role="dialog" aria-modal="true" aria-labelledby="uno-modal-title">
        {canCall
          ? <>
            <h2 id="uno-modal-title">You have one card!</h2>
            <p>Call UNO before your opponent catches you.</p>
            <button type="button" className="uno-call-button" disabled={disabled} onClick={onCall}><Megaphone size={24} aria-hidden="true" /> UNO!</button>
          </>
          : <>
            <h2 id="uno-modal-title">Opponent has one card!</h2>
            <p>Catch them before they call UNO to make them draw 2 cards.</p>
            <button type="button" className="uno-catch-button" disabled={disabled} onClick={onCatch}><ShieldAlert size={24} aria-hidden="true" /> Catch UNO!</button>
            <button type="button" className="uno-modal-skip" onClick={() => setDismissed(true)}>Not now <X size={13} aria-hidden="true" /></button>
          </>}
      </div>
    </>
  )
}
