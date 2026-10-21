/**
 * Resolves after a short delay to mimic a network request. Replace service
 * implementations with real API calls; their signatures stay the same.
 */
export function simulateLatency<T>(value: T, ms = 120): Promise<T> {
  const delay = import.meta.env.MODE === 'test' ? 0 : ms
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(structuredClone(value)), delay)
  })
}
