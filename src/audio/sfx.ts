import { localPreferences } from '../storage/localPreferences'

export type SfxName = 'card-mix' | 'card-choose' | 'win' | 'lose' | 'bg'

const sources: Record<SfxName, string> = {
  'card-mix': '/assets/uno/sfx/card-mix.mp3',
  'card-choose': '/assets/uno/sfx/card-choose.mp3',
  win: '/assets/uno/sfx/win.mp3',
  lose: '/assets/uno/sfx/lose.mp3',
  bg: '/assets/uno/sfx/bg.mp3',
}

const players = new Map<SfxName, HTMLAudioElement>()
let muted = localPreferences.getMuted()
let unlocked = false

function getPlayer(name: SfxName): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  const existing = players.get(name)
  if (existing) return existing
  const audio = new Audio(sources[name])
  audio.preload = 'auto'
  players.set(name, audio)
  return audio
}

export function isSfxMuted(): boolean {
  return muted
}

export function setSfxMuted(value: boolean): void {
  muted = value
  localPreferences.setMuted(value)
  if (value) {
    const background = players.get('bg')
    background?.pause()
  }
}

function playBackground(): void {
  if (muted || !unlocked) return
  const background = getPlayer('bg')
  if (!background) return
  background.loop = true
  background.volume = 0.12
  void background.play().catch(() => undefined)
}

/** Call from a user gesture before a later server response tries to play audio. */
export function unlockSfx(): void {
  if (muted || unlocked) return
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    unlocked = true
    return
  }
  const audio = getPlayer('card-choose')
  if (!audio) return
  audio.volume = 0
  try {
    const playback = audio.play()
    void playback?.then(() => {
      unlocked = true
      audio.pause()
      audio.currentTime = 0
      audio.volume = 1
      playBackground()
    }).catch(() => {
      unlocked = false
    })
  } catch {
    // Browsers may still reject media until a stronger gesture is received.
    unlocked = false
  }
}

export function playSfx(name: SfxName, volume = 1): void {
  if (muted || !unlocked) return
  const audio = getPlayer(name)
  if (!audio) return
  audio.currentTime = 0
  audio.volume = volume
  void audio.play().catch(() => undefined)
}
