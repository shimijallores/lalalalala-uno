import { useEffect, useRef, useState } from 'react'
import { FlagTriangleRight } from 'lucide-react'
import { EMOJI_ASSETS, type EmojiAsset } from '../game/emojis'
import type { Card, ConnectionState, EmojiReaction, PrivatePlayerView, UnoColor } from '../game/types'
import { ConnectionStatus } from './ConnectionStatus'
import { ColorPicker } from './ColorPicker'
import { CardFlight, type CardFlightState } from './CardFlight'
import { DealSequence } from './DealSequence'
import { DiscardPile } from './DiscardPile'
import { DrawPile } from './DrawPile'
import { EmojiPicker } from './EmojiPicker'
import { GameHeader } from './GameHeader'
import { Hand } from './Hand'
import { PlayerAvatar, PlayerPanel } from './PlayerPanel'
import { RulesPanel } from './RulesPanel'
import { ReactionLayer } from './ReactionLayer'
import { UnoCallControl } from './UnoCallControl'
import { WinnerOverlay } from './WinnerOverlay'
import { playSfx, unlockSfx } from '../audio/sfx'

export function GameBoard({ view, connection, pending, error, muted = false, onToggleMute = () => undefined, reactions = [], onEmoji = () => undefined, onCommand, onLeave }: {
  view: PrivatePlayerView
  connection: ConnectionState
  pending: string | null
  error: string | null
  muted?: boolean
  onToggleMute?: () => void
  reactions?: EmojiReaction[]
  onEmoji?: (emoji: EmojiAsset) => void
  onCommand: (action: 'play_card' | 'draw_card' | 'choose_color' | 'call_uno' | 'catch_uno' | 'request_rematch' | 'forfeit_game' | 'turn_timeout', values?: { cardId?: string; color?: UnoColor }) => void | Promise<boolean>
  onLeave: () => void
}) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [wildCard, setWildCard] = useState<Card | null>(null)
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)
  const [opponentOfflineSince, setOpponentOfflineSince] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [cardFlight, setCardFlight] = useState<CardFlightState | null>(null)
  const [dealPhase, setDealPhase] = useState<'mixing' | 'dealing' | null>(null)
  const previousView = useRef<PrivatePlayerView | null>(null)
  const flightTimer = useRef<number | null>(null)
  const timeoutAttempt = useRef<string | null>(null)
  const dealMarker = useRef<string | null>(null)
  const opponent = view.players.find((player) => player.id !== view.selfPlayerId)
  const local = view.players.find((player) => player.id === view.selfPlayerId)
  const myTurn = view.currentPlayerId === view.selfPlayerId
  const canDraw = myTurn && (view.turnPhase === 'playing' || view.turnPhase === 'penalty')
  const lastAction = view.lastAction
  const opponentIsOffline = Boolean(opponent && !opponent.isOnline)
  const canForfeit = opponentOfflineSince !== null && Date.now() - opponentOfflineSince >= 30000
  const secondsRemaining = view.turnDeadlineAt ? Math.max(0, Math.ceil((Date.parse(view.turnDeadlineAt) - now) / 1000)) : null
  const timerUrgent = secondsRemaining !== null && secondsRemaining <= 10

  useEffect(() => {
    if (view.turnPhase === 'choose-color' && myTurn && view.topDiscard.color === 'wild') {
      setWildCard(view.topDiscard)
    } else if (view.turnPhase !== 'choose-color') {
      setWildCard(null)
    }
  }, [myTurn, view.selfPlayerId, view.topDiscard, view.turnPhase])

  useEffect(() => {
    if (!opponentIsOffline) {
      setOpponentOfflineSince(null)
      return
    }
    setOpponentOfflineSince((current) => current ?? Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [opponentIsOffline])

  useEffect(() => {
    if (!view.turnDeadlineAt || view.status !== 'active') return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [view.status, view.turnDeadlineAt])

  useEffect(() => {
    if (secondsRemaining !== 0 || !view.turnDeadlineAt || pending || connection !== 'connected' || timeoutAttempt.current === view.turnDeadlineAt) return
    timeoutAttempt.current = view.turnDeadlineAt
    onCommand('turn_timeout')
  }, [connection, onCommand, pending, secondsRemaining, view.turnDeadlineAt])

  useEffect(() => {
    const previous = previousView.current
    if (previous && view.stateVersion > previous.stateVersion && view.lastAction) {
      const isMine = view.lastAction.playerName === local?.displayName
      let nextFlight: CardFlightState | null = null
      if (view.lastAction.type === 'card-played' && view.topDiscard.id !== previous.topDiscard.id) {
        nextFlight = { id: `play-${view.stateVersion}`, origin: isMine ? 'self-play' : 'opponent-play', card: view.topDiscard }
      } else if (view.lastAction.type === 'card-drawn') {
        nextFlight = { id: `draw-${view.stateVersion}`, origin: isMine ? 'self-draw' : 'opponent-draw' }
      }
      if (nextFlight) {
        setCardFlight(nextFlight)
        playSfx('card-choose', 0.62)
        if (flightTimer.current) window.clearTimeout(flightTimer.current)
        flightTimer.current = window.setTimeout(() => setCardFlight(null), 750)
      }
    }
    previousView.current = view
  }, [local?.displayName, view])

  useEffect(() => {
    const startMarker = view.lastAction?.at
    if (view.status !== 'active' || !startMarker || !view.lastAction?.detail.includes('started the round') || dealMarker.current === startMarker) return
    dealMarker.current = startMarker
    setDealPhase('mixing')
    playSfx('card-mix', 0.72)
    const dealTimer = window.setTimeout(() => {
      setDealPhase('dealing')
      playSfx('card-choose', 0.62)
    }, 700)
    const doneTimer = window.setTimeout(() => setDealPhase(null), 3000)
    return () => {
      window.clearTimeout(dealTimer)
      window.clearTimeout(doneTimer)
    }
  }, [view.lastAction?.at, view.lastAction?.detail, view.status])

  const playCard = (card: Card) => {
    unlockSfx()
    if (card.color === 'wild') {
      onCommand('play_card', { cardId: card.id })
      return
    }
    onCommand('play_card', { cardId: card.id })
  }

  const beginCardDrag = (card: Card) => {
    if (!myTurn || pending || connection !== 'connected') return
    setDraggedCard(card)
  }

  const endCardDrag = () => setDraggedCard(null)

  const dropCardOnDiscard = (card: Card) => {
    setDraggedCard(null)
    playCard(card)
  }

  const chooseColor = (color: UnoColor) => {
    if (!wildCard) return
    const result = onCommand('choose_color', { cardId: wildCard.id, color })
    if (result instanceof Promise) void result.then((accepted) => { if (accepted) setWildCard(null); else setWildCard(view.topDiscard) })
    else setWildCard(null)
  }

  return (
    <main id="main-content" className="game-shell">
      <GameHeader view={view} muted={muted} onToggleMute={onToggleMute} onRules={() => setRulesOpen(true)} onLeave={onLeave} />
      {connection !== 'connected' && connection !== 'configuration-error' && <div className={`connection-banner ${connection === 'offline' ? 'offline' : ''}`}><ConnectionStatus state={connection} /> <span>{connection === 'reconnecting' ? 'Your match is paused while we reconnect.' : 'State-changing controls are paused.'}</span></div>}
      <section className="table-board" aria-label="UNO game table">
        <section className="opponent-zone" aria-label={`Opponent ${opponent?.displayName ?? 'seat'}`}>
          {opponent ? <PlayerPanel player={opponent} /> : <div className="player-panel"><div className="player-avatar" aria-hidden="true">?</div><div className="player-panel-copy"><strong>Opponent</strong><span>Waiting for player</span></div></div>}
          <div className="hand-back-row" aria-label={`${opponent?.handCount ?? 0} opponent cards, identities hidden`}>
            {Array.from({ length: Math.min(opponent?.handCount ?? 0, 10) }, (_, index) => <img key={index} className="mini-card-back" src="/assets/uno/Deck.png" alt="" aria-hidden="true" />)}
          </div>
        </section>

        <section className="table-center" aria-live="polite">
          <DrawPile count={view.drawPileCount} disabled={!canDraw || Boolean(pending)} onDraw={() => { unlockSfx(); onCommand('draw_card') }} />
          <DiscardPile card={view.topDiscard} dropActive={Boolean(draggedCard)} onDrop={() => draggedCard && dropCardOnDiscard(draggedCard)} />
          {lastAction && <p className="last-move"><strong>{lastAction.playerName}</strong> {lastAction.detail}</p>}
          <p className={`table-turn-message ${myTurn ? 'yours' : ''}`}>{myTurn ? 'Your turn' : `${opponent?.displayName ?? 'Opponent'}'s turn`}</p>
        </section>

        <section className="local-zone" aria-label="Your side of the table">
          {local && <div className="local-player-stack"><div className="local-player-badge"><PlayerAvatar name={local.displayName} pink /><div><strong>{local.displayName}</strong><span>Player 1</span></div></div><div className="local-player-controls"><EmojiPicker emojis={EMOJI_ASSETS} disabled={connection !== 'connected'} onSelect={onEmoji} />{canForfeit && <button type="button" className="button button-forfeit header-icon-button" aria-label="Forfeit game" disabled={Boolean(pending) || connection !== 'connected'} onClick={() => onCommand('forfeit_game')}><FlagTriangleRight size={15} aria-hidden="true" /></button>}</div></div>}
          <div className="your-turn">{secondsRemaining !== null && <span className={`turn-timer ${timerUrgent ? 'urgent' : ''}`} aria-label={`${secondsRemaining} seconds remaining`}>{secondsRemaining}s</span>}<span className="hand-count"><strong>{local?.handCount ?? view.ownHand.length}</strong><span>cards</span></span></div>
          <Hand view={view} pendingCommand={pending} draggedCardId={draggedCard?.id} onPlay={playCard} onCardDragStart={beginCardDrag} onCardDragEnd={endCardDrag} onCardDrop={dropCardOnDiscard} />
          <div className="local-actions">
            <UnoCallControl canCall={view.legalActions.includes('call-uno')} canCatch={view.legalActions.includes('catch-uno')} disabled={Boolean(pending) || connection !== 'connected'} onCall={() => onCommand('call_uno')} onCatch={() => onCommand('catch_uno')} />
            {canDraw && <button type="button" className="button button-pass" disabled={Boolean(pending) || connection !== 'connected'} onClick={() => { unlockSfx(); onCommand('draw_card') }}>Pass</button>}
            {error && <span className="action-hint" role="alert">{error}</span>}
          </div>
        </section>
        <ReactionLayer reactions={reactions} selfPlayerId={view.selfPlayerId} />
      </section>
      {rulesOpen && <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />}
      {wildCard && <ColorPicker error={error} disabled={Boolean(pending)} onChoose={chooseColor} />}
      {cardFlight && <CardFlight flight={cardFlight} />}
      {dealPhase && <DealSequence phase={dealPhase} onComplete={() => setDealPhase(null)} />}
      {view.status === 'finished' && <WinnerOverlay view={view} pending={pending === 'request_rematch'} onRequestRematch={() => onCommand('request_rematch')} onLeave={onLeave} />}
    </main>
  )
}
