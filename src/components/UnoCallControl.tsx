import { Megaphone, ShieldAlert } from 'lucide-react'

export function UnoCallControl({ canCall, canCatch, disabled, onCall, onCatch }: {
  canCall: boolean
  canCatch: boolean
  disabled: boolean
  onCall: () => void
  onCatch: () => void
}) {
  if (canCatch) {
    return <button type="button" className="button button-pink" disabled={disabled} onClick={onCatch}><ShieldAlert size={16} aria-hidden="true" /> Catch UNO!</button>
  }
  if (canCall) {
    return <button type="button" className="uno-call-button" disabled={disabled} onClick={onCall}><Megaphone size={17} aria-hidden="true" /> Call UNO!</button>
  }
  return null
}
