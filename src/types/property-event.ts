export const PROPERTY_EVENT_KINDS = ['property-created', 'property-updated', 'unit-added', 'unit-updated'] as const
export type PropertyEventKind = (typeof PROPERTY_EVENT_KINDS)[number]

/** Change recorded when a property or its units are edited in the app. */
export interface PropertyEvent {
  id: string
  propertyId: string
  kind: PropertyEventKind
  title: string
  description: string
  /** ISO timestamp. */
  createdAt: string
}
