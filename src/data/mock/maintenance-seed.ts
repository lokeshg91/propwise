import { dueAtFor } from '@/data/domain/maintenance-rules'
import { maintenanceRequests as legacyRequests } from '@/data/mock/maintenance-requests'
import { hashString } from '@/data/mock/tenancy-seed'
import { buildSeedVendors, vendorIdFor } from '@/data/mock/vendor-seed'
import {
  type HoldReason,
  type Lease,
  type MaintenanceEvent,
  type MaintenanceEventKind,
  type MaintenancePriority,
  type Property,
  type RequestCategory,
  type RequestSource,
  type RequestStatus,
  type ServiceRequest,
  type Tenant,
  type Unit,
  type Vendor,
  type WorkOrder,
} from '@/types'

/**
 * Deterministic maintenance records, used to seed a fresh install and to
 * migrate v2 storage. Every id is fixed (legacy "MR-2045"…"MR-2061" keep their
 * ids; generated requests use "MR-1001"…), so running the builder again over
 * the same data adds nothing.
 */

export const LEGACY_REQUEST_IDS = legacyRequests.map((request) => request.id)
/** New requests created in the app continue after the highest legacy number. */
export const FIRST_APP_REQUEST_NUMBER = Math.max(...legacyRequests.map((request) => requestNumber(request.id))) + 1

export function requestNumber(id: string): number {
  return Number(id.replace(/^MR-/, '')) || 0
}

export interface MaintenanceRecords {
  vendors: Vendor[]
  requests: ServiceRequest[]
  workOrders: WorkOrder[]
  events: MaintenanceEvent[]
}

interface Context {
  properties: Map<string, Property>
  units: Unit[]
  tenants: Tenant[]
  leases: Lease[]
  vendors: Vendor[]
  now: Date
}

const HOUR = 3_600_000
const iso = (now: Date, hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR).toISOString()
const plusHours = (value: string, hours: number) => new Date(new Date(value).getTime() + hours * HOUR).toISOString()
const pick = <T,>(list: readonly T[], seed: number): T => list[seed % list.length] as T

const BASE_COST: Record<RequestCategory, number> = {
  plumbing: 260,
  electrical: 320,
  hvac: 540,
  appliance: 210,
  general: 380,
  'locks-security': 180,
  pest: 150,
  landscaping: 420,
  cleaning: 240,
  elevator: 1_250,
  roofing: 2_400,
  other: 600,
}

const estimateFor = (category: RequestCategory, seed: number) => Math.round((BASE_COST[category] * (0.8 + (seed % 50) / 100)) / 5) * 5
const actualFor = (estimate: number, seed: number) => Math.round((estimate * (0.9 + (seed % 30) / 100)) / 5) * 5

/* ------------------------------------------------------------------ specs */

interface RequestSpec {
  id: string
  title: string
  description: string
  category: RequestCategory
  priority: MaintenancePriority
  status: RequestStatus
  propertyId: string
  unitId: string | null
  area: string | null
  tenantId: string | null
  source: RequestSource
  /** Hours before `now` the request was created. */
  ageHours: number
  /** Hours from creation to completion (completed and reopened requests). */
  resolveHours?: number
  /** Explicit vendor (legacy data); otherwise chosen by category. */
  vendorId?: string
  holdReason?: HoldReason
  /** Previous vendor that was replaced (shows reassignment history). */
  reassignedFrom?: boolean
  reopened?: boolean
  cancelReason?: string
}

function vendorFor(ctx: Context, category: RequestCategory, seed: number): Vendor {
  const matches = ctx.vendors.filter((vendor) => vendor.active && vendor.categories.includes(category))
  const fallback = ctx.vendors.find((vendor) => vendor.id === vendorIdFor('Propwise In-house Team')) ?? ctx.vendors[0]
  return matches.length > 0 ? pick(matches, seed) : (fallback as Vendor)
}

/** Turns a spec into a request, its work orders and its history. */
function materialize(ctx: Context, spec: RequestSpec) {
  const seed = hashString(spec.id)
  const createdAt = iso(ctx.now, spec.ageHours)
  const number = requestNumber(spec.id)
  const events: MaintenanceEvent[] = []
  const workOrders: WorkOrder[] = []
  const event = (kind: MaintenanceEventKind, at: string, title: string, description: string) =>
    events.push({ id: `mev_${spec.id}_${events.length + 1}`, requestId: spec.id, kind, title, description, createdAt: at })

  const finishes = spec.status === 'completed' || spec.reopened === true
  // Hours from creation to completion, always in the past.
  const resolve = Math.min(spec.resolveHours ?? 48, spec.ageHours * 0.9)
  const where = describeLocation(ctx, spec)
  event('created', createdAt, 'Request created', `${spec.title} — ${where}.`)

  const needsVendor = spec.status !== 'open' && !(spec.status === 'cancelled' && seed % 2 === 0)
  let completedAt: string | null = null
  let cancelledAt: string | null = null

  if (needsVendor || spec.reopened) {
    const vendor = spec.vendorId ? (ctx.vendors.find((entry) => entry.id === spec.vendorId) ?? vendorFor(ctx, spec.category, seed)) : vendorFor(ctx, spec.category, seed)
    const assignedAt = plusHours(createdAt, Math.min(2, spec.ageHours * 0.1, finishes ? resolve * 0.1 : Infinity))

    if (spec.reassignedFrom) {
      const previous = ctx.vendors.find((entry) => entry.id !== vendor.id && entry.categories.includes(spec.category)) ??
        ctx.vendors.find((entry) => entry.id !== vendor.id) ?? vendor
      const replacedAt = plusHours(assignedAt, Math.min(6, spec.ageHours * 0.2, finishes ? resolve * 0.1 : Infinity))
      workOrders.push({
        id: `WO-${number}-1`,
        requestId: spec.id,
        vendorId: previous.id,
        status: 'cancelled',
        scheduledFor: plusHours(assignedAt, 24),
        estimatedCost: estimateFor(spec.category, seed >>> 3),
        actualCost: null,
        notes: 'Vendor unavailable this week.',
        createdAt: assignedAt,
        updatedAt: replacedAt,
        completedAt: null,
        cancelledAt: replacedAt,
      })
      event('assigned', assignedAt, `Assigned to ${previous.name}`, 'Work order created.')
      event('reassigned', replacedAt, `Reassigned to ${vendor.name}`, `${previous.name} was unavailable. The previous work order was cancelled.`)
    }

    const orderCreated = spec.reassignedFrom
      ? plusHours(assignedAt, Math.min(6, spec.ageHours * 0.2, finishes ? resolve * 0.1 : Infinity))
      : assignedAt
    const estimate = estimateFor(spec.category, seed)
    const order: WorkOrder = {
      id: `WO-${number}-${workOrders.length + 1}`,
      requestId: spec.id,
      vendorId: vendor.id,
      status: 'scheduled',
      scheduledFor: spec.status === 'scheduled' ? plusHours(ctx.now.toISOString(), 18 + (seed % 72)) : plusHours(orderCreated, 20),
      estimatedCost: estimate,
      actualCost: null,
      notes: '',
      createdAt: orderCreated,
      updatedAt: orderCreated,
      completedAt: null,
      cancelledAt: null,
    }
    if (!spec.reassignedFrom) event('assigned', orderCreated, `Assigned to ${vendor.name}`, `Estimate ${formatUsd(estimate)}.`)

    const startedAt = plusHours(orderCreated, Math.min(20, spec.ageHours * 0.35, finishes ? resolve * 0.4 : Infinity))
    if (spec.status === 'in-progress' || spec.status === 'on-hold' || finishes) {
      order.status = 'in-progress'
      order.updatedAt = startedAt
      event('started', startedAt, 'Work started', `${vendor.name} is on site.`)
    }
    if (spec.status === 'on-hold') {
      const heldAt = plusHours(startedAt, Math.min(8, spec.ageHours * 0.2))
      event('on-hold', heldAt, 'Put on hold', HOLD_COPY[spec.holdReason ?? 'parts'])
    }
    if (finishes) {
      completedAt = plusHours(createdAt, resolve)
      Object.assign(order, {
        status: 'completed',
        actualCost: actualFor(estimate, seed >>> 5),
        notes: pick(COMPLETION_NOTES, seed),
        updatedAt: completedAt,
        completedAt,
      } satisfies Partial<WorkOrder>)
      event('completed', completedAt, 'Request completed', `${vendor.name} finished the work. Final cost ${formatUsd(order.actualCost ?? 0)}.`)
    }
    if (spec.status === 'cancelled') {
      cancelledAt = plusHours(createdAt, Math.min(30, spec.ageHours * 0.5))
      Object.assign(order, { status: 'cancelled', updatedAt: cancelledAt, cancelledAt } satisfies Partial<WorkOrder>)
    }
    workOrders.push(order)
  }

  if (spec.status === 'cancelled') {
    cancelledAt ??= plusHours(createdAt, Math.min(30, spec.ageHours * 0.5))
    event('cancelled', cancelledAt, 'Request cancelled', spec.cancelReason ?? 'No longer needed.')
  }

  let dueFrom = createdAt
  let status = spec.status
  if (spec.reopened && completedAt) {
    const reopenedAt = plusHours(completedAt, Math.min(72, (ctx.now.getTime() - new Date(completedAt).getTime()) / HOUR / 2))
    event('reopened', reopenedAt, 'Request reopened', 'The issue came back after the repair.')
    dueFrom = reopenedAt
    status = 'open'
  }

  const lastEventAt = events.at(-1)?.createdAt ?? createdAt
  const request: ServiceRequest = {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    category: spec.category,
    priority: spec.priority,
    status,
    propertyId: spec.propertyId,
    unitId: spec.unitId,
    area: spec.area,
    tenantId: spec.tenantId,
    source: spec.source,
    permissionToEnter: spec.unitId !== null && seed % 3 !== 0,
    accessNotes: spec.unitId && seed % 4 === 0 ? 'Call ahead; dog in the unit.' : '',
    dueAt: dueAtFor(dueFrom, spec.priority),
    unitTakenOffline: false,
    hold:
      spec.status === 'on-hold'
        ? { reason: spec.holdReason ?? 'parts', note: HOLD_COPY[spec.holdReason ?? 'parts'], from: 'in-progress' }
        : null,
    reopenCount: spec.reopened ? 1 : 0,
    createdAt,
    updatedAt: lastEventAt,
    completedAt: spec.reopened ? null : completedAt,
    cancelledAt,
    cancelReason: spec.status === 'cancelled' ? (spec.cancelReason ?? 'No longer needed.') : null,
  }
  return { request, workOrders, events }
}

const HOLD_COPY: Record<HoldReason, string> = {
  parts: 'Waiting for replacement parts.',
  access: 'Waiting for access to the unit.',
  tenant: 'Waiting for the tenant to confirm a time.',
  approval: 'Waiting for owner approval of the estimate.',
  weather: 'Paused for weather.',
  other: 'Paused.',
}

const COMPLETION_NOTES = [
  'Replaced the faulty part and tested.',
  'Repaired and cleaned up the work area.',
  'Fixed on the first visit.',
  'Completed; follow-up not needed.',
]

const formatUsd = (value: number) => `$${value.toLocaleString('en-US')}`

function describeLocation(ctx: Context, spec: Pick<RequestSpec, 'propertyId' | 'unitId' | 'area'>): string {
  const property = ctx.properties.get(spec.propertyId)
  const unit = spec.unitId ? ctx.units.find((entry) => entry.id === spec.unitId) : undefined
  const prefix = property?.type === 'commercial' ? 'Suite' : 'Unit'
  return `${property?.name ?? 'Property'}, ${unit ? `${prefix} ${unit.number}` : (spec.area ?? 'Common area')}`
}

/* ----------------------------------------------------------------- legacy */

const LEGACY_CATEGORY: Record<string, RequestCategory> = {
  'MR-2061': 'plumbing',
  'MR-2060': 'hvac',
  'MR-2059': 'plumbing',
  'MR-2058': 'electrical',
  'MR-2057': 'appliance',
  'MR-2056': 'elevator',
  'MR-2055': 'locks-security',
  'MR-2054': 'general',
  'MR-2053': 'cleaning',
  'MR-2052': 'landscaping',
  'MR-2051': 'general',
  'MR-2050': 'plumbing',
  'MR-2049': 'roofing',
  'MR-2048': 'cleaning',
  'MR-2047': 'electrical',
  'MR-2046': 'other',
  'MR-2045': 'general',
}

/** The 17 Phase 2 requests, linked to real units where the label matches a unit number. */
function legacySpecs(ctx: Context): RequestSpec[] {
  return legacyRequests
    .filter((legacy) => ctx.properties.has(legacy.propertyId))
    .map((legacy) => {
      const number = legacy.unit.replace(/^(unit|suite)\s+/i, '')
      const unit = ctx.units.find((entry) => entry.propertyId === legacy.propertyId && entry.number === number)
      const status: RequestStatus = legacy.status === 'open' ? (legacy.vendor ? 'scheduled' : 'open') : legacy.status
      const ageHours = (ctx.now.getTime() - new Date(legacy.createdAt).getTime()) / HOUR
      return {
        id: legacy.id,
        title: legacy.issue,
        description: `${legacy.issue}. Reported by the site team.`,
        category: LEGACY_CATEGORY[legacy.id] ?? 'general',
        priority: legacy.priority,
        status,
        propertyId: legacy.propertyId,
        unitId: unit?.id ?? null,
        area: unit ? null : legacy.unit,
        tenantId: null,
        source: 'staff',
        ageHours: Math.max(ageHours, 0.1),
        resolveHours: legacy.completedAt ? (new Date(legacy.completedAt).getTime() - new Date(legacy.createdAt).getTime()) / HOUR : undefined,
        vendorId: legacy.vendor ? vendorIdFor(legacy.vendor) : undefined,
      } satisfies RequestSpec
    })
}

/* -------------------------------------------------------------- generated */

const UNIT_WORK: Array<[string, RequestCategory]> = [
  ['Water damage repair after leak', 'general'],
  ['Flooring replacement before re-leasing', 'general'],
  ['Bathroom retile and regrout', 'general'],
  ['Kitchen cabinet and counter repair', 'general'],
  ['Replace failed HVAC air handler', 'hvac'],
  ['Rewire outlets after inspection', 'electrical'],
  ['Mold remediation in bathroom', 'cleaning'],
  ['Repaint and patch drywall', 'general'],
  ['Replace water heater', 'plumbing'],
  ['Pest treatment and sealing', 'pest'],
]

const RESIDENT_ISSUES: Array<[string, RequestCategory, MaintenancePriority]> = [
  ['No hot water', 'plumbing', 'urgent'],
  ['AC blowing warm air', 'hvac', 'high'],
  ['Dishwasher leaking', 'appliance', 'medium'],
  ['Bedroom outlet not working', 'electrical', 'medium'],
  ['Front door lock sticking', 'locks-security', 'medium'],
  ['Ants in kitchen', 'pest', 'low'],
  ['Running toilet', 'plumbing', 'low'],
  ['Refrigerator not cooling', 'appliance', 'high'],
  ['Window won’t close', 'general', 'medium'],
  ['Smoke detector chirping', 'electrical', 'low'],
]

const TENANT_BUSINESS_ISSUES: Array<[string, RequestCategory, MaintenancePriority]> = [
  ['Suite too warm in afternoons', 'hvac', 'high'],
  ['Restroom sink clogged', 'plumbing', 'medium'],
  ['Flickering ceiling lights', 'electrical', 'medium'],
  ['Badge reader not unlocking', 'locks-security', 'high'],
  ['Carpet stain cleaning', 'cleaning', 'low'],
]

type AreaJob = readonly [area: string, title: string, category: RequestCategory, priority: MaintenancePriority]

const COMMON_AREAS: Record<Property['type'], readonly AreaJob[]> = {
  residential: [
    ['Parking lot', 'Restripe parking lot', 'general', 'low'],
    ['Fitness center', 'Treadmill belt replacement', 'other', 'low'],
    ['Pool deck', 'Pool heater not igniting', 'other', 'medium'],
    ['Courtyard', 'Tree trimming near walkways', 'landscaping', 'medium'],
    ['Laundry room', 'Dryer not heating', 'appliance', 'medium'],
    ['Mailroom', 'Package locker door broken', 'locks-security', 'medium'],
    ['Roof', 'Gutter cleaning and downspout repair', 'roofing', 'low'],
    ['Stairwell B', 'Emergency lighting out', 'electrical', 'high'],
  ],
  commercial: [
    ['Main lobby', 'Lobby revolving door alignment', 'general', 'medium'],
    ['Parking garage', 'Garage exhaust fan fault', 'electrical', 'high'],
    ['Roof', 'Rooftop unit filter change', 'hvac', 'low'],
    ['Restrooms, floor 2', 'Restroom partition repair', 'general', 'low'],
    ['Loading dock', 'Dock leveler hydraulic leak', 'general', 'medium'],
    ['Elevator 1', 'Elevator door sensor fault', 'elevator', 'high'],
    ['Exterior', 'Pressure wash storefront', 'cleaning', 'low'],
  ],
}

const DESCRIBE: Record<RequestSource, string> = {
  tenant: 'Reported by the tenant through the resident line.',
  staff: 'Found by the site team during a walk-through.',
  inspection: 'Flagged during a scheduled inspection.',
}

function generatedSpecs(ctx: Context): RequestSpec[] {
  const specs: RequestSpec[] = []
  // Fixed id blocks per group, so a different number of units in one group
  // never shifts the ids of another: A 1001–1020, B 1021–1040, C 1041–1060.
  const idIn = (block: number, index: number) => `MR-${1001 + block * 20 + index}`
  const byHash = (salt: string) => (a: { id: string }, b: { id: string }) => hashString(`${salt}:${a.id}`) - hashString(`${salt}:${b.id}`)

  // A. Every unit under maintenance gets an active request explaining why.
  const offline = ctx.units.filter((unit) => unit.status === 'maintenance' && ctx.properties.has(unit.propertyId)).sort(byHash('offline'))
  const offlineStatuses: RequestStatus[] = ['in-progress', 'scheduled', 'on-hold', 'open', 'in-progress', 'scheduled', 'in-progress', 'open', 'scheduled', 'on-hold']
  offline.slice(0, 20).forEach((unit, index) => {
    const [title, category] = pick(UNIT_WORK, hashString(unit.id))
    const status = offlineStatuses[index % offlineStatuses.length] as RequestStatus
    const priority: MaintenancePriority = index === 0 ? 'high' : index % 3 === 0 ? 'high' : 'medium'
    specs.push({
      id: idIn(0, index),
      title,
      description: `Unit is offline while the work is done. ${DESCRIBE.staff}`,
      category,
      priority,
      status,
      propertyId: unit.propertyId,
      unitId: unit.id,
      area: null,
      tenantId: null,
      source: 'staff',
      // The first one is past its 3-day target (overdue).
      ageHours: index === 0 ? 120 : 10 + (hashString(unit.id) % 60),
      holdReason: status === 'on-hold' ? (index % 2 === 0 ? 'parts' : 'approval') : undefined,
      reassignedFrom: index === 4,
    })
  })

  // B. Tenant-reported issues on occupied units, linked to the current tenant.
  const leaseAgeHours = (lease: Lease) => (ctx.now.getTime() - new Date(`${lease.startDate}T12:00:00`).getTime()) / HOUR
  const leases = ctx.leases
    .filter((lease) => lease.status === 'active' && ctx.properties.has(lease.propertyId) && leaseAgeHours(lease) >= 24 * 10)
    .sort(byHash('reported'))
  const tenantStatuses: RequestStatus[] = ['open', 'scheduled', 'in-progress', 'completed', 'completed', 'open', 'in-progress', 'on-hold', 'completed', 'scheduled', 'completed', 'open', 'completed', 'in-progress', 'completed']
  leases.slice(0, tenantStatuses.length).forEach((lease, index) => {
    const property = ctx.properties.get(lease.propertyId) as Property
    const seed = hashString(lease.id)
    const [title, category, basePriority] = pick(property.type === 'residential' ? RESIDENT_ISSUES : TENANT_BUSINESS_ISSUES, seed)
    const status = tenantStatuses[index] as RequestStatus
    const priority: MaintenancePriority = index === 0 ? 'urgent' : basePriority
    const completed = status === 'completed'
    specs.push({
      id: idIn(1, index),
      title,
      description: DESCRIBE.tenant,
      category,
      priority,
      status,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      area: null,
      tenantId: lease.tenantId,
      source: 'tenant',
      // index 0: urgent and 30 hours old (overdue). Completed ones spread over 5 months.
      // Reported while this lease was running.
      ageHours: Math.min(index === 0 ? 30 : completed ? 24 * (6 + (seed % 140)) : 4 + (seed % 40), leaseAgeHours(lease) - 24),
      resolveHours: completed ? 6 + (seed % 90) : undefined,
      holdReason: status === 'on-hold' ? 'tenant' : undefined,
    })
  })

  // C. Common areas and turnovers: mostly history, plus cancellations and a reopened request.
  const properties = [...ctx.properties.values()].sort((a, b) => a.id.localeCompare(b.id))
  const otherStatuses: RequestStatus[] = [
    'completed', 'completed', 'open', 'completed', 'cancelled', 'completed', 'completed', 'scheduled', 'completed', 'completed',
    'cancelled', 'completed', 'completed', 'open', 'completed', 'completed', 'cancelled', 'completed', 'completed', 'completed',
  ]
  otherStatuses.forEach((status, index) => {
    const property = properties[index % properties.length] as Property
    const areas = COMMON_AREAS[property.type]
    const [area, title, category, priority] = pick(areas, index + hashString(property.id))
    const seed = hashString(`common:${index}:${property.id}`)
    const completed = status === 'completed'
    const reopened = index === 13
    specs.push({
      id: idIn(2, index),
      title,
      description: DESCRIBE[index % 3 === 0 ? 'inspection' : 'staff'],
      category,
      priority: index === 2 ? 'high' : priority,
      status,
      propertyId: property.id,
      unitId: null,
      area,
      tenantId: null,
      source: index % 3 === 0 ? 'inspection' : 'staff',
      // index 2: high priority, 4 days old (overdue).
      ageHours: index === 2 ? 96 : reopened ? 24 * 12 : completed || status === 'cancelled' ? 24 * (3 + (seed % 175)) : 6 + (seed % 30),
      resolveHours: completed ? 8 + (seed % 120) : reopened ? 48 : undefined,
      reopened,
      cancelReason: status === 'cancelled' ? pick(['Duplicate of an earlier request.', 'Resolved by the tenant.', 'Deferred to the next capital plan.'], index) : undefined,
    })
  })

  return specs
}

/**
 * Returns the maintenance records missing from `existing`. Ids are fixed, so
 * calling it again with the result included returns nothing new.
 */
export function buildMaintenanceRecords(
  data: { properties: Property[]; units: Unit[]; tenants: Tenant[]; leases: Lease[] },
  existing: Partial<MaintenanceRecords> = {},
  now: Date = new Date(),
): MaintenanceRecords {
  const vendorIds = new Set((existing.vendors ?? []).map((vendor) => vendor.id))
  const vendors = buildSeedVendors().filter((vendor) => !vendorIds.has(vendor.id))
  const ctx: Context = {
    properties: new Map(data.properties.map((property) => [property.id, property])),
    units: data.units,
    tenants: data.tenants,
    leases: data.leases,
    vendors: [...(existing.vendors ?? []), ...vendors],
    now,
  }

  const requestIds = new Set((existing.requests ?? []).map((request) => request.id))
  const workOrderIds = new Set((existing.workOrders ?? []).map((order) => order.id))
  const eventIds = new Set((existing.events ?? []).map((event) => event.id))
  const result: MaintenanceRecords = { vendors, requests: [], workOrders: [], events: [] }

  for (const spec of [...legacySpecs(ctx), ...generatedSpecs(ctx)]) {
    if (requestIds.has(spec.id)) continue
    requestIds.add(spec.id)
    const built = materialize(ctx, spec)
    result.requests.push(built.request)
    result.workOrders.push(...built.workOrders.filter((order) => !workOrderIds.has(order.id)))
    result.events.push(...built.events.filter((event) => !eventIds.has(event.id)))
  }
  return result
}
