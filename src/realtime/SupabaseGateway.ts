import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { GatewayError } from '../game/types'
import { createClientActionId } from './clientActionId'
import type {
  AuthenticatedPlayer,
  CommandInput,
  EmojiReaction,
  GatewayCallbacks,
  PrivatePlayerView,
  RealtimeGateway,
} from '../game/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function unwrapView(payload: unknown): PrivatePlayerView {
  if (payload && typeof payload === 'object' && 'view' in payload) {
    return (payload as { view: PrivatePlayerView }).view
  }
  return payload as PrivatePlayerView
}

function describeFunctionError(error: { message?: string } | null, fallback: string): string {
  return error?.message || fallback
}

export class SupabaseGateway implements RealtimeGateway {
  readonly isConfigured = isSupabaseConfigured
  private readonly client: SupabaseClient | null
  private readonly reactionChannels = new Map<string, RealtimeChannel>()

  constructor() {
    this.client = isSupabaseConfigured ? createClient(supabaseUrl as string, supabaseAnonKey as string) : null
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new GatewayError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.', 'configuration_error')
    }
    return this.client
  }

  async ensureSession(): Promise<AuthenticatedPlayer> {
    const client = this.requireClient()
    const current = await client.auth.getSession()
    let user = current.data.session?.user ?? null
    if (!user) {
      const signedIn = await client.auth.signInAnonymously()
      if (signedIn.error || !signedIn.data.user) {
        throw new GatewayError(describeFunctionError(signedIn.error, 'We could not start an anonymous session.'), 'auth_error')
      }
      user = signedIn.data.user
    }
    return { id: user.id, displayName: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null }
  }

  private async invoke<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
    const client = this.requireClient()
    const response = await client.functions.invoke<T>(functionName, { body })
    if (response.error) {
      let payload: { code?: string; message?: string; stateVersion?: number } | null = null
      const context = response.error.context
      if (context instanceof Response) {
        try {
          payload = await context.clone().json() as { code?: string; message?: string; stateVersion?: number }
        } catch {
          payload = null
        }
      }
      throw new GatewayError(payload?.message ?? describeFunctionError(response.error, `The ${functionName} command failed.`), payload?.code ?? 'server_error', payload?.stateVersion)
    }
    return response.data as T
  }

  async createRoom(displayName: string): Promise<PrivatePlayerView> {
    return unwrapView(await this.invoke<unknown>('create-room', { displayName, clientActionId: createClientActionId() }))
  }

  async joinRoom(roomCode: string, displayName: string): Promise<PrivatePlayerView> {
    return unwrapView(await this.invoke<unknown>('join-room', { roomCode, displayName, clientActionId: createClientActionId() }))
  }

  async getGameView(roomId: string): Promise<PrivatePlayerView> {
    return unwrapView(await this.invoke<unknown>('get-game-view', { roomId, clientActionId: createClientActionId() }))
  }

  async sendCommand(input: CommandInput): Promise<PrivatePlayerView> {
    return unwrapView(await this.invoke<unknown>('game-command', input as unknown as Record<string, unknown>))
  }

  async sendReaction(roomId: string, reaction: EmojiReaction): Promise<void> {
    const channel = this.reactionChannels.get(roomId)
    if (!channel) throw new GatewayError('The reaction channel is not connected yet.', 'not_connected')
    const result = await channel.send({ type: 'broadcast', event: 'emoji_reaction', payload: reaction })
    if (result !== 'ok') throw new GatewayError('We could not send that reaction.', 'reaction_failed')
  }

  async subscribe(roomId: string, playerId: string, callbacks: GatewayCallbacks): Promise<() => Promise<void>> {
    const client = this.requireClient()
    callbacks.onConnection('connecting')
    const publicChannel = client.channel(`room:${roomId}`, { config: { private: true, presence: { key: playerId } } })
    const privateChannel = client.channel(`player:${playerId}`, { config: { private: true } })
    const reactionChannel = client.channel(`reactions:${roomId}`)
    this.reactionChannels.set(roomId, reactionChannel)
    let latestView: PrivatePlayerView | null = null
    const presenceOverrides = new Map<string, boolean>()
    const presenceTimers: number[] = []
    let presenceSyncPending = false
    const emitView = (view: PrivatePlayerView) => {
      latestView = {
        ...view,
        players: view.players.map((player) => presenceOverrides.has(player.id) ? { ...player, isOnline: presenceOverrides.get(player.id) as boolean } : player),
      }
      callbacks.onView(latestView)
      if (presenceSyncPending) {
        presenceSyncPending = false
        syncPresence()
      }
    }
    const emitPresence = (presencePlayerId: string, isOnline: boolean) => {
      presenceOverrides.set(presencePlayerId, isOnline)
      if (latestView) emitView(latestView)
    }
    const syncPresence = () => {
      if (!latestView) {
        presenceSyncPending = true
        return
      }
      const presenceState = publicChannel.presenceState()
      const onlinePlayerIds = new Set(Object.keys(presenceState))
      for (const player of latestView.players) {
        // Keep the server's initial status when the first presence snapshot is
        // still settling. Explicit leave/join events below are authoritative
        // for the live transition and prevent a false Offline state on refresh.
        if (onlinePlayerIds.has(player.id)) presenceOverrides.set(player.id, true)
      }
      emitView(latestView)
    }
    const schedulePresenceSync = () => {
      for (const delay of [150, 750, 1600]) {
        presenceTimers.push(window.setTimeout(syncPresence, delay))
      }
    }
    const refreshView = async () => {
      try {
        emitView(await this.getGameView(roomId))
      } catch {
        callbacks.onConnection('reconnecting')
      }
    }

    publicChannel
      .on('broadcast', { event: 'state_update' }, () => {
        callbacks.onEvent({ type: 'state-updated', roomId })
        void refreshView()
      })
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
        callbacks.onEvent({ type: 'player-connected', roomId, playerId: key })
        emitPresence(key, true)
        schedulePresenceSync()
        void refreshView()
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        callbacks.onEvent({ type: 'player-disconnected', roomId, playerId: key })
        emitPresence(key, false)
        void refreshView()
      })

    privateChannel.on('broadcast', { event: 'private_state' }, ({ payload }: { payload: unknown }) => {
      emitView(unwrapView(payload))
      callbacks.onEvent({ type: 'state-updated', roomId })
    })

    reactionChannel.on('broadcast', { event: 'emoji_reaction' }, ({ payload }: { payload: unknown }) => {
      const reaction = payload as EmojiReaction
      if (reaction.playerId !== playerId && reaction.id && reaction.emojiKey) callbacks.onReaction?.(reaction)
    })

    const subscribe = (channel: RealtimeChannel) => new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status))
      })
    })

    try {
      const reactionSubscription = subscribe(reactionChannel).catch(() => undefined)
      await Promise.all([subscribe(publicChannel), subscribe(privateChannel), reactionSubscription])
      await publicChannel.track({ playerId })
      syncPresence()
      schedulePresenceSync()
      callbacks.onConnection('connected')
      await refreshView()
    } catch {
      callbacks.onConnection('reconnecting')
    }

    return async () => {
      presenceTimers.forEach((timer) => window.clearTimeout(timer))
      if (this.reactionChannels.get(roomId) === reactionChannel) this.reactionChannels.delete(roomId)
      await Promise.all([client.removeChannel(publicChannel), client.removeChannel(privateChannel), client.removeChannel(reactionChannel)])
    }
  }
}
