import { type RequestCategory } from './service-request'

/**
 * A service provider work orders can be assigned to. Work orders reference it
 * by `id`, which never changes (not even on rename).
 */
export interface Vendor {
  /** Stable id: derived from the name for seeded vendors ("ven_blueline-plumbing"), generated for new ones. */
  id: string
  /** Trading name shown across Propwise. */
  name: string
  /** Registered or legal company name; '' when the same as `name`. */
  company: string
  categories: RequestCategory[]
  contactName: string
  phone: string
  email: string
  /** Internal notes. */
  notes: string
  /** Inactive vendors keep their history but can't take new work orders. */
  active: boolean
  /** When the vendor last became inactive; null while active. Earlier periods live in the vendor's events. */
  deactivatedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Vendor shape stored by schema v3 (Phase 6), before the Vendors module. */
export type VendorV3 = Pick<Vendor, 'id' | 'name' | 'categories' | 'contactName' | 'phone' | 'email' | 'active'>

/** Fields set when creating or editing a vendor. */
export interface VendorInput {
  name: string
  company: string
  categories: RequestCategory[]
  contactName: string
  phone: string
  email: string
  notes: string
  active: boolean
}

export const VENDOR_EVENT_KINDS = ['created', 'updated', 'deactivated', 'reactivated'] as const
export type VendorEventKind = (typeof VENDOR_EVENT_KINDS)[number]

/** Append-only vendor history. `vendorName` keeps the name the vendor had when the event happened. */
export interface VendorEvent {
  id: string
  vendorId: string
  kind: VendorEventKind
  vendorName: string
  title: string
  description: string
  createdAt: string
}
