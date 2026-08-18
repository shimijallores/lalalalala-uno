import { useEffect, useReducer, useRef, useState } from 'react'
import { GameBoard } from '../components/GameBoard'
import { LandingScreen } from '../components/LandingScreen'
import { LobbyScreen } from '../components/LobbyScreen'
import { LeaveConfirmDialog } from '../components/LeaveConfirmDialog'
import type { EmojiAsset } from '../game/emojis'
import { GatewayError } from '../game/types'
import type { AuthenticatedPlayer, CommandName, EmojiReaction, PrivatePlayerView, RealtimeGateway, UnoColor } from '../game/types'
import { clientGameReducer, initialClientGameState } from '../game/reducer'
import { SupabaseGateway } from '../realtime/SupabaseGateway'
import { createClientActionId } from '../realtime/clientActionId'
import { localPreferences, getRoomCodeFromUrl } from '../storage/localPreferences'
import { isSfxMuted, setSfxMuted, unlockSfx } from '../audio/sfx'

function errorMessage(error: unknown): string {
  if (error instanceof GatewayError) return error.message
  if (error instanceof Error) return error.message
  return 'That did not reach the table. Check your connection and try again.'
}

export interface AppProps {
  gateway?: RealtimeGateway
}

export function App({ gateway: injectedGateway }: AppProps) {
  const gatewayRef = useRef<RealtimeGateway | null>(injectedGateway ?? null)
  if (!gatewayRef.current) gatewayRef.current = new SupabaseGateway()
  const gateway = gatewayRef.current
  const [clientState, update] = useReducer(clientGameReducer, initialClientGameState)
  const [player, setPlayer] = useState<AuthenticatedPlayer | null>(null)
  const [displayName, setDisplayName] = useState(localPreferences.getDisplayName())
  const [roomCode, setRoomCode] = useState(getRoomCodeFromUrl() || localPreferences.getLastRoomCode())
  const [copied, setCopied] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [reactions, setReactions] = useState<EmojiReaction[]>([])
  const [muted, setMuted] = useState(isSfxMuted())
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const reactionTimers = useRef(new Map<string, number>())
  const subscriptionRef = useRef<(() => Promise<void>) | null>(null)
  const leavingRef = useRef(false)

  const displayReaction = (reaction: EmojiReaction) => {
    setReactions((current) => [...current.filter((entry) => entry.id !== reaction.id), reaction])
    const existingTimer = reactionTimers.current.get(reaction.id)
    if (existingTimer) window.clearTimeout(existingTimer)
    const timer = window.setTimeout(() => {
      setReactions((current) => current.filter((entry) => entry.id !== reaction.id))
      reactionTimers.current.delete(reaction.id)
    }, 3000)
    reactionTimers.current.set(reaction.id, timer)
  }

  useEffect(() => {
    if (!gateway.isConfigured) {
      update({ type: 'connection-changed', connection: 'configuration-error' })
      return
    }

    let cancelled = false
    const boot = async () => {
      try {
        const session = await gateway.ensureSession()
        if (cancelled) return
        setPlayer(session)
        update({ type: 'connection-changed', connection: 'connected' })
        const lastRoomId = localPreferences.getLastRoomId()
        if (lastRoomId) {
          try {
            const restored = await gateway.getGameView(lastRoomId)
            if (!cancelled) await openView(restored, session.id)
          } catch {
            // A stale reconnect hint should never prevent a new room from being created.
          }
        }
      } catch (error) {
        if (!cancelled) {
          setBootError(errorMessage(error))
          update({ type: 'connection-changed', connection: error instanceof GatewayError && error.code === 'configuration_error' ? 'configuration-error' : 'offline' })
        }
      }
    }
    void boot()

    const onOnline = () => update({ type: 'connection-changed', connection: 'reconnecting' })
    const onOffline = () => update({ type: 'connection-changed', connection: 'offline' })
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (subscriptionRef.current) void subscriptionRef.current()
    }
    // The gateway is intentionally created once for the lifetime of the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway])

  const openView = async (nextView: PrivatePlayerView, playerId: string) => {
    update({ type: 'view-received', view: nextView })
    localPreferences.setLastRoomCode(nextView.roomCode)
    localPreferences.setLastRoomId(nextView.roomId)
    if (subscriptionRef.current) await subscriptionRef.current()
    subscriptionRef.current = await gateway.subscribe(nextView.roomId, playerId, {
      onEvent: () => undefined,
      onView: (view) => { if (!leavingRef.current) update({ type: 'view-received', view }) },
      onConnection: (connection) => update({ type: 'connection-changed', connection }),
      onReaction: displayReaction,
    })
  }

  const ensurePlayer = async (): Promise<AuthenticatedPlayer> => {
    if (player) return player
    const session = await gateway.ensureSession()
    setPlayer(session)
    return session
  }

  const handleCreate = async () => {
    const trimmedName = displayName.trim()
    if (!trimmedName || !gateway.isConfigured) return
    unlockSfx()
    update({ type: 'command-started', commandId: 'create_room' })
    setBootError(null)
    try {
      const session = await ensurePlayer()
      localPreferences.setDisplayName(trimmedName)
      const view = await gateway.createRoom(trimmedName)
      await openView(view, session.id)
    } catch (error) {
      update({ type: 'error', message: errorMessage(error) })
    }
  }

  const handleJoin = async () => {
    const trimmedName = displayName.trim()
    const normalizedCode = roomCode.trim().toUpperCase()
    if (!trimmedName || normalizedCode.length < 6 || !gateway.isConfigured) return
    unlockSfx()
    update({ type: 'command-started', commandId: 'join_room' })
    setBootError(null)
    try {
      const session = await ensurePlayer()
      localPreferences.setDisplayName(trimmedName)
      const view = await gateway.joinRoom(normalizedCode, trimmedName)
      await openView(view, session.id)
    } catch (error) {
      update({ type: 'error', message: errorMessage(error) })
    }
  }

  const sendCommand = async (action: CommandName, values: { cardId?: string; color?: UnoColor } = {}) => {
    const currentView = clientState.view
    const session = player
    if (!currentView || !session || clientState.pendingCommand || clientState.connection !== 'connected') return false
    const id = createClientActionId()
    update({ type: 'command-started', commandId: action })
    try {
      const nextView = await gateway.sendCommand({
        action,
        roomId: currentView.roomId,
        expectedStateVersion: currentView.stateVersion,
        clientActionId: id,
        ...values,
      })
      update({ type: 'view-received', view: nextView })
      return true
    } catch (error) {
      if (error instanceof GatewayError && error.code === 'stale_version') {
        try {
          const fresh = await gateway.getGameView(currentView.roomId)
          update({ type: 'view-received', view: fresh })
          update({ type: 'error', message: 'The table changed while you were playing. Your view is up to date.' })
          return false
        } catch {
          // The original error is more useful when a resync also fails.
        }
      }
      update({ type: 'error', message: errorMessage(error) })
      return false
    }
  }

  const performLeave = async () => {
    leavingRef.current = true
    setLeaving(true)
    const currentView = clientState.view
    try {
      if (currentView && player && clientState.connection === 'connected') {
        try {
          await gateway.sendCommand({ action: 'leave_room', roomId: currentView.roomId, expectedStateVersion: currentView.stateVersion, clientActionId: createClientActionId() })
        } catch {
          // Leaving locally is still the safest recovery when the network is gone.
        }
      }
      if (subscriptionRef.current) {
        await subscriptionRef.current()
        subscriptionRef.current = null
      }
      localPreferences.setLastRoomId('')
      localPreferences.setLastRoomCode('')
      setReactions([])
      update({ type: 'reset' })
      update({ type: 'connection-changed', connection: gateway.isConfigured ? 'connected' : 'configuration-error' })
      if (typeof window !== 'undefined') window.history.replaceState({}, '', window.location.pathname)
    } finally {
      leavingRef.current = false
      setLeaving(false)
      setLeaveConfirmOpen(false)
    }
  }

  const requestLeave = () => {
    if (!leaving) setLeaveConfirmOpen(true)
  }

  const handleEmoji = async (emoji: EmojiAsset) => {
    const currentView = clientState.view
    if (!currentView || !player || clientState.connection !== 'connected') return
    const reaction: EmojiReaction = {
      id: createClientActionId(),
      emojiKey: emoji.key,
      playerId: player.id,
      playerName: displayName.trim() || player.displayName || 'Player',
    }
    try {
      await gateway.sendReaction(currentView.roomId, reaction)
      displayReaction(reaction)
    } catch (error) {
      update({ type: 'error', message: errorMessage(error) })
    }
  }

  const handleStart = () => {
    unlockSfx()
    return sendCommand('start_game')
  }

  const toggleMute = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    setSfxMuted(nextMuted)
    if (!nextMuted) unlockSfx()
  }

  const copyInvite = async () => {
    const link = `${window.location.origin}/?room=${clientState.view?.roomCode ?? roomCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      update({ type: 'error', message: 'We could not copy the invite link. Select the room URL and copy it manually.' })
    }
  }

  const view = clientState.view
  const connection = clientState.connection
  const renderScreen = () => {
    if (!view) {
      return <LandingScreen displayName={displayName} roomCode={roomCode} configured={gateway.isConfigured} error={clientState.error ?? bootError} pending={clientState.pendingCommand} onDisplayNameChange={(value) => { setDisplayName(value); localPreferences.setDisplayName(value) }} onRoomCodeChange={setRoomCode} onCreate={handleCreate} onJoin={handleJoin} />
    }
    if (view.status === 'waiting') {
      return <LobbyScreen view={view} connection={connection} pending={clientState.pendingCommand} error={clientState.error} copied={copied} onCopy={copyInvite} onStart={handleStart} onLeave={requestLeave} />
    }
    return <GameBoard view={view} connection={connection} pending={clientState.pendingCommand} error={clientState.error} muted={muted} onToggleMute={toggleMute} reactions={reactions} onEmoji={handleEmoji} onCommand={sendCommand} onLeave={requestLeave} />
  }

  const liveText = view?.lastAction ? `${view.lastAction.playerName} ${view.lastAction.detail}` : clientState.notice ?? ''
  return <div className="app-shell"><div className="app-content">{renderScreen()}<LeaveConfirmDialog open={leaveConfirmOpen} pending={leaving} onCancel={() => setLeaveConfirmOpen(false)} onConfirm={performLeave} /><div className="sr-only" aria-live="polite">{liveText}</div></div></div>
}
