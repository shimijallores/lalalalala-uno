const DISPLAY_NAME_KEY = 'uno-duel.display-name'
const ROOM_CODE_KEY = 'uno-duel.last-room-code'
const ROOM_ID_KEY = 'uno-duel.last-room-id'
const MUTE_KEY = 'uno-duel.muted'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage is only a reconnect hint. The server remains authoritative.
  }
}

export const localPreferences = {
  getDisplayName: () => read(DISPLAY_NAME_KEY) ?? '',
  setDisplayName: (value: string) => write(DISPLAY_NAME_KEY, value),
  getLastRoomCode: () => read(ROOM_CODE_KEY) ?? '',
  setLastRoomCode: (value: string) => write(ROOM_CODE_KEY, value),
  getLastRoomId: () => read(ROOM_ID_KEY),
  setLastRoomId: (value: string) => write(ROOM_ID_KEY, value),
  getMuted: () => read(MUTE_KEY) === 'true',
  setMuted: (value: boolean) => write(MUTE_KEY, String(value)),
}

export function getRoomCodeFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? ''
  } catch {
    return ''
  }
}
