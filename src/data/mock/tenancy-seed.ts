import { addDays, addMonths, todayIso } from '@/data/domain/dates'
import { isCurrentLease } from '@/data/domain/lease-rules'
import { type Lease, type Property, type Tenant, type Unit } from '@/types'

/**
 * Deterministic tenant and lease records.
 *
 * Used both to seed a fresh install and to migrate v1 storage: every record id
 * is derived from its source (e.g. `ten_u_<unitId>`), so running the builder
 * again over the same data never creates duplicates.
 */

const FIRST = ['Avery', 'Jordan', 'Sofia', 'Marcus', 'Priya', 'Ethan', 'Amara', 'Daniel', 'Grace', 'Liam', 'Maya', 'Noah', 'Elena', 'Omar', 'Hannah', 'Lucas', 'Zoe', 'Isaac', 'Nina', 'Theo', 'Leah', 'Caleb', 'Aria', 'Mateo']
const LAST = ['Chen', 'Ellis', 'Martinez', 'Raman', 'Brooks', 'Okafor', 'Kim', 'Liu', 'Patel', 'Nguyen', 'Foster', 'Reyes', 'Hart', 'Sato', 'Bennett', 'Moreau', 'Haddad', 'Novak', 'Quinn', 'Silva', 'Walsh', 'Duarte', 'Ibsen']
const RELATIONSHIPS = ['Parent', 'Sibling', 'Spouse', 'Partner', 'Friend']
const PAST_BUSINESSES = ['Northgate Design Co.', 'Bluebird Florist', 'Copper Kettle Bakery', 'Vantage Tax Advisors', 'Sunrise Chiropractic']

const AREA_CODES: Record<string, string> = {
  TX: '512', CA: '619', OR: '503', NC: '919', CO: '303', AZ: '602', IL: '312', WA: '206', TN: '615', PA: '412', FL: '813', ID: '208',
}

/** Small stable hash for deterministic choices. */
export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const pick = <T,>(list: readonly T[], seed: number): T => list[seed % list.length] as T
const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Fictional number in the reserved 555-01xx range. */
function phoneFor(state: string, seed: number): string {
  return `(${AREA_CODES[state] ?? '555'}) 555-01${String(seed % 100).padStart(2, '0')}`
}

function emailFor(name: string, kind: Tenant['kind'], seed: number): string {
  if (kind === 'business') return `accounts@${slug(name)}.example`
  const [first = 'tenant', ...rest] = slug(name).split('-')
  return `${first}.${rest.join('') || 'resident'}${seed % 7 === 0 ? seed % 90 : ''}@example.com`
}

/** Seed names can repeat (two tenants called Avery Chen); emails must not. */
function uniqueEmail(email: string, used: Set<string>): string {
  if (!used.has(email)) return email
  const [local = 'tenant', domain = 'example.com'] = email.split('@')
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${local}${suffix}@${domain}`
    if (!used.has(candidate)) return candidate
  }
}

function unitPrefix(property: Property) {
  return property.type === 'residential' ? 'Unit' : 'Suite'
}

function tenantFields(name: string, property: Property, unit: Unit, seed: number, createdAt: string): Omit<Tenant, 'id'> {
  const kind = property.type === 'residential' ? 'individual' : 'business'
  const street = property.location.street ?? property.name
  return {
    kind,
    name,
    email: emailFor(name, kind, seed),
    phone: phoneFor(property.location.state, seed),
    mailingAddress: {
      street: `${street}, ${unitPrefix(property)} ${unit.number}`,
      city: property.location.city,
      state: property.location.state,
      postalCode: property.location.postalCode ?? '00000',
    },
    emergencyContact:
      kind === 'individual' && seed % 4 !== 0
        ? {
            name: `${pick(FIRST, seed >>> 3)} ${name.split(' ').at(-1) ?? pick(LAST, seed)}`,
            relationship: pick(RELATIONSHIPS, seed >>> 5),
            phone: phoneFor(property.location.state, seed >>> 7),
          }
        : null,
    createdAt,
    updatedAt: createdAt,
  }
}

function depositFor(property: Property, rent: number) {
  const multiple = property.type === 'residential' ? 1 : 2
  return Math.round((rent * multiple) / 50) * 50
}

/** Lease start that keeps the term realistic and never lies in the future. */
function startFor(property: Property, endDate: string, today: string) {
  const terms = property.type === 'residential' ? [12, 24, 36] : [36, 60, 84]
  for (const months of terms) {
    const start = addMonths(endDate, -months)
    if (start <= today) return start
  }
  return addMonths(today, -1)
}

export interface TenancyRecords {
  tenants: Tenant[]
  leases: Lease[]
}

/**
 * Builds the tenancy records missing from `existing`:
 * 1. a tenant + active lease for every occupied unit without a current lease;
 * 2. 25 past tenants (expired or terminated leases);
 * 3. 6 pending tenants on free vacant units.
 */
export function buildTenancyRecords(
  properties: Property[],
  units: Unit[],
  existing: TenancyRecords = { tenants: [], leases: [] },
  today: string = todayIso(),
): TenancyRecords {
  const propertyById = new Map(properties.map((property) => [property.id, property]))
  const tenantIds = new Set(existing.tenants.map((tenant) => tenant.id))
  const leaseIds = new Set(existing.leases.map((lease) => lease.id))
  const tenants: Tenant[] = []
  const leases: Lease[] = []
  const emails = new Set(existing.tenants.map((tenant) => tenant.email))
  const currentByUnit = new Map<string, Lease>()
  for (const lease of existing.leases) if (isCurrentLease(lease)) currentByUnit.set(lease.unitId, lease)

  const add = (tenant: Tenant, lease: Lease) => {
    if (tenantIds.has(tenant.id) || leaseIds.has(lease.id)) return
    tenant.email = uniqueEmail(tenant.email, emails)
    emails.add(tenant.email)
    tenantIds.add(tenant.id)
    leaseIds.add(lease.id)
    tenants.push(tenant)
    leases.push(lease)
    if (isCurrentLease(lease)) currentByUnit.set(lease.unitId, lease)
  }

  // 1. Active leases for occupied units.
  for (const unit of units) {
    const property = propertyById.get(unit.propertyId)
    if (!property || unit.status !== 'occupied' || currentByUnit.has(unit.id)) continue
    const seed = hashString(unit.id)
    const endDate = unit.leaseEndDate ?? addMonths(today, 12)
    const startDate = startFor(property, endDate, today)
    const createdAt = `${startDate}T15:00:00.000Z`
    const name = unit.tenantName?.trim() || `Tenant of ${unitPrefix(property)} ${unit.number}`
    add(
      { id: `ten_u_${unit.id}`, ...tenantFields(name, property, unit, seed, createdAt) },
      {
        id: `lease_u_${unit.id}`,
        tenantId: `ten_u_${unit.id}`,
        propertyId: property.id,
        unitId: unit.id,
        startDate,
        endDate,
        monthlyRent: unit.rent,
        securityDeposit: depositFor(property, unit.rent),
        paymentDueDay: property.type === 'residential' ? 1 : seed % 2 === 0 ? 1 : 5,
        status: 'active',
        endedAt: null,
        endReason: null,
        createdAt,
        updatedAt: createdAt,
      },
    )
  }

  // Free units: vacant and not reserved, in a stable order.
  const freeUnits = () =>
    units
      .filter((unit) => unit.status === 'vacant' && !currentByUnit.has(unit.id) && propertyById.has(unit.propertyId))
      .sort((a, b) => hashString(`free:${a.id}`) - hashString(`free:${b.id}`))

  // 2. Past tenants: mostly on vacant units (explaining the vacancy), some on occupied units before the current lease.
  const pastTargets = [...freeUnits().slice(6), ...units.filter((unit) => unit.status === 'occupied')]
  for (let index = 0; index < 25 && index < pastTargets.length; index += 1) {
    const unit = pastTargets[index] as Unit
    const property = propertyById.get(unit.propertyId) as Property
    const seed = hashString(`past:${index}:${unit.id}`)
    const current = currentByUnit.get(unit.id)
    const endedAt = current ? addDays(current.startDate, -1 - (seed % 20)) : addDays(today, -(15 + (seed % 120)))
    const terminated = seed % 10 < 3
    const endDate = terminated ? addMonths(endedAt, 2 + (seed % 5)) : endedAt
    const startDate = addMonths(endDate, property.type === 'residential' ? -12 : -36)
    const name =
      property.type === 'residential' ? `${pick(FIRST, seed)} ${pick(LAST, seed >>> 4)}` : pick(PAST_BUSINESSES, seed)
    const rent = Math.round((unit.rent * 0.96) / 5) * 5
    const createdAt = `${startDate}T15:00:00.000Z`
    add(
      { id: `ten_past_${index + 1}`, ...tenantFields(name, property, unit, seed, createdAt) },
      {
        id: `lease_past_${index + 1}`,
        tenantId: `ten_past_${index + 1}`,
        propertyId: property.id,
        unitId: unit.id,
        startDate,
        endDate,
        monthlyRent: rent,
        securityDeposit: depositFor(property, rent),
        paymentDueDay: 1,
        status: terminated ? 'terminated' : 'expired',
        endedAt,
        endReason: terminated ? (seed % 2 === 0 ? 'early-termination' : 'transfer') : 'moved-out',
        createdAt,
        updatedAt: `${endedAt}T15:00:00.000Z`,
      },
    )
  }

  // 3. Pending tenants: signed leases with a future move-in on free vacant units.
  const pendingTargets = freeUnits().slice(0, 6)
  pendingTargets.forEach((unit, index) => {
    const property = propertyById.get(unit.propertyId) as Property
    const seed = hashString(`pending:${index}:${unit.id}`)
    const startDate = addDays(today, 7 + ((seed % 6) * 7))
    const endDate = addDays(addMonths(startDate, property.type === 'residential' ? 12 : 36), -1)
    const name =
      property.type === 'residential' ? `${pick(FIRST, seed >>> 2)} ${pick(LAST, seed >>> 6)}` : pick(['Harborline Physical Therapy', 'Quillfeather Studio'], seed)
    const createdAt = `${addDays(today, -(3 + (seed % 10)))}T15:00:00.000Z`
    add(
      { id: `ten_pend_${index + 1}`, ...tenantFields(name, property, unit, seed, createdAt) },
      {
        id: `lease_pend_${index + 1}`,
        tenantId: `ten_pend_${index + 1}`,
        propertyId: property.id,
        unitId: unit.id,
        startDate,
        endDate,
        monthlyRent: unit.rent,
        securityDeposit: depositFor(property, unit.rent),
        paymentDueDay: 1,
        status: 'pending',
        endedAt: null,
        endReason: null,
        createdAt,
        updatedAt: createdAt,
      },
    )
  })

  return { tenants, leases }
}

/**
 * Fresh-install demo states that need attention: three active leases past
 * their end date (holdover, still occupied) and one pending lease whose
 * move-in date has passed. Not applied when migrating stored data.
 */
export function applyDemoAttentionStates(units: Unit[], leases: Lease[], today: string = todayIso()): void {
  const byHash = (salt: string) => (a: Lease, b: Lease) => hashString(`${salt}:${a.id}`) - hashString(`${salt}:${b.id}`)
  // Only units with a single lease, so moving the term never overlaps an earlier tenant.
  const leaseCount = new Map<string, number>()
  for (const lease of leases) leaseCount.set(lease.unitId, (leaseCount.get(lease.unitId) ?? 0) + 1)
  const holdovers = leases
    .filter((lease) => lease.status === 'active' && leaseCount.get(lease.unitId) === 1)
    .sort(byHash('holdover'))
    .slice(0, 3)
  for (const lease of holdovers) {
    lease.endDate = addDays(today, -(6 + (hashString(lease.id) % 40)))
    lease.startDate = addMonths(lease.endDate, -12)
    lease.createdAt = `${lease.startDate}T15:00:00.000Z`
    lease.updatedAt = lease.createdAt
    const unit = units.find((entry) => entry.id === lease.unitId)
    if (unit) unit.leaseEndDate = lease.endDate
  }
  const dueMoveIn = leases.filter((lease) => lease.status === 'pending').sort(byHash('move-in'))[0]
  if (dueMoveIn) {
    dueMoveIn.startDate = addDays(today, -2)
    dueMoveIn.endDate = addDays(addMonths(dueMoveIn.startDate, 12), -1)
  }
}
