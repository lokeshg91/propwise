import { properties as seedProperties } from '@/data/mock/properties'
import { generateSeedUnits } from '@/data/mock/units'
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { type Property, type PropertyEvent, type Unit } from '@/types'

/**
 * Tiny in-browser database for the demo. Records created or edited in the
 * app are saved to localStorage so they survive a refresh. Only the data
 * services read or write it; swap the services for API calls to remove it.
 */
export interface DemoDatabase {
  version: typeof SCHEMA_VERSION
  properties: Property[]
  units: Unit[]
  events: PropertyEvent[]
}

const SCHEMA_VERSION = 1

let cache: DemoDatabase | null = null

function createSeed(): DemoDatabase {
  const properties = structuredClone(seedProperties)
  return { version: SCHEMA_VERSION, properties, units: generateSeedUnits(properties), events: [] }
}

function isDatabase(value: unknown): value is DemoDatabase {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<DemoDatabase>
  return (
    candidate.version === SCHEMA_VERSION &&
    Array.isArray(candidate.properties) &&
    Array.isArray(candidate.units) &&
    Array.isArray(candidate.events)
  )
}

function load(): DemoDatabase {
  const raw = readStorage(STORAGE_KEYS.demoData)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isDatabase(parsed)) return parsed
    } catch {
      // Corrupt data falls back to the seed below.
    }
  }
  return createSeed()
}

export function readDatabase(): DemoDatabase {
  cache ??= load()
  return cache
}

/** Applies `mutate` to the database and persists the result. */
export function updateDatabase<T>(mutate: (db: DemoDatabase) => T): T {
  const db = readDatabase()
  const result = mutate(db)
  writeStorage(STORAGE_KEYS.demoData, JSON.stringify(db))
  return result
}

/** Discards local changes and restores the original sample data. */
export function resetDemoData(): void {
  cache = null
  removeStorage(STORAGE_KEYS.demoData)
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
