import { useCallback, useState } from 'react'

import { readStorage, writeStorage } from '@/lib/storage'

/**
 * `useState` backed by localStorage. Values are JSON-serialised; anything
 * unreadable falls back to `initialValue`.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  isValid: (value: unknown) => value is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = readStorage(key)
    if (raw === null) return initialValue
    try {
      const parsed: unknown = JSON.parse(raw)
      return isValid(parsed) ? parsed : initialValue
    } catch {
      return initialValue
    }
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      writeStorage(key, JSON.stringify(next))
    },
    [key],
  )

  return [value, update]
}

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
