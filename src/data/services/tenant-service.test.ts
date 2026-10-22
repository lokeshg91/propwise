import { addDays, addMonths, todayIso } from '@/data/domain/dates'
import { getLeaseDisplayStatus, isCurrentLease } from '@/data/domain/lease-rules'
import { getPropertyDetail, updateUnit } from '@/data/services/property-service'
import { isServiceError } from '@/data/services/service-error'
import {
  activateLease,
  cancelLease,
  createTenant,
  endLease,
  getAssignableUnits,
  getTenantDetail,
  getTenants,
  updateTenant,
} from '@/data/services/tenant-service'
import { readDatabase, resetDemoData } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { type Lease, type LeaseAssignmentInput, type TenantInput, type Unit } from '@/types'

const today = todayIso()

/** A vacant, unreserved unit to lease in tests. */
function freeUnit(skip = 0): Unit {
  const db = readDatabase()
  const free = db.units.filter(
    (unit) => unit.status === 'vacant' && !db.leases.some((lease) => lease.unitId === unit.id && isCurrentLease(lease)),
  )
  const unit = free[skip]
  if (!unit) throw new Error('No free unit in seed')
  return unit
}

function leaseFor(unit: Unit, overrides: Partial<LeaseAssignmentInput> = {}): LeaseAssignmentInput {
  return {
    propertyId: unit.propertyId,
    unitId: unit.id,
    startDate: addMonths(today, -1),
    endDate: addMonths(today, 11),
    monthlyRent: 2_000,
    securityDeposit: 2_000,
    paymentDueDay: 1,
    status: 'active',
    ...overrides,
  }
}

function tenantInput(lease: LeaseAssignmentInput | null, overrides: Partial<TenantInput> = {}): TenantInput {
  return {
    kind: 'individual',
    name: '  Rowan Pierce ',
    email: 'Rowan.Pierce@Example.com',
    phone: '(512) 555-0199',
    mailingAddress: { street: '1 Test St', city: 'Austin', state: 'TX', postalCode: '78701' },
    emergencyContact: null,
    notes: '',
    lease,
    ...overrides,
  }
}

const leaseOf = (tenantId: string) => readDatabase().leases.find((lease) => lease.tenantId === tenantId) as Lease
const unitById = (id: string) => readDatabase().units.find((unit) => unit.id === id) as Unit
const propertyById = (id: string) => readDatabase().properties.find((property) => property.id === id)

async function expectServiceError(promise: Promise<unknown>, field?: string) {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  expect(isServiceError(error)).toBe(true)
  if (field && isServiceError(error)) expect(error.field).toBe(field)
}

describe('tenant service reads', () => {
  it('lists seeded tenants with their primary lease, property and unit', async () => {
    const list = await getTenants()
    expect(list).toHaveLength(371)
    const active = list.filter((item) => item.status === 'active')
    expect(active).toHaveLength(340)
    expect(active.every((item) => item.lease?.status === 'active' && item.property && item.unit)).toBe(true)
  })

  it('returns details with lease history and events', async () => {
    const [first] = await getTenants()
    const detail = await getTenantDetail(first?.tenant.id ?? '')
    expect(detail?.leases.length).toBeGreaterThan(0)
    expect(detail).not.toHaveProperty('ledger') // Payments come from the Finance ledger (getTenantFinance).
    expect(await getTenantDetail('nope')).toBeNull()
  })

  it('offers only vacant units without a current lease', async () => {
    const db = readDatabase()
    const assignable = await getAssignableUnits()
    for (const property of assignable) {
      for (const option of property.units) {
        const unit = db.units.find((entry) => entry.id === option.id)
        expect(unit?.status).toBe('vacant')
        expect(db.leases.some((lease) => lease.unitId === option.id && isCurrentLease(lease))).toBe(false)
      }
    }
  })
})

describe('creating tenants', () => {
  it('creates a tenant with an active lease and occupies the unit atomically', async () => {
    const unit = freeUnit()
    const occupiedBefore = propertyById(unit.propertyId)?.occupiedUnits ?? 0
    const revenueBefore = propertyById(unit.propertyId)?.monthlyRevenue ?? 0

    const tenant = await createTenant(tenantInput(leaseFor(unit)))
    expect(tenant).toMatchObject({ name: 'Rowan Pierce', email: 'rowan.pierce@example.com' })

    expect(unitById(unit.id)).toMatchObject({ status: 'occupied', tenantName: 'Rowan Pierce', rent: 2_000 })
    expect(propertyById(unit.propertyId)?.occupiedUnits).toBe(occupiedBefore + 1)
    expect(propertyById(unit.propertyId)?.monthlyRevenue).toBe(revenueBefore + 2_000)
    const detail = await getTenantDetail(tenant.id)
    expect(detail?.status).toBe('active')
    expect(detail?.events.map((event) => event.kind)).toEqual(['lease-created', 'tenant-created'])

    // Persisted.
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toContain('rowan.pierce@example.com')
  })

  it('creates a pending lease that reserves the unit but keeps it vacant', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(
      tenantInput(leaseFor(unit, { status: 'pending', startDate: addDays(today, 14), endDate: addMonths(today, 12) })),
    )
    expect(unitById(unit.id).status).toBe('vacant')
    expect((await getTenantDetail(tenant.id))?.status).toBe('pending')
    expect((await getAssignableUnits()).flatMap((property) => property.units).some((entry) => entry.id === unit.id)).toBe(false)
  })

  it('prevents a second active or pending lease on the same unit', async () => {
    const unit = freeUnit()
    await createTenant(tenantInput(leaseFor(unit, { status: 'pending', startDate: addDays(today, 7) })))
    await expectServiceError(
      createTenant(tenantInput(leaseFor(unit), { email: 'other@example.com' })),
      'unitId',
    )

    const occupied = readDatabase().units.find((entry) => entry.status === 'occupied') as Unit
    await expectServiceError(createTenant(tenantInput(leaseFor(occupied), { email: 'third@example.com' })), 'unitId')
  })

  it('rolls back the new tenant when the lease is rejected', async () => {
    const before = readDatabase().tenants.length
    const storedBefore = window.localStorage.getItem(STORAGE_KEYS.demoData)
    const maintenance = readDatabase().units.find((unit) => unit.status === 'maintenance') as Unit

    await expectServiceError(createTenant(tenantInput(leaseFor(maintenance))), 'unitId')
    expect(readDatabase().tenants).toHaveLength(before)
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toBe(storedBefore)
  })

  it('validates lease terms and unique emails', async () => {
    const unit = freeUnit()
    const existingEmail = readDatabase().tenants[0]?.email ?? ''
    await expectServiceError(createTenant(tenantInput(leaseFor(unit), { email: existingEmail.toUpperCase() })), 'email')
    await expectServiceError(createTenant(tenantInput(leaseFor(unit, { endDate: addMonths(today, -2) }))), 'endDate')
    await expectServiceError(createTenant(tenantInput(leaseFor(unit, { startDate: addDays(today, 3) }))), 'startDate')
    await expectServiceError(createTenant(tenantInput(leaseFor(unit, { status: 'pending' }))), 'startDate')
    await expectServiceError(createTenant(tenantInput(leaseFor(unit, { securityDeposit: 6_001 }))), 'securityDeposit')
    await expectServiceError(createTenant(tenantInput(leaseFor(unit, { paymentDueDay: 31 }))), 'paymentDueDay')
    await expectServiceError(createTenant(tenantInput(null)), 'unitId')
    expect(unitById(unit.id).status).toBe('vacant')
  })
})

describe('updating tenants and leases', () => {
  it('moves an active tenant to another unit, vacating the old one', async () => {
    const from = freeUnit()
    const to = freeUnit(1)
    const tenant = await createTenant(tenantInput(leaseFor(from)))
    const lease = leaseOf(tenant.id)

    await updateTenant(tenant.id, tenantInput(leaseFor(to)))

    expect(unitById(from.id)).toMatchObject({ status: 'vacant', tenantName: null })
    expect(unitById(to.id)).toMatchObject({ status: 'occupied', tenantName: 'Rowan Pierce' })
    expect(leaseOf(tenant.id)).toMatchObject({ id: lease.id, unitId: to.id })
    const kinds = (await getTenantDetail(tenant.id))?.events.map((event) => event.kind)
    expect(kinds?.[0]).toBe('lease-moved')
  })

  it('syncs the tenant name and rent onto the unit and property totals', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(tenantInput(leaseFor(unit)))
    const revenue = propertyById(unit.propertyId)?.monthlyRevenue ?? 0

    await updateTenant(tenant.id, tenantInput(leaseFor(unit, { monthlyRent: 2_250 }), { name: 'Rowan P. Pierce' }))
    expect(unitById(unit.id)).toMatchObject({ tenantName: 'Rowan P. Pierce', rent: 2_250 })
    expect(propertyById(unit.propertyId)?.monthlyRevenue).toBe(revenue + 250)
  })

  it('rejects removing the lease or moving an active tenant back to pending', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(tenantInput(leaseFor(unit)))
    await expectServiceError(updateTenant(tenant.id, tenantInput(null)), 'unitId')
    await expectServiceError(
      updateTenant(tenant.id, tenantInput(leaseFor(unit, { status: 'pending', startDate: addDays(today, 5) }))),
      'status',
    )
    expect(unitById(unit.id).status).toBe('occupied')
  })

  it('does not record anything when nothing changed', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(tenantInput(leaseFor(unit)))
    const eventCount = readDatabase().tenantEvents.length
    await updateTenant(tenant.id, tenantInput(leaseFor(unit)))
    expect(readDatabase().tenantEvents).toHaveLength(eventCount)
  })
})

describe('lease lifecycle', () => {
  it('keeps a unit occupied after the lease end date (holdover) until it is ended', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(
      tenantInput(leaseFor(unit, { startDate: addMonths(today, -13), endDate: addMonths(today, -1) })),
    )
    const lease = leaseOf(tenant.id)
    expect(lease.status).toBe('active')
    expect(getLeaseDisplayStatus(lease)).toBe('holdover')
    expect(unitById(unit.id).status).toBe('occupied')

    // A fresh read (e.g. next day) still leaves the unit occupied.
    const raw = window.localStorage.getItem(STORAGE_KEYS.demoData) ?? ''
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    expect(unitById(unit.id).status).toBe('occupied')
  })

  it('ends an active lease, releasing the unit only on explicit End Lease', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(tenantInput(leaseFor(unit)))
    const lease = leaseOf(tenant.id)
    const occupied = propertyById(unit.propertyId)?.occupiedUnits ?? 0

    await expectServiceError(endLease(lease.id, addDays(today, 1), 'moved-out'), 'moveOutDate')
    await expectServiceError(endLease(lease.id, addMonths(today, -2), 'moved-out'), 'moveOutDate')

    const ended = await endLease(lease.id, today, 'early-termination')
    expect(ended).toMatchObject({ status: 'terminated', endedAt: today, endReason: 'early-termination' })
    expect(unitById(unit.id)).toMatchObject({ status: 'vacant', tenantName: null, leaseEndDate: null })
    expect(propertyById(unit.propertyId)?.occupiedUnits).toBe(occupied - 1)
    expect((await getTenantDetail(tenant.id))?.status).toBe('past')
    await expectServiceError(endLease(lease.id, today, 'moved-out'))
  })

  it('marks a lease expired when the tenant moves out at or after term', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(
      tenantInput(leaseFor(unit, { startDate: addMonths(today, -13), endDate: addMonths(today, -1) })),
    )
    const ended = await endLease(leaseOf(tenant.id).id, today, 'moved-out')
    expect(ended.status).toBe('expired')
  })

  it('cancels a pending lease without touching the unit status', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(tenantInput(leaseFor(unit, { status: 'pending', startDate: addDays(today, 10) })))
    const lease = leaseOf(tenant.id)
    await expect(activateLease(lease.id)).rejects.toThrow(/future/)

    await cancelLease(lease.id)
    expect(leaseOf(tenant.id).status).toBe('terminated')
    expect(unitById(unit.id).status).toBe('vacant')
    expect((await getAssignableUnits()).flatMap((property) => property.units).some((entry) => entry.id === unit.id)).toBe(true)
  })

  it('activates a pending lease once its start date has arrived', async () => {
    const unit = freeUnit()
    const tenant = await createTenant(tenantInput(leaseFor(unit, { status: 'pending', startDate: addDays(today, 10) })))
    const lease = leaseOf(tenant.id)
    // The move-in date arrives (simulated by editing stored data).
    const db = readDatabase()
    const stored = db.leases.find((entry) => entry.id === lease.id) as Lease
    stored.startDate = addDays(today, -1)
    expect(getLeaseDisplayStatus(stored)).toBe('move-in-due')

    await activateLease(lease.id)
    expect(leaseOf(tenant.id).status).toBe('active')
    expect(unitById(unit.id)).toMatchObject({ status: 'occupied', tenantName: 'Rowan Pierce' })
  })

  it('blocks unit edits that would break the lease link', async () => {
    const unit = freeUnit()
    await createTenant(tenantInput(leaseFor(unit)))
    const input = { number: unit.number, type: unit.type, floor: unit.floor, areaSqft: unit.areaSqft, rent: 2_000 }
    await expectServiceError(updateUnit(unit.id, { ...input, status: 'vacant' }), 'status')
    await expectServiceError(updateUnit(unit.id, { ...input, rent: 2_500, status: 'occupied' }), 'rent')
    const detail = await getPropertyDetail(unit.propertyId)
    expect(detail?.currentLeases.some((lease) => lease.unitId === unit.id)).toBe(true)
  })
})
