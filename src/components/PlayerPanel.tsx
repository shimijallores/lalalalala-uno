import { Wifi, WifiOff } from 'lucide-react'
import type { PublicPlayer } from '../game/types'

function initials(name: string): string {
  return name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '??'
}

export function PlayerPanel({ player, pink = false }: { player: PublicPlayer; pink?: boolean }) {
  return (
    <div className="player-panel">
      <div className={`player-avatar ${pink ? 'pink' : ''}`} aria-hidden="true">{initials(player.displayName)}</div>
      <div className="player-panel-copy">
        <strong>{player.displayName}</strong>
        <span>{player.isHost ? 'Host' : 'Challenger'} · {player.handCount} cards</span>
      </div>
      <span className={`player-status ${player.isOnline ? '' : 'offline'}`}>
        {player.isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
        {player.isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

export function PlayerAvatar({ name, pink = false }: { name: string; pink?: boolean }) {
  return <div className={`player-avatar ${pink ? 'pink' : ''}`} aria-hidden="true">{initials(name)}</div>
}
