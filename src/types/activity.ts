export const ACTIVITY_TYPES = [
  'tenant-added',
  'payment-received',
  'maintenance-created',
  'work-order-completed',
  'property-added',
  'lease-signed',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  propertyId: string
  /** ISO timestamp. */
  createdAt: string
}
