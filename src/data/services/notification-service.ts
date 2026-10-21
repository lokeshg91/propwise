import { notifications } from '@/data/mock/notifications'
import { simulateLatency } from '@/data/services/simulate-latency'
import { type AppNotification } from '@/types'

export function getNotifications(): Promise<AppNotification[]> {
  const sorted = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return simulateLatency(sorted)
}
