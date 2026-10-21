import { type PropertyStatus } from '@/types'

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  stable: 'Stable',
  attention: 'Needs attention',
  'lease-up': 'Lease-up',
}
