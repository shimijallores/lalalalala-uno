export interface EmojiAsset {
  key: string
  label: string
  src: string
}

const emojiFiles = import.meta.glob('../../uno-game-assets/emojis/*', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function getLabel(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export const EMOJI_ASSETS: EmojiAsset[] = Object.entries(emojiFiles)
  .filter(([path]) => /\.(gif|jpe?g|png|webp)$/i.test(path))
  .map(([path, src]) => {
    const fileName = getFileName(path)
    return { key: fileName.replace(/\.[^.]+$/, ''), label: getLabel(fileName), src }
  })
  .sort((left, right) => left.label.localeCompare(right.label))

export function findEmojiAsset(key: string): EmojiAsset | undefined {
  return EMOJI_ASSETS.find((emoji) => emoji.key === key)
}
