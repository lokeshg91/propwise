import {
  findVendorConflicts,
  getVendorPerformance,
  isVendorReferenced,
  normalizeEmail,
  type VendorConflicts,
  type VendorMatch,
  type VendorPerformance,
} from '@/data/domain/vendor-rules'
import { isActiveWorkOrder } from '@/data/domain/maintenance-rules'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { createId, type DemoDatabase, readDatabase, updateDatabase } from '@/data/store/demo-store'
import {
  type Property,
  REQUEST_CATEGORIES,
  type ServiceRequest,
  type Unit,
  type Vendor,
  type VendorEvent,
  type VendorEventKind,
  type VendorInput,
  type WorkOrder,
} from '@/types'

export const VENDOR_LIMITS = { name: 80, company: 120, contactName: 80, notes: 1_000 } as const

/* ----------------------------------------------------------------- errors */

/**
 * A possible duplicate. `requiresConfirmation` is true for a phone match only:
 * save again with `acknowledgePhoneMatch` to continue. Name and email matches
 * always block. Vendors are never merged automatically.
 */
export class VendorDuplicateError extends ServiceError {
  readonly matches: VendorMatch[]
  readonly requiresConfirmation: boolean

  constructor(message: string, field: 'name' | 'email' | 'phone', matches: VendorMatch[], requiresConfirmation: boolean) {
    super('conflict', message, field)
    this.name = 'VendorDuplicateError'
    this.matches = matches
    this.requiresConfirmation = requiresConfirmation
  }
}

export const isVendorDuplicateError = (error: unknown): error is VendorDuplicateError => error instanceof VendorDuplicateError

/** Deactivating a vendor with open work orders needs `confirmOpenJobs`; the error lists them. */
export class VendorOpenJobsError extends ServiceError {
  readonly openWorkOrders: VendorWorkOrder[]

  constructor(message: string, openWorkOrders: VendorWorkOrder[]) {
    super('conflict', message, 'active')
    this.name = 'VendorOpenJobsError'
    this.openWorkOrders = openWorkOrders
  }
}

export const isVendorOpenJobsError = (error: unknown): error is VendorOpenJobsError => error instanceof VendorOpenJobsError

/* ------------------------------------------------------------------ types */

export interface VendorListItem {
  vendor: Vendor
  performance: VendorPerformance
}

/** A work order with the request, location and (for reassignments) the vendor that took over. */
export interface VendorWorkOrder {
  order: WorkOrder
  request: Pick<ServiceRequest, 'id' | 'title' | 'status' | 'priority' | 'category'> | null
  property: Pick<Property, 'id' | 'name' | 'type'> | null
  unit: Pick<Unit, 'id' | 'number'> | null
  area: string | null
  /** Set when this order was cancelled because the request moved to another vendor. */
  replacedBy: { workOrderId: string; vendorId: string; vendorName: string } | null
}

export interface VendorDetail {
  vendor: Vendor
  performance: VendorPerformance
  /** Newest first. */
  workOrders: VendorWorkOrder[]
  /** Newest first. */
  events: VendorEvent[]
  /** False once any work order has referenced the vendor (any status). */
  canDelete: boolean
}

/* ------------------------------------------------------------------ reads */

function vendorWorkOrders(db: DemoDatabase, vendorId: string): VendorWorkOrder[] {
  return db.workOrders
    .filter((order) => order.vendorId === vendorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map((order) => {
      const request = db.serviceRequests.find((entry) => entry.id === order.requestId)
      const property = request ? db.properties.find((entry) => entry.id === request.propertyId) : undefined
      const unit = request?.unitId ? db.units.find((entry) => entry.id === request.unitId) : undefined
      const next =
        order.status === 'cancelled'
          ? db.workOrders
              .filter((other) => other.requestId === order.requestId && other.id !== order.id && other.vendorId !== vendorId && other.createdAt >= order.createdAt)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
          : undefined
      return {
        order,
        request: request ? { id: request.id, title: request.title, status: request.status, priority: request.priority, category: request.category } : null,
        property: property ? { id: property.id, name: property.name, type: property.type } : null,
        unit: unit ? { id: unit.id, number: unit.number } : null,
        area: request?.area ?? null,
        replacedBy: next
          ? { workOrderId: next.id, vendorId: next.vendorId, vendorName: db.vendors.find((vendor) => vendor.id === next.vendorId)?.name ?? 'Unknown vendor' }
          : null,
      }
    })
}

const performanceOf = (db: DemoDatabase, vendorId: string) => getVendorPerformance(vendorId, db.workOrders, db.serviceRequests)

export function getVendorList(): Promise<VendorListItem[]> {
  const db = readDatabase()
  return simulateLatency(
    [...db.vendors]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((vendor) => ({ vendor, performance: performanceOf(db, vendor.id) })),
  )
}

export function getVendorDetail(id: string): Promise<VendorDetail | null> {
  const db = readDatabase()
  const vendor = db.vendors.find((entry) => entry.id === id)
  if (!vendor) return simulateLatency(null)
  return simulateLatency({
    vendor,
    performance: performanceOf(db, id),
    workOrders: vendorWorkOrders(db, id),
    events: db.vendorEvents.filter((event) => event.vendorId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    canDelete: !isVendorReferenced(id, db.workOrders),
  })
}

/** The same duplicate checks as saving, so a form can warn before submit. */
export function checkVendorDuplicates(input: Pick<VendorInput, 'name' | 'email' | 'phone'>, exceptId?: string): Promise<VendorConflicts> {
  return simulateLatency(findVendorConflicts(readDatabase().vendors, input, exceptId))
}

/* ----------------------------------------------------------------- writes */

export interface VendorSaveOptions {
  /** The user confirmed saving although another vendor has the same phone number. */
  acknowledgePhoneMatch?: boolean
  /** The user confirmed deactivating although the vendor has open work orders. */
  confirmOpenJobs?: boolean
}

export function createVendor(input: VendorInput, options: VendorSaveOptions = {}): Promise<Vendor> {
  return run(() =>
    updateDatabase((db) => {
      const fields = validateVendorInput(input)
      assertNoDuplicates(db, fields, undefined, options)
      const now = new Date().toISOString()
      let id = createId('ven')
      while (db.vendors.some((vendor) => vendor.id === id)) id = createId('ven')
      const vendor: Vendor = { id, ...fields, deactivatedAt: fields.active ? null : now, createdAt: now, updatedAt: now }
      db.vendors.push(vendor)
      record(db, vendor, 'created', 'Vendor added', `${vendor.name} was added to Propwise${vendor.active ? '' : ' as inactive'}.`)
      if (!vendor.active) record(db, vendor, 'deactivated', 'Vendor deactivated', 'Added as inactive: can’t take new work orders.')
      return vendor
    }),
  )
}

/**
 * Edits a vendor. Work orders keep their `vendorId`, and earlier activity
 * keeps the name it was written with; only the vendor record changes.
 * A status change follows the same rules as `setVendorActive`.
 */
export function updateVendor(id: string, input: VendorInput, options: VendorSaveOptions = {}): Promise<Vendor> {
  return run(() =>
    updateDatabase((db) => {
      const vendor = findVendor(db, id)
      const fields = validateVendorInput(input)
      assertNoDuplicates(db, fields, id, options)

      const changed = describeChanges(vendor, fields)
      const statusChange = fields.active !== vendor.active
      if (changed.length === 0 && !statusChange) return vendor

      const previousName = vendor.name
      const now = new Date().toISOString()
      Object.assign(vendor, { ...fields, active: vendor.active, updatedAt: now })
      if (changed.length > 0) {
        record(
          db,
          vendor,
          'updated',
          previousName !== vendor.name ? `Renamed to ${vendor.name}` : 'Vendor details updated',
          previousName !== vendor.name ? `Renamed from ${previousName}. Changed: ${changed.join(', ')}.` : `Changed: ${changed.join(', ')}.`,
        )
      }
      if (statusChange) applyStatus(db, vendor, fields.active, options, '')
      return vendor
    }),
  )
}

/** Deactivates or reactivates a vendor. Work orders are never changed. */
export function setVendorActive(id: string, active: boolean, options: VendorSaveOptions & { note?: string } = {}): Promise<Vendor> {
  return run(() =>
    updateDatabase((db) => {
      const vendor = findVendor(db, id)
      if (vendor.active === active) {
        throw new ServiceError('conflict', active ? `${vendor.name} is already active.` : `${vendor.name} is already inactive.`, 'active')
      }
      applyStatus(db, vendor, active, options, options.note ?? '')
      return vendor
    }),
  )
}

/** Deletes a vendor that no work order has ever referenced (any status). Otherwise deactivate instead. */
export function deleteVendor(id: string): Promise<{ id: string; name: string }> {
  return run(() =>
    updateDatabase((db) => {
      const vendor = findVendor(db, id)
      const references = db.workOrders.filter((order) => order.vendorId === id).length
      if (references > 0) {
        throw new ServiceError(
          'conflict',
          `${vendor.name} appears on ${references} ${references === 1 ? 'work order' : 'work orders'} and can’t be deleted. Deactivate the vendor instead.`,
        )
      }
      db.vendors = db.vendors.filter((entry) => entry.id !== id)
      db.vendorEvents = db.vendorEvents.filter((event) => event.vendorId !== id)
      return { id, name: vendor.name }
    }),
  )
}

/* ---------------------------------------------------------------- helpers */

function run<T>(mutation: () => T): Promise<T> {
  try {
    return simulateLatency(mutation(), 250)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

function findVendor(db: DemoDatabase, id: string): Vendor {
  const vendor = db.vendors.find((entry) => entry.id === id)
  if (!vendor) throw new ServiceError('not-found', 'Vendor not found.')
  return vendor
}

function applyStatus(db: DemoDatabase, vendor: Vendor, active: boolean, options: VendorSaveOptions, note: string) {
  const now = new Date().toISOString()
  if (!active) {
    const open = vendorWorkOrders(db, vendor.id).filter((entry) => isActiveWorkOrder(entry.order))
    if (open.length > 0 && !options.confirmOpenJobs) {
      throw new VendorOpenJobsError(
        `${vendor.name} has ${open.length} open ${open.length === 1 ? 'work order' : 'work orders'}. Confirm to deactivate; those jobs stay with the vendor.`,
        open,
      )
    }
    Object.assign(vendor, { active: false, deactivatedAt: now, updatedAt: now } satisfies Partial<Vendor>)
    record(
      db,
      vendor,
      'deactivated',
      'Vendor deactivated',
      [note.trim(), open.length > 0 ? `${open.length} open ${open.length === 1 ? 'job stays' : 'jobs stay'} with the vendor.` : 'Can’t take new work orders.']
        .filter(Boolean)
        .join(' '),
    )
  } else {
    // The earlier deactivation stays in the vendor's history.
    Object.assign(vendor, { active: true, deactivatedAt: null, updatedAt: now } satisfies Partial<Vendor>)
    record(db, vendor, 'reactivated', 'Vendor reactivated', note.trim() || 'Can take new work orders again.')
  }
}

const PHONE_PATTERN = /^[\d\s()+.-]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Server-side checks; the form validates the same rules for instant feedback. */
function validateVendorInput(input: VendorInput): VendorInput {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) throw new ServiceError('invalid', 'Enter the vendor name.', 'name')
  if (name.length > VENDOR_LIMITS.name) throw new ServiceError('invalid', `Keep the name under ${VENDOR_LIMITS.name} characters.`, 'name')
  const company = input.company.trim().replace(/\s+/g, ' ')
  if (company.length > VENDOR_LIMITS.company) throw new ServiceError('invalid', `Keep the company name under ${VENDOR_LIMITS.company} characters.`, 'company')
  const contactName = input.contactName.trim().replace(/\s+/g, ' ')
  if (contactName.length < 2) throw new ServiceError('invalid', 'Enter the contact person.', 'contactName')
  if (contactName.length > VENDOR_LIMITS.contactName) throw new ServiceError('invalid', `Keep the contact name under ${VENDOR_LIMITS.contactName} characters.`, 'contactName')
  const email = normalizeEmail(input.email)
  if (!EMAIL_PATTERN.test(email)) throw new ServiceError('invalid', 'Enter a valid email address.', 'email')
  const phone = input.phone.trim()
  if (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, '').length < 10) {
    throw new ServiceError('invalid', 'Enter a valid phone number, e.g. (512) 555-0134.', 'phone')
  }
  const categories = REQUEST_CATEGORIES.filter((category) => input.categories.includes(category))
  if (categories.length === 0 || categories.length !== new Set(input.categories).size) {
    throw new ServiceError('invalid', 'Choose at least one service category.', 'categories')
  }
  const notes = input.notes.trim()
  if (notes.length > VENDOR_LIMITS.notes) throw new ServiceError('invalid', `Keep notes under ${VENDOR_LIMITS.notes.toLocaleString('en-US')} characters.`, 'notes')
  return { name, company: company === name ? '' : company, categories, contactName, phone, email, notes, active: input.active }
}

function assertNoDuplicates(db: DemoDatabase, input: VendorInput, exceptId: string | undefined, options: VendorSaveOptions) {
  const conflicts = findVendorConflicts(db.vendors, input, exceptId)
  const byName = conflicts.blocking.filter((match) => match.field === 'name')
  if (byName.length > 0) {
    throw new VendorDuplicateError(`A vendor named ${byName[0]?.vendor.name} already exists.`, 'name', byName, false)
  }
  const byEmail = conflicts.blocking.filter((match) => match.field === 'email')
  if (byEmail.length > 0) {
    throw new VendorDuplicateError(`${byEmail[0]?.vendor.name} already uses this email address.`, 'email', byEmail, false)
  }
  if (conflicts.warnings.length > 0 && !options.acknowledgePhoneMatch) {
    const names = conflicts.warnings.map((match) => match.vendor.name).join(', ')
    throw new VendorDuplicateError(`${names} already ${conflicts.warnings.length === 1 ? 'uses' : 'use'} this phone number. Save anyway?`, 'phone', conflicts.warnings, true)
  }
}

const FIELD_LABELS: Record<keyof Omit<VendorInput, 'active'>, string> = {
  name: 'name',
  company: 'company',
  categories: 'services',
  contactName: 'contact person',
  phone: 'phone',
  email: 'email',
  notes: 'notes',
}

function describeChanges(vendor: Vendor, input: VendorInput): string[] {
  return (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>)
    .filter((key) => JSON.stringify(vendor[key]) !== JSON.stringify(input[key]))
    .map((key) => FIELD_LABELS[key])
}

let eventCounter = 0
/** Appends to the vendor's history with the vendor's name at that moment. */
function record(db: DemoDatabase, vendor: Vendor, kind: VendorEventKind, title: string, description: string) {
  eventCounter += 1
  db.vendorEvents.push({
    id: `vev_${vendor.id}_${Date.now().toString(36)}${eventCounter}`,
    vendorId: vendor.id,
    kind,
    vendorName: vendor.name,
    title,
    description,
    createdAt: new Date().toISOString(),
  })
}

