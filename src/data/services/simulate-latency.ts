/**
 * Resolves after a short delay to mimic a network request. Replace service
 * implementations with real API calls; their signatures stay the same.
 */
export function simulateLatency<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(structuredClone(value)), ms)
  })
}
