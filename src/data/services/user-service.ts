import { currentUser } from '@/data/mock/users'
import { simulateLatency } from '@/data/services/simulate-latency'
import { type User } from '@/types'

export function getCurrentUser(): Promise<User> {
  return simulateLatency(currentUser)
}
