import { properties } from '@/data/mock/properties'
import { simulateLatency } from '@/data/services/simulate-latency'
import { type Property } from '@/types'

export function getProperties(): Promise<Property[]> {
  return simulateLatency(properties)
}
