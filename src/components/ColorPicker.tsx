import type { UnoColor } from '../game/types'

const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow']

export function ColorPicker({ onChoose, disabled = false, error = null }: { onChoose: (color: UnoColor) => void; disabled?: boolean; error?: string | null }) {
  return (
    <>
      <div className="required-overlay" aria-hidden="true" />
      <div className="color-picker-popover" role="dialog" aria-modal="true" aria-labelledby="color-picker-title">
        <h2 id="color-picker-title">Pick the next color</h2>
        <p>Your Wild card is on the table. Choose the color your opponent must match.</p>
        {error && <div className="inline-message error" role="alert">{error}</div>}
        <div className="color-options">
          {colors.map((color) => (
            <button key={color} type="button" className={`color-choice ${color}`} disabled={disabled} onClick={() => onChoose(color)} aria-label={`Choose ${color}`}>
              <span aria-hidden="true">●</span>
              {color}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
