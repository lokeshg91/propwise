import { AVATAR_MAX_CHARS, AVATAR_MAX_PIXELS } from '@/data/services'

/**
 * Profile photos (Phase 10.3). The chosen image is cropped to a square,
 * scaled down to at most 256 × 256 px and re-encoded as JPEG in the browser,
 * so only a small copy is saved with the profile. The original file isn't
 * kept, uploaded or sent anywhere.
 */

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const AVATAR_ACCEPT = AVATAR_TYPES.join(',')
export const AVATAR_MAX_FILE_BYTES = 10 * 1024 * 1024

export class AvatarError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AvatarError'
  }
}

/** Why a chosen file can't be used, before reading it; null when it can. */
export function avatarFileProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return 'Choose a JPEG, PNG, WebP or GIF image.'
  if (file.size === 0) return 'This file is empty. Choose another image.'
  if (file.size > AVATAR_MAX_FILE_BYTES) return 'Choose an image of 10 MB or less.'
  return null
}

/** Square crop of the image's centre: source rectangle and output size (never larger than the source). */
export function avatarCrop(width: number, height: number): { sx: number; sy: number; side: number; size: number } {
  const side = Math.min(width, height)
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side, size: Math.max(1, Math.min(AVATAR_MAX_PIXELS, side)) }
}

const QUALITIES = [0.86, 0.72, 0.58, 0.45]

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Reads, crops, resizes and re-encodes a photo. Rejects with an AvatarError the user can read. */
export async function prepareAvatar(file: File): Promise<string> {
  const problem = avatarFileProblem(file)
  if (problem) throw new AvatarError(problem)
  let image: Awaited<ReturnType<typeof decode>>
  try {
    image = await decode(file)
  } catch {
    throw new AvatarError('This image couldn’t be read. Choose another JPEG, PNG, WebP or GIF image.')
  }
  try {
    if (image.width < 1 || image.height < 1) throw new AvatarError('This image couldn’t be read. Choose another image.')
    const { sx, sy, side, size } = avatarCrop(image.width, image.height)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new AvatarError('This browser can’t resize images. Try another browser.')
    // JPEG has no transparency: transparent areas become white.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size, size)
    context.imageSmoothingQuality = 'high'
    context.drawImage(image.source, sx, sy, side, side, 0, 0, size, size)
    for (const quality of QUALITIES) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.startsWith('data:image/jpeg;base64,') && dataUrl.length <= AVATAR_MAX_CHARS) return dataUrl
    }
    throw new AvatarError('This image is too detailed to save as a profile photo. Choose a simpler image.')
  } finally {
    image.close()
  }
}
