import { todayIso, toIsoDate } from '@/data/domain/dates'
import { isCurrentLease } from '@/data/domain/lease-rules'
import { expenseStatus, type ExpenseStatus } from '@/data/domain/finance-rules'
import {
  availableActions,
  checkTransition,
  dueAtFor,
  isActiveRequest,
  isActiveWorkOrder,
  type RequestAction,
  SLA_HOURS,
} from '@/data/domain/maintenance-rules'
import {
  canReturnUnitToVacant,
  canTakeUnitOffline,
  type UnitCheck,
  findProperty,
  findUnit,
  recordPropertyEvent,
  returnUnitToVacant,
  takeUnitOffline,
} from '@/data/services/occupancy'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { type DemoDatabase, readDatabase, updateDatabase } from '@/data/store/demo-store'
import {
  type HoldReason,
  type MaintenanceEventKind,
  type Property,
  type ServiceRequest,
  type ServiceRequestInput,
  type Tenant,
  type Unit,
  type Vendor,
  type WorkOrder,
  type WorkOrderInput,
} from '@/types'

const MAX_COST = 1_000_000

/* ------------------------------------------------------------------ types */

export interface RequestListItem {
  request: ServiceRequest
  property: Pick<Property, 'id' | 'name' | 'type'> | null
  unit: Pick<Unit, 'id' | 'number' | 'status'> | null
  tenant: Pick<Tenant, 'id' | 'name'> | null
  /** Vendor of the active work order, or of the most recent one. `missing` when the id no longer resolves. */
  vendor: (Pick<Vendor, 'id' | 'name' | 'active'> & { missing: boolean }) | null
  activeWorkOrder: WorkOrder | null
}

export interface WorkOrderWithVendor extends WorkOrder {
  /** Shown even if the vendor has since become inactive. `missing` when the id no longer resolves. */
  vendor: Pick<Vendor, 'id' | 'name' | 'active' | 'phone' | 'email' | 'contactName'> & { missing: boolean }
  /** The Finance bill created when the work order was completed with a final cost. */
  bill: { id: string; reference: string; status: ExpenseStatus; amountCents: number; money: { currency: string; locale: string } } | null
}

export interface RequestDetail extends RequestListItem {
  /** Newest first. */
  workOrders: WorkOrderWithVendor[]
  events: ReturnType<typeof eventsFor>
  actions: RequestAction[]
  /** Whether the unit could go back to vacant when this request closes. */
  unitReturn: UnitCheck & { applicable: boolean }
}

export interface RequestFormOptions {
  properties: Array<{
    id: string
    name: string
    type: Property['type']
    units: Array<{
      id: string
      number: string
      status: Unit['status']
      /** Why the unit can't be taken offline, if it can't. */
      offlineBlockedReason: string | null
      /** Tenants who have leased the unit, current first. */
      tenants: Array<{ id: string; name: string; current: boolean }>
    }>
  }>
  vendors: Vendor[]
}

/* ------------------------------------------------------------------ reads */

function vendorName(db: DemoDatabase, id: string): WorkOrderWithVendor['vendor'] {
  const vendor = db.vendors.find((entry) => entry.id === id)
  return vendor
    ? { id: vendor.id, name: vendor.name, active: vendor.active, phone: vendor.phone, email: vendor.email, contactName: vendor.contactName, missing: false }
    : { id, name: 'Unknown vendor', active: false, phone: '', email: '', contactName: '', missing: true }
}

const ordersFor = (db: DemoDatabase, requestId: string) =>
  db.workOrders.filter((order) => order.requestId === requestId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))

function eventsFor(db: DemoDatabase, requestId: string) {
  return db.maintenanceEvents.filter((event) => event.requestId === requestId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function toListItem(db: DemoDatabase, request: ServiceRequest): RequestListItem {
  const property = db.properties.find((entry) => entry.id === request.propertyId)
  const unit = request.unitId ? db.units.find((entry) => entry.id === request.unitId) : undefined
  const tenant = request.tenantId ? db.tenants.find((entry) => entry.id === request.tenantId) : undefined
  const orders = ordersFor(db, request.id)
  const active = orders.find(isActiveWorkOrder) ?? null
  const shown = active ?? orders[0]
  return {
    request,
    property: property ? { id: property.id, name: property.name, type: property.type } : null,
    unit: unit ? { id: unit.id, number: unit.number, status: unit.status } : null,
    tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
    vendor: shown ? vendorName(db, shown.vendorId) : null,
    activeWorkOrder: active,
  }
}

export interface RequestFilter {
  propertyId?: string
  tenantId?: string
  unitId?: string
}

/** List items for requests matching the filter, newest first. Used by other services too. */
export function listRequestItems(db: DemoDatabase, filter: RequestFilter = {}): RequestListItem[] {
  return db.serviceRequests
    .filter(
      (request) =>
        (!filter.propertyId || request.propertyId === filter.propertyId) &&
        (!filter.tenantId || request.tenantId === filter.tenantId) &&
        (!filter.unitId || request.unitId === filter.unitId),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((request) => toListItem(db, request))
}

export function getServiceRequests(filter: RequestFilter = {}): Promise<RequestListItem[]> {
  return simulateLatency(listRequestItems(readDatabase(), filter))
}

function billFor(db: DemoDatabase, workOrderId: string): WorkOrderWithVendor['bill'] {
  const bill = db.expenses.find((expense) => expense.workOrderId === workOrderId)
  return bill ? { id: bill.id, reference: bill.reference, status: expenseStatus(bill, todayIso()), amountCents: bill.amountCents, money: { currency: db.finance.currency, locale: db.finance.locale } } : null
}

export function getServiceRequestDetail(id: string): Promise<RequestDetail | null> {
  const db = readDatabase()
  const request = db.serviceRequests.find((entry) => entry.id === id)
  if (!request) return simulateLatency(null)
  const item = toListItem(db, request)
  const applicable = request.unitId !== null && isActiveRequest(request)
  const unitReturn = applicable && request.unitId ? canReturnUnitToVacant(db, request.unitId, request.id) : { allowed: false }
  return simulateLatency({
    ...item,
    workOrders: ordersFor(db, id).map((order) => ({ ...order, vendor: vendorName(db, order.vendorId), bill: billFor(db, order.id) })),
    events: eventsFor(db, id),
    actions: availableActions(request, { hasActiveWorkOrder: item.activeWorkOrder !== null }),
    unitReturn: { ...unitReturn, applicable: applicable && request.unitId !== null && findUnit(db, request.unitId).status === 'maintenance' },
  })
}

export function getRequestFormOptions(): Promise<RequestFormOptions> {
  const db = readDatabase()
  const properties = [...db.properties]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((property) => ({
      id: property.id,
      name: property.name,
      type: property.type,
      units: db.units
        .filter((unit) => unit.propertyId === property.id)
        .sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true }))
        .map((unit) => {
          const offline = canTakeUnitOffline(db, unit.id)
          const leases = db.leases
            .filter((lease) => lease.unitId === unit.id)
            .sort((a, b) => Number(isCurrentLease(b)) - Number(isCurrentLease(a)) || b.startDate.localeCompare(a.startDate))
          const seen = new Set<string>()
          const tenants = leases.flatMap((lease) => {
            const tenant = db.tenants.find((entry) => entry.id === lease.tenantId)
            if (!tenant || seen.has(tenant.id)) return []
            seen.add(tenant.id)
            return [{ id: tenant.id, name: tenant.name, current: isCurrentLease(lease) }]
          })
          return { id: unit.id, number: unit.number, status: unit.status, offlineBlockedReason: offline.allowed ? null : (offline.reason ?? null), tenants }
        }),
    }))
  return simulateLatency({ properties, vendors: [...db.vendors].sort((a, b) => a.name.localeCompare(b.name)) })
}

export function getVendors(): Promise<Vendor[]> {
  return simulateLatency(readDatabase().vendors)
}

/* ----------------------------------------------------------------- writes */

export interface CreateRequestOptions {
  /** Put the (vacant) unit under maintenance while the work is done. */
  takeUnitOffline?: boolean
  /** Assign a vendor in the same step; the request starts as Scheduled. */
  assign?: WorkOrderInput | null
}

export function createServiceRequest(input: ServiceRequestInput, options: CreateRequestOptions = {}): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const fields = validateRequestInput(db, input)
      const now = new Date().toISOString()
      const id = `MR-${db.sequences.request}`
      if (db.serviceRequests.some((request) => request.id === id)) throw new ServiceError('conflict', 'Request number already in use.')
      db.sequences.request += 1

      const request: ServiceRequest = {
        id,
        ...fields,
        status: 'open',
        dueAt: dueAtFor(now, fields.priority),
        unitTakenOffline: false,
        hold: null,
        reopenCount: 0,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
      }
      db.serviceRequests.unshift(request)
      record(db, request, 'created', 'Request created', `${request.title} — ${describeLocation(db, request)}.`)

      if (options.takeUnitOffline) {
        if (!request.unitId) throw new ServiceError('invalid', 'Choose a unit to take offline.', 'takeUnitOffline')
        const unit = takeUnitOffline(db, request.unitId)
        request.unitTakenOffline = true
        record(db, request, 'unit-offline', `Unit ${unit.number} taken offline`, 'Marked as under maintenance while the work is done.')
        recordPropertyEvent(db, unit.propertyId, 'unit-updated', `Unit ${unit.number} under maintenance`, `For ${request.id}: ${request.title}.`)
      }
      if (options.assign) assignOrder(db, request, options.assign, 'assigned')
      return request
    }),
  )
}

/** Edits issue, location and reporter details. Status and vendor change through actions. */
export function updateServiceRequest(id: string, input: ServiceRequestInput): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      if (request.status === 'cancelled') throw new ServiceError('conflict', 'Cancelled requests can’t be edited.')
      const fields = validateRequestInput(db, input)
      const hasOrders = db.workOrders.some((order) => order.requestId === id)
      const moved = fields.propertyId !== request.propertyId || fields.unitId !== request.unitId || fields.area !== request.area
      if (moved && (hasOrders || request.unitTakenOffline)) {
        throw new ServiceError('conflict', 'The location can’t change once a vendor is assigned or the unit was taken offline.', 'unitId')
      }
      const before = JSON.stringify(pickFields(request))
      const previousPriority = request.priority
      Object.assign(request, fields)
      if (JSON.stringify(pickFields(request)) === before) return request

      request.updatedAt = new Date().toISOString()
      if (previousPriority !== request.priority) {
        // Keep the same start of the SLA clock, with the new target.
        request.dueAt = new Date(new Date(request.dueAt).getTime() + (SLA_HOURS[request.priority] - SLA_HOURS[previousPriority]) * 3_600_000).toISOString()
        record(db, request, 'priority-changed', `Priority changed to ${request.priority}`, `Was ${previousPriority}. New target ${formatTimestamp(db, request.dueAt)}.`)
      }
      record(db, request, 'updated', 'Request details updated', 'Issue, location or access details were edited.')
      return request
    }),
  )
}

export function assignVendor(id: string, input: WorkOrderInput): Promise<WorkOrder> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      assertAction(db, request, 'assign')
      return assignOrder(db, request, input, 'assigned')
    }),
  )
}

/** Replaces the active work order. The previous one stays in history as cancelled. */
export function reassignVendor(id: string, input: WorkOrderInput, reason: string): Promise<WorkOrder> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      const previous = assertAction(db, request, 'reassign')
      if (previous.vendorId === input.vendorId) throw new ServiceError('invalid', 'Choose a different vendor, or reschedule instead.', 'vendorId')
      const now = new Date().toISOString()
      Object.assign(previous, { status: 'cancelled', cancelledAt: now, updatedAt: now } satisfies Partial<WorkOrder>)
      const from = vendorName(db, previous.vendorId).name
      const order = assignOrder(db, request, input, null)
      record(
        db,
        request,
        'reassigned',
        `Reassigned to ${vendorName(db, order.vendorId).name}`,
        `${from}’s work order ${previous.id} was cancelled${reason.trim() ? `: ${reason.trim()}` : ''}.`,
      )
      return order
    }),
  )
}

export function rescheduleWorkOrder(id: string, scheduledFor: string): Promise<WorkOrder> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      const order = assertAction(db, request, 'reschedule')
      if (!isValidTimestamp(scheduledFor)) throw new ServiceError('invalid', 'Choose a visit date and time.', 'scheduledFor')
      order.scheduledFor = new Date(scheduledFor).toISOString()
      order.updatedAt = new Date().toISOString()
      touch(request)
      record(db, request, 'rescheduled', 'Visit rescheduled', `${vendorName(db, order.vendorId).name} on ${formatTimestamp(db, order.scheduledFor)}.`)
      return order
    }),
  )
}

export function startWork(id: string): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      const order = assertAction(db, request, 'start')
      order.status = 'in-progress'
      order.updatedAt = new Date().toISOString()
      request.status = 'in-progress'
      touch(request)
      record(db, request, 'started', 'Work started', `${vendorName(db, order.vendorId).name} started the work.`)
      return request
    }),
  )
}

export function holdRequest(id: string, reason: HoldReason, note: string): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      assertAction(db, request, 'hold')
      const from = request.status === 'in-progress' ? 'in-progress' : 'scheduled'
      request.hold = { reason, note: note.trim(), from }
      request.status = 'on-hold'
      touch(request)
      record(db, request, 'on-hold', 'Put on hold', note.trim() || `Reason: ${reason}.`)
      return request
    }),
  )
}

export function resumeRequest(id: string): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      const order = assertAction(db, request, 'resume')
      request.status = request.hold?.from ?? (order.status === 'in-progress' ? 'in-progress' : 'scheduled')
      request.hold = null
      touch(request)
      record(db, request, 'resumed', 'Work resumed', `Back to ${request.status.replace('-', ' ')}.`)
      return request
    }),
  )
}

export interface CompleteRequestInput {
  /** Calendar date the work finished (YYYY-MM-DD), not in the future. */
  completedOn: string
  actualCost: number | null
  notes: string
  /** Explicit answer to "Return the unit to vacant?". `false` keeps the unit status. */
  returnUnitToVacant: boolean
}

export function completeRequest(id: string, input: CompleteRequestInput): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      const order = assertAction(db, request, 'complete')
      const today = todayIso()
      if (!input.completedOn || input.completedOn > today) {
        throw new ServiceError('invalid', 'Completion date can’t be in the future.', 'completedOn')
      }
      if (input.completedOn < toIsoDate(new Date(order.createdAt))) {
        throw new ServiceError('invalid', 'Completion date can’t be before the work order was created.', 'completedOn')
      }
      assertCost(input.actualCost, 'actualCost')
      const now = new Date().toISOString()
      const completedAt = input.completedOn === today ? now : new Date(`${input.completedOn}T17:00:00`).toISOString()
      Object.assign(order, {
        status: 'completed',
        actualCost: input.actualCost,
        notes: input.notes.trim(),
        completedAt,
        updatedAt: now,
      } satisfies Partial<WorkOrder>)
      Object.assign(request, { status: 'completed', hold: null, completedAt } satisfies Partial<ServiceRequest>)
      touch(request)
      record(
        db,
        request,
        'completed',
        'Request completed',
        `${vendorName(db, order.vendorId).name} finished the work${input.actualCost !== null ? `. Final cost ${formatCost(db, input.actualCost)}` : ''}.`,
      )
      if (input.returnUnitToVacant) releaseUnit(db, request)
      return request
    }),
  )
}

export interface CancelRequestInput {
  reason: string
  returnUnitToVacant: boolean
}

/** Cancels a request (final) and its active work order, which stays in history. */
export function cancelRequest(id: string, input: CancelRequestInput): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      assertAction(db, request, 'cancel')
      if (input.reason.trim().length < 3) throw new ServiceError('invalid', 'Say why the request is cancelled.', 'reason')
      const now = new Date().toISOString()
      const order = db.workOrders.find((entry) => entry.requestId === id && isActiveWorkOrder(entry))
      if (order) Object.assign(order, { status: 'cancelled', cancelledAt: now, updatedAt: now } satisfies Partial<WorkOrder>)
      Object.assign(request, { status: 'cancelled', hold: null, cancelledAt: now, cancelReason: input.reason.trim() } satisfies Partial<ServiceRequest>)
      touch(request)
      record(db, request, 'cancelled', 'Request cancelled', input.reason.trim())
      if (input.returnUnitToVacant) releaseUnit(db, request)
      return request
    }),
  )
}

/** Reopens a completed request within the reopen window. Cancelled requests can't be reopened. */
export function reopenRequest(id: string, reason: string): Promise<ServiceRequest> {
  return run(() =>
    updateDatabase((db) => {
      const request = findRequest(db, id)
      assertAction(db, request, 'reopen')
      if (reason.trim().length < 3) throw new ServiceError('invalid', 'Say why the request is reopened.', 'reason')
      const now = new Date().toISOString()
      Object.assign(request, {
        status: 'open',
        completedAt: null,
        dueAt: dueAtFor(now, request.priority),
        reopenCount: request.reopenCount + 1,
      } satisfies Partial<ServiceRequest>)
      touch(request)
      record(db, request, 'reopened', 'Request reopened', `${reason.trim()} The completed work order stays in history.`)
      return request
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

function findRequest(db: DemoDatabase, id: string): ServiceRequest {
  const request = db.serviceRequests.find((entry) => entry.id === id)
  if (!request) throw new ServiceError('not-found', 'Maintenance request not found.')
  return request
}

/** Validates the transition against the current stored state. Returns the active work order when the action needs one. */
function assertAction(db: DemoDatabase, request: ServiceRequest, action: RequestAction): WorkOrder {
  const active = db.workOrders.filter((order) => order.requestId === request.id && isActiveWorkOrder(order))
  if (active.length > 1) throw new ServiceError('conflict', 'This request has more than one active work order.')
  const check = checkTransition(request, action, { hasActiveWorkOrder: active.length === 1 })
  if (!check.allowed) throw new ServiceError('conflict', check.reason ?? 'That change isn’t allowed.')
  return active[0] as WorkOrder
}

function assignOrder(db: DemoDatabase, request: ServiceRequest, input: WorkOrderInput, eventKind: 'assigned' | null): WorkOrder {
  const vendor = db.vendors.find((entry) => entry.id === input.vendorId)
  if (!vendor) throw new ServiceError('invalid', 'Choose a vendor.', 'vendorId')
  if (!vendor.active) throw new ServiceError('conflict', `${vendor.name} is inactive and can’t take new work orders.`, 'vendorId')
  if (db.workOrders.some((order) => order.requestId === request.id && isActiveWorkOrder(order))) {
    throw new ServiceError('conflict', 'This request already has an active work order.')
  }
  if (input.scheduledFor !== null && !isValidTimestamp(input.scheduledFor)) {
    throw new ServiceError('invalid', 'Enter a valid visit date and time.', 'scheduledFor')
  }
  assertCost(input.estimatedCost, 'estimatedCost')
  const now = new Date().toISOString()
  const count = db.workOrders.filter((order) => order.requestId === request.id).length
  const order: WorkOrder = {
    id: `WO-${request.id.replace(/^MR-/, '')}-${count + 1}`,
    requestId: request.id,
    vendorId: vendor.id,
    status: 'scheduled',
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor).toISOString() : null,
    estimatedCost: input.estimatedCost,
    actualCost: null,
    notes: input.notes.trim(),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    cancelledAt: null,
  }
  db.workOrders.push(order)
  // Assigning always moves the request to Scheduled (reassigning an in-progress job restarts the visit).
  request.status = 'scheduled'
  request.hold = null
  touch(request)
  if (eventKind) {
    record(
      db,
      request,
      eventKind,
      `Assigned to ${vendor.name}`,
      [order.scheduledFor ? `Visit ${formatTimestamp(db, order.scheduledFor)}` : 'Visit not scheduled yet', order.estimatedCost !== null ? `estimate ${formatCost(db, order.estimatedCost)}` : null]
        .filter(Boolean)
        .join(', ') + '.',
    )
  }
  return order
}

/** Returns the unit to vacant after an explicit "yes" from the user. */
function releaseUnit(db: DemoDatabase, request: ServiceRequest) {
  if (!request.unitId) throw new ServiceError('invalid', 'This request isn’t for a unit.', 'returnUnitToVacant')
  const unit = returnUnitToVacant(db, request.unitId, request.id)
  record(db, request, 'unit-returned', `Unit ${unit.number} returned to vacant`, 'Available to lease again.')
  recordPropertyEvent(db, unit.propertyId, 'unit-updated', `Unit ${unit.number} back in service`, `After ${request.id}: ${request.title}.`)
}

function validateRequestInput(db: DemoDatabase, input: ServiceRequestInput): Omit<ServiceRequestInput, never> {
  const title = input.title.trim()
  if (title.length < 3) throw new ServiceError('invalid', 'Describe the issue in a few words.', 'title')
  if (title.length > 120) throw new ServiceError('invalid', 'Keep the title under 120 characters.', 'title')
  if (input.description.trim().length > 1_000) throw new ServiceError('invalid', 'Keep the description under 1,000 characters.', 'description')
  findProperty(db, input.propertyId)
  let area: string | null = null
  if (input.unitId) {
    const unit = findUnit(db, input.unitId)
    if (unit.propertyId !== input.propertyId) throw new ServiceError('invalid', 'Choose a unit in the selected property.', 'unitId')
  } else {
    area = input.area?.trim() ?? ''
    if (area.length < 2) throw new ServiceError('invalid', 'Name the common area, e.g. Lobby.', 'area')
  }
  if (input.tenantId) {
    if (!input.unitId) throw new ServiceError('invalid', 'Link a tenant only for a unit.', 'tenantId')
    const leased = db.leases.some((lease) => lease.tenantId === input.tenantId && lease.unitId === input.unitId)
    if (!leased) throw new ServiceError('invalid', 'This tenant has no lease for the selected unit.', 'tenantId')
  }
  if (input.source === 'tenant' && !input.tenantId) throw new ServiceError('invalid', 'Choose the tenant who reported it.', 'tenantId')
  return {
    title,
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    propertyId: input.propertyId,
    unitId: input.unitId,
    area,
    tenantId: input.tenantId,
    source: input.source,
    permissionToEnter: input.unitId ? input.permissionToEnter : false,
    accessNotes: input.accessNotes.trim(),
  }
}

const pickFields = (request: ServiceRequest) => ({
  title: request.title,
  description: request.description,
  category: request.category,
  priority: request.priority,
  propertyId: request.propertyId,
  unitId: request.unitId,
  area: request.area,
  tenantId: request.tenantId,
  source: request.source,
  permissionToEnter: request.permissionToEnter,
  accessNotes: request.accessNotes,
})

function assertCost(value: number | null, field: string) {
  if (value === null) return
  if (!Number.isFinite(value) || value < 0) throw new ServiceError('invalid', 'Cost can’t be negative.', field)
  if (value > MAX_COST) throw new ServiceError('invalid', 'Cost looks too large.', field)
}

const isValidTimestamp = (value: string) => !Number.isNaN(new Date(value).getTime())
const touch = (request: ServiceRequest) => {
  request.updatedAt = new Date().toISOString()
}
/**
 * Amounts and times written into new activity entries, in the workspace
 * currency and region (Phase 9). With the defaults (USD, en-US) the text is
 * exactly what earlier versions wrote, e.g. "$315" and "Oct 24, 9:30 AM".
 * Entries already in the history keep the text they were written with.
 */
const formatCost = (db: DemoDatabase, value: number) =>
  new Intl.NumberFormat(db.finance.locale, { style: 'currency', currency: db.finance.currency, minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(value)
const formatTimestamp = (db: DemoDatabase, value: string) =>
  new Date(value).toLocaleString(db.finance.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function describeLocation(db: DemoDatabase, request: ServiceRequest): string {
  const property = db.properties.find((entry) => entry.id === request.propertyId)
  const unit = request.unitId ? db.units.find((entry) => entry.id === request.unitId) : undefined
  const prefix = property?.type === 'commercial' ? 'Suite' : 'Unit'
  return `${property?.name ?? 'Property'}, ${unit ? `${prefix} ${unit.number}` : (request.area ?? 'Common area')}`
}

let eventCounter = 0
function record(db: DemoDatabase, request: ServiceRequest, kind: MaintenanceEventKind, title: string, description: string) {
  eventCounter += 1
  db.maintenanceEvents.push({
    id: `mev_${request.id}_${Date.now().toString(36)}${eventCounter}`,
    requestId: request.id,
    kind,
    title,
    description,
    createdAt: new Date().toISOString(),
  })
}
