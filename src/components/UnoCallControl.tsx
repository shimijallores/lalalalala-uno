import { Megaphone, ShieldAlert } from 'lucide-react'

export function UnoCallControl({ canCall, canCatch, disabled, onCall, onCatch }: {
  canCall: boolean
  canCatch: boolean
  disabled: boolean
  onCall: () => void
  onCatch: () => void
}) {
  if (canCatch) {
    return <button type="button" className="uno-catch-button" disabled={disabled} onClick={onCatch}><ShieldAlert size={20} aria-hidden="true" /> Catch UNO!</button>
  }
  if (canCall) {
    return <button type="button" className="uno-call-button" disabled={disabled} onClick={onCall}><Megaphone size={20} aria-hidden="true" /> UNO!</button>
  }
  return null
}
