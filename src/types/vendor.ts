import { type RequestCategory } from './service-request'

/**
 * A service provider work orders can be assigned to. Minimal for now; the
 * Vendors module adds management screens later.
 */
export interface Vendor {
  /** Stable id derived from the name, e.g. "ven_blueline-plumbing". */
  id: string
  name: string
  categories: RequestCategory[]
  contactName: string
  phone: string
  email: string
  /** Inactive vendors keep their history but can't take new work orders. */
  active: boolean
}
