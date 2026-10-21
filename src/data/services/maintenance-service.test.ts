import { addDays, todayIso } from '@/data/domain/dates'
import { isCurrentLease } from '@/data/domain/lease-rules'
import { SLA_HOURS } from '@/data/domain/maintenance-rules'
import {
  assignVendor,
  cancelRequest,
  completeRequest,
  createServiceRequest,
  getRequestFormOptions,
  getServiceRequestDetail,
  holdRequest,
  reassignVendor,
  reopenRequest,
  rescheduleWorkOrder,
  resumeRequest,
  startWork,
  updateServiceRequest,
} from '@/data/services/maintenance-service'
import { isServiceError } from '@/data/services/service-error'
import { createTenant } from '@/data/services/tenant-service'
import { readDatabase, resetDemoData, updateDatabase } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { type ServiceRequestInput, type Unit, type WorkOrderInput } from '@/types'

const today = todayIso()

const db = () => readDatabase()
const unitById = (id: string) => db().units.find((unit) => unit.id === id) as Unit
const propertyOf = (unit: Unit) => db().properties.find((property) => property.id === unit.propertyId)
const requestById = (id: string) => db().serviceRequests.find((request) => request.id === id)
const ordersOf = (id: string) => db().workOrders.filter((order) => order.requestId === id)
const eventsOf = (id: string) => db().maintenanceEvents.filter((event) => event.requestId === id).map((event) => event.kind)

/** A vacant unit with no lease holding it and no request taking it offline. */
function freeVacantUnit(skip = 0): Unit {
  const data = db()
  const unit = data.units.filter(
    (entry) => entry.status === 'vacant' && !data.leases.some((lease) => lease.unitId === entry.id && isCurrentLease(lease)),
  )[skip]
  if (!unit) throw new Error('no free unit')
  return unit
}
const occupiedUnit = () => db().units.find((unit) => unit.status === 'occupied') as Unit
const reservedUnit = () => {
  const lease = db().leases.find((entry) => entry.status === 'pending')
  return unitById(lease?.unitId ?? '')
}
const activeVendor = (category = 'plumbing') =>
  db().vendors.find((vendor) => vendor.active && vendor.categories.includes(category as never)) ?? db().vendors[0]
const inactiveVendor = () => db().vendors.find((vendor) => !vendor.active)

function input(unit: Unit | null, overrides: Partial<ServiceRequestInput> = {}): ServiceRequestInput {
  const propertyId = unit?.propertyId ?? db().properties[0]?.id ?? ''
  return {
    title: '  Leaking kitchen faucet ',
    description: 'Drips constantly.',
    category: 'plumbing',
    priority: 'medium',
    propertyId,
    unitId: unit?.id ?? null,
    area: unit ? null : 'Lobby',
    tenantId: null,
    source: 'staff',
    permissionToEnter: true,
    accessNotes: '',
    ...overrides,
  }
}

const order = (overrides: Partial<WorkOrderInput> = {}): WorkOrderInput => ({
  vendorId: activeVendor()?.id ?? '',
  scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
  estimatedCost: 250,
  notes: '',
  ...overrides,
})

async function expectServiceError(promise: Promise<unknown>, field?: string, message?: RegExp) {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  expect(isServiceError(error)).toBe(true)
  if (isServiceError(error)) {
    if (field) expect(error.field).toBe(field)
    if (message) expect(error.message).toMatch(message)
  }
}

describe('creating requests', () => {
  it('creates a request with the next number, SLA and history, and persists it', async () => {
    const unit = freeVacantUnit()
    const request = await createServiceRequest(input(unit))
    expect(request).toMatchObject({ id: 'MR-2062', title: 'Leaking kitchen faucet', status: 'open', unitTakenOffline: false })
    expect(Date.parse(request.dueAt) - Date.parse(request.createdAt)).toBe(SLA_HOURS.medium * 3_600_000)
    expect(eventsOf(request.id)).toEqual(['created'])
    expect(unitById(unit.id).status).toBe('vacant')
    expect((await createServiceRequest(input(null))).id).toBe('MR-2063')
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toContain('"MR-2063"')
  })

  it('validates location and reporter', async () => {
    const unit = occupiedUnit()
    const other = db().units.find((entry) => entry.propertyId !== unit.propertyId) as Unit
    await expectServiceError(createServiceRequest(input(unit, { title: 'x' })), 'title')
    await expectServiceError(createServiceRequest(input(null, { area: '' })), 'area')
    await expectServiceError(createServiceRequest(input(unit, { unitId: other.id })), 'unitId')
    await expectServiceError(createServiceRequest(input(unit, { source: 'tenant' })), 'tenantId')
    const stranger = db().tenants.find((tenant) => !db().leases.some((lease) => lease.tenantId === tenant.id && lease.unitId === unit.id))
    await expectServiceError(createServiceRequest(input(unit, { tenantId: stranger?.id ?? null })), 'tenantId')

    const lease = db().leases.find((entry) => entry.unitId === unit.id && entry.status === 'active')
    const created = await createServiceRequest(input(unit, { source: 'tenant', tenantId: lease?.tenantId ?? null }))
    expect(created.tenantId).toBe(lease?.tenantId)
  })

  it('can assign a vendor in the same step', async () => {
    const request = await createServiceRequest(input(null), { assign: order() })
    expect(request.status).toBe('scheduled')
    expect(ordersOf(request.id)).toHaveLength(1)
    expect(eventsOf(request.id)).toEqual(['created', 'assigned'])
  })
})

describe('unit status protection', () => {
  it('takes only a vacant unit offline and keeps property totals in sync', async () => {
    const unit = freeVacantUnit()
    const before = propertyOf(unit)?.maintenanceUnits ?? 0
    const request = await createServiceRequest(input(unit), { takeUnitOffline: true })
    expect(request.unitTakenOffline).toBe(true)
    expect(unitById(unit.id).status).toBe('maintenance')
    expect(propertyOf(unit)?.maintenanceUnits).toBe(before + 1)
    expect(eventsOf(request.id)).toContain('unit-offline')
  })

  it('never changes occupied or reserved units, and rolls back the whole request', async () => {
    const count = db().serviceRequests.length
    const stored = window.localStorage.getItem(STORAGE_KEYS.demoData)
    for (const unit of [occupiedUnit(), reservedUnit()]) {
      const status = unit.status
      await expectServiceError(createServiceRequest(input(unit), { takeUnitOffline: true }), 'takeUnitOffline')
      expect(unitById(unit.id).status).toBe(status)
    }
    expect(db().serviceRequests).toHaveLength(count)
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toBe(stored)
  })

  it('a unit under maintenance can’t be leased', async () => {
    const unit = freeVacantUnit()
    await createServiceRequest(input(unit), { takeUnitOffline: true })
    const tenant = {
      kind: 'individual' as const,
      name: 'Test Tenant',
      email: 'test.tenant@example.com',
      phone: '(512) 555-0100',
      mailingAddress: { street: '1 Test St', city: 'Austin', state: 'TX', postalCode: '78701' },
      emergencyContact: null,
      notes: '',
      lease: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        startDate: addDays(today, -1),
        endDate: addDays(today, 364),
        monthlyRent: 1_500,
        securityDeposit: 1_500,
        paymentDueDay: 1,
        status: 'active' as const,
      },
    }
    await expectServiceError(createTenant(tenant), 'unitId', /under maintenance/)
  })

  it('returns the unit to vacant only when asked on completion', async () => {
    const unit = freeVacantUnit()
    const request = await createServiceRequest(input(unit), { takeUnitOffline: true, assign: order() })
    expect((await getServiceRequestDetail(request.id))?.unitReturn).toMatchObject({ applicable: true, allowed: true })
    await completeRequest(request.id, { completedOn: today, actualCost: 240, notes: 'Done', returnUnitToVacant: true })
    expect(unitById(unit.id).status).toBe('vacant')
    expect(eventsOf(request.id).slice(-2)).toEqual(['completed', 'unit-returned'])
  })

  it('keeps the unit status when the user declines', async () => {
    const unit = freeVacantUnit()
    const request = await createServiceRequest(input(unit), { takeUnitOffline: true, assign: order() })
    await cancelRequest(request.id, { reason: 'Owner deferred the work.', returnUnitToVacant: false })
    expect(unitById(unit.id).status).toBe('maintenance')
    expect(requestById(request.id)?.status).toBe('cancelled')
  })

  it('won’t return a unit another open request still needs offline', async () => {
    const unit = freeVacantUnit()
    const first = await createServiceRequest(input(unit), { takeUnitOffline: true, assign: order() })
    // A second request on the same unit that also needs it offline.
    const second = await createServiceRequest(input(unit, { title: 'Replace flooring' }))
    updateDatabase((draft) => {
      const entry = draft.serviceRequests.find((request) => request.id === second.id)
      if (entry) entry.unitTakenOffline = true
    })
    expect((await getServiceRequestDetail(first.id))?.unitReturn.allowed).toBe(false)
    await expectServiceError(
      completeRequest(first.id, { completedOn: today, actualCost: null, notes: '', returnUnitToVacant: true }),
      'returnUnitToVacant',
    )
    // Atomic: the completion was rolled back with it.
    expect(requestById(first.id)?.status).toBe('scheduled')
    expect(unitById(unit.id).status).toBe('maintenance')
  })

  it('explains which units can’t be taken offline in the form options', async () => {
    const options = await getRequestFormOptions()
    const units = options.properties.flatMap((property) => property.units)
    expect(units.find((unit) => unit.id === occupiedUnit().id)?.offlineBlockedReason).toMatch(/occupied/)
    expect(units.find((unit) => unit.id === reservedUnit().id)?.offlineBlockedReason).toMatch(/pending lease/)
    expect(units.find((unit) => unit.id === freeVacantUnit().id)?.offlineBlockedReason).toBeNull()
  })
})

describe('work orders and vendors', () => {
  it('allows only one active work order and rejects inactive vendors', async () => {
    const request = await createServiceRequest(input(null))
    await expectServiceError(assignVendor(request.id, order({ vendorId: inactiveVendor()?.id ?? '' })), 'vendorId', /inactive/)
    await assignVendor(request.id, order())
    await expectServiceError(assignVendor(request.id, order()), undefined, /Reassign/)
    expect(ordersOf(request.id)).toHaveLength(1)
  })

  it('keeps the previous work order when reassigning and records it', async () => {
    const request = await createServiceRequest(input(null))
    const first = await assignVendor(request.id, order())
    await startWork(request.id)
    const next = db().vendors.find((vendor) => vendor.active && vendor.id !== first.vendorId)
    await expectServiceError(reassignVendor(request.id, order({ vendorId: first.vendorId }), ''), 'vendorId')
    await expectServiceError(reassignVendor(request.id, order({ vendorId: inactiveVendor()?.id ?? '' }), ''), 'vendorId')
    const second = await reassignVendor(request.id, order({ vendorId: next?.id ?? '' }), 'Vendor unavailable')

    const orders = ordersOf(request.id)
    expect(orders).toHaveLength(2)
    expect(orders.find((entry) => entry.id === first.id)).toMatchObject({ status: 'cancelled', vendorId: first.vendorId })
    expect(second).toMatchObject({ id: `WO-${request.id.slice(3)}-2`, status: 'scheduled' })
    expect(requestById(request.id)?.status).toBe('scheduled')
    expect(eventsOf(request.id)).toContain('reassigned')
    const detail = await getServiceRequestDetail(request.id)
    expect(detail?.workOrders.map((entry) => entry.status)).toEqual(['scheduled', 'cancelled'])
  })

  it('keeps cost and completion date on completed work orders, and shows vendors that became inactive', async () => {
    const vendor = activeVendor()
    const request = await createServiceRequest(input(null), { assign: order({ vendorId: vendor?.id }) })
    await completeRequest(request.id, { completedOn: today, actualCost: 315, notes: 'Replaced cartridge', returnUnitToVacant: false })
    updateDatabase((draft) => {
      const entry = draft.vendors.find((item) => item.id === vendor?.id)
      if (entry) entry.active = false
    })
    const detail = await getServiceRequestDetail(request.id)
    expect(detail?.workOrders[0]).toMatchObject({ status: 'completed', actualCost: 315, notes: 'Replaced cartridge' })
    expect(detail?.workOrders[0]?.completedAt).toBeTruthy()
    expect(detail?.workOrders[0]?.vendor).toMatchObject({ name: vendor?.name, active: false })
    expect(detail?.vendor?.name).toBe(vendor?.name)
  })

  it('reschedules the active work order', async () => {
    const request = await createServiceRequest(input(null), { assign: order() })
    const when = new Date(Date.now() + 3 * 86_400_000).toISOString()
    await rescheduleWorkOrder(request.id, when)
    expect(ordersOf(request.id)[0]?.scheduledFor).toBe(when)
    expect(eventsOf(request.id)).toContain('rescheduled')
  })
})

describe('request lifecycle (validated by the service)', () => {
  it('rejects transitions that aren’t allowed from the current status', async () => {
    const request = await createServiceRequest(input(null))
    await expectServiceError(startWork(request.id), undefined, /Assign a vendor first/)
    await expectServiceError(holdRequest(request.id, 'parts', ''), undefined)
    await expectServiceError(completeRequest(request.id, { completedOn: today, actualCost: null, notes: '', returnUnitToVacant: false }))
    await expectServiceError(reopenRequest(request.id, 'Came back'))
    await expectServiceError(resumeRequest(request.id))
  })

  it('moves through hold and resume back to the previous status', async () => {
    const request = await createServiceRequest(input(null), { assign: order() })
    await startWork(request.id)
    await holdRequest(request.id, 'parts', 'Waiting for a valve')
    expect(requestById(request.id)).toMatchObject({ status: 'on-hold', hold: { reason: 'parts', from: 'in-progress' } })
    await resumeRequest(request.id)
    expect(requestById(request.id)).toMatchObject({ status: 'in-progress', hold: null })
  })

  it('treats cancelled as final: no reopen, no edits, no actions', async () => {
    const request = await createServiceRequest(input(null), { assign: order() })
    await cancelRequest(request.id, { reason: 'Duplicate request', returnUnitToVacant: false })
    expect(ordersOf(request.id)[0]?.status).toBe('cancelled')
    await expectServiceError(reopenRequest(request.id, 'Try again'), undefined, /Cancelled/)
    await expectServiceError(assignVendor(request.id, order()), undefined, /Cancelled/)
    await expectServiceError(updateServiceRequest(request.id, input(null, { title: 'New title' })))
    expect((await getServiceRequestDetail(request.id))?.actions).toEqual([])
  })

  it('reopens a completed request within 30 days only', async () => {
    const request = await createServiceRequest(input(null), { assign: order() })
    await completeRequest(request.id, { completedOn: today, actualCost: 100, notes: '', returnUnitToVacant: false })
    await reopenRequest(request.id, 'Leak came back')
    expect(requestById(request.id)).toMatchObject({ status: 'open', reopenCount: 1, completedAt: null })
    // The completed work order stays completed.
    expect(ordersOf(request.id)[0]).toMatchObject({ status: 'completed', actualCost: 100 })

    const old = await createServiceRequest(input(null), { assign: order() })
    await completeRequest(old.id, { completedOn: today, actualCost: 100, notes: '', returnUnitToVacant: false })
    updateDatabase((draft) => {
      const entry = draft.serviceRequests.find((item) => item.id === old.id)
      if (entry) entry.completedAt = new Date(Date.now() - 31 * 86_400_000).toISOString()
    })
    await expectServiceError(reopenRequest(old.id, 'Too late'), undefined, /within 30 days/)
  })

  it('validates completion input', async () => {
    const request = await createServiceRequest(input(null), { assign: order() })
    await expectServiceError(completeRequest(request.id, { completedOn: addDays(today, 1), actualCost: null, notes: '', returnUnitToVacant: false }), 'completedOn')
    await expectServiceError(completeRequest(request.id, { completedOn: today, actualCost: -5, notes: '', returnUnitToVacant: false }), 'actualCost')
    await expectServiceError(cancelRequest(request.id, { reason: '', returnUnitToVacant: false }), 'reason')
    expect(requestById(request.id)?.status).toBe('scheduled')
  })
})

describe('editing requests', () => {
  it('recomputes the due time when priority changes and records it', async () => {
    const request = await createServiceRequest(input(null))
    await updateServiceRequest(request.id, input(null, { priority: 'urgent' }))
    const updated = requestById(request.id)
    expect(Date.parse(updated?.dueAt ?? '') - Date.parse(request.createdAt)).toBe(SLA_HOURS.urgent * 3_600_000)
    expect(eventsOf(request.id)).toEqual(['created', 'priority-changed', 'updated'])
  })

  it('locks the location once a vendor is assigned', async () => {
    const request = await createServiceRequest(input(null), { assign: order() })
    await expectServiceError(updateServiceRequest(request.id, input(null, { area: 'Garage' })), 'unitId')
    await updateServiceRequest(request.id, input(null, { title: 'Faucet replaced' }))
    expect(requestById(request.id)?.title).toBe('Faucet replaced')
  })

  it('records nothing when nothing changed', async () => {
    const request = await createServiceRequest(input(null))
    await updateServiceRequest(request.id, input(null))
    expect(eventsOf(request.id)).toEqual(['created'])
  })
})

describe('seeded data and reloads', () => {
  it('keeps app-created requests and numbering across a reload', async () => {
    await createServiceRequest(input(null))
    const raw = window.localStorage.getItem(STORAGE_KEYS.demoData) ?? ''
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    expect(requestById('MR-2062')).toBeDefined()
    expect((await createServiceRequest(input(null))).id).toBe('MR-2063')
  })
})
