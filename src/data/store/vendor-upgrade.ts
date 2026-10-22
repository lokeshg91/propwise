import { buildPhase7Vendors, VENDOR_PROFILES } from '@/data/mock/vendor-seed'
import { findVendorConflicts } from '@/data/domain/vendor-rules'
import { type Vendor, type VendorEvent, type VendorV3, type WorkOrder } from '@/types'

const DAY = 86_400_000

/**
 * v3 → v4 vendor step. Existing vendors keep every stored field (ids, names,
 * status, contacts, categories); only fields that don't exist yet are filled:
 *
 * - company and notes from the seed profile, or ''
 * - createdAt: 30 days before the vendor's first work order, or `now`
 * - updatedAt: createdAt
 * - deactivatedAt: `now` for inactive vendors, null otherwise
 *
 * It also adds a "created" (and, for inactive vendors, "deactivated") event
 * and the three Phase 7 demo vendors. Event and vendor ids are fixed, so
 * running it again adds nothing.
 */
export function upgradeVendors(
  vendors: Array<VendorV3 & Partial<Vendor>>,
  existingEvents: VendorEvent[],
  workOrders: Array<Pick<WorkOrder, 'vendorId' | 'createdAt'>>,
  now: Date,
): { vendors: Vendor[]; events: VendorEvent[] } {
  const nowIso = now.toISOString()
  const eventIds = new Set(existingEvents.map((event) => event.id))
  const events: VendorEvent[] = [...existingEvents]
  const addEvent = (event: VendorEvent) => {
    if (eventIds.has(event.id)) return
    eventIds.add(event.id)
    events.push(event)
  }

  const upgraded: Vendor[] = vendors.map((vendor) => {
    const profile = VENDOR_PROFILES[vendor.id]
    const firstJob = workOrders
      .filter((order) => order.vendorId === vendor.id)
      .map((order) => order.createdAt)
      .sort()[0]
    const createdAt = vendor.createdAt ?? (firstJob ? new Date(Date.parse(firstJob) - 30 * DAY).toISOString() : nowIso)
    return {
      // Stored v3 fields first; they are never overwritten.
      ...vendor,
      company: vendor.company ?? profile?.company ?? '',
      notes: vendor.notes ?? profile?.notes ?? '',
      createdAt,
      updatedAt: vendor.updatedAt ?? createdAt,
      deactivatedAt: vendor.deactivatedAt !== undefined ? vendor.deactivatedAt : vendor.active ? null : nowIso,
    }
  })

  // Phase 7 demo vendors, unless the id, name or email is already taken.
  for (const vendor of buildPhase7Vendors(now)) {
    if (upgraded.some((entry) => entry.id === vendor.id)) continue
    if (findVendorConflicts(upgraded, vendor).blocking.length > 0) continue
    upgraded.push(vendor)
  }

  for (const vendor of upgraded) {
    addEvent({
      id: `vev_${vendor.id}_created`,
      vendorId: vendor.id,
      kind: 'created',
      vendorName: vendor.name,
      title: 'Vendor added',
      description: `${vendor.name} was added to Propwise.`,
      createdAt: vendor.createdAt,
    })
    if (!vendor.active && vendor.deactivatedAt) {
      addEvent({
        id: `vev_${vendor.id}_deactivated`,
        vendorId: vendor.id,
        kind: 'deactivated',
        vendorName: vendor.name,
        title: 'Vendor deactivated',
        description: vendor.notes || 'Can’t take new work orders.',
        createdAt: vendor.deactivatedAt,
      })
    }
  }

  return { vendors: upgraded, events }
}
