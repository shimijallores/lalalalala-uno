import { SmilePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { EmojiAsset } from '../game/emojis'

export function EmojiPicker({ emojis, disabled, onSelect }: { emojis: EmojiAsset[]; disabled: boolean; onSelect: (emoji: EmojiAsset) => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return (
    <div className="emoji-picker">
      <button ref={trigger} type="button" className="button button-quiet header-icon-button" aria-label="Open emoji reactions" aria-expanded={open} disabled={disabled || emojis.length === 0} onClick={() => setOpen((current) => !current)}>
        <SmilePlus size={16} aria-hidden="true" />
      </button>
      {open && <div className="emoji-menu" role="menu" aria-label="Emoji reactions">
        {emojis.map((emoji) => <button key={emoji.key} type="button" className="emoji-choice" role="menuitem" aria-label={`Send ${emoji.label}`} onClick={() => { onSelect(emoji); setOpen(false); trigger.current?.focus() }}><img src={emoji.src} alt="" aria-hidden="true" /></button>)}
      </div>}
    </div>
  )
}
