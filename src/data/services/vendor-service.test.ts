import { assignVendor, completeRequest, createServiceRequest, reassignVendor, startWork } from '@/data/services/maintenance-service'
import { isServiceError } from '@/data/services/service-error'
import {
  checkVendorDuplicates,
  createVendor,
  deleteVendor,
  getVendorDetail,
  getVendorList,
  isVendorDuplicateError,
  isVendorOpenJobsError,
  setVendorActive,
  updateVendor,
} from '@/data/services/vendor-service'
import { readDatabase } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { type ServiceRequestInput, type Vendor, type VendorInput } from '@/types'

const db = () => readDatabase()
const vendorById = (id: string) => db().vendors.find((vendor) => vendor.id === id) as Vendor
const vendorByName = (name: string) => db().vendors.find((vendor) => vendor.name === name) as Vendor
const eventsOf = (id: string) => db().vendorEvents.filter((event) => event.vendorId === id)

const input = (overrides: Partial<VendorInput> = {}): VendorInput => ({
  name: '  Harbor   Handyman ',
  company: '',
  categories: ['general'],
  contactName: 'Ana Ruiz',
  phone: '(512) 555-0177',
  email: 'Jobs@Harbor-Handyman.example',
  notes: '',
  active: true,
  ...overrides,
})

const fromVendor = (vendor: Vendor, overrides: Partial<VendorInput> = {}): VendorInput => ({
  name: vendor.name,
  company: vendor.company,
  categories: vendor.categories,
  contactName: vendor.contactName,
  phone: vendor.phone,
  email: vendor.email,
  notes: vendor.notes,
  active: vendor.active,
  ...overrides,
})

const requestInput = (overrides: Partial<ServiceRequestInput> = {}): ServiceRequestInput => ({
  title: 'Leaking faucet',
  description: '',
  category: 'plumbing',
  priority: 'medium',
  propertyId: 'prop_101',
  unitId: null,
  area: 'Lobby',
  tenantId: null,
  source: 'staff',
  permissionToEnter: false,
  accessNotes: '',
  ...overrides,
})

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a rejection')
    },
    (reason: unknown) => reason,
  )
}

describe('creating vendors', () => {
  it('creates a vendor with a generated id, normalised fields and a history entry', async () => {
    const before = db().vendors.length
    const vendor = await createVendor(input())
    expect(vendor).toMatchObject({ name: 'Harbor Handyman', email: 'jobs@harbor-handyman.example', active: true, deactivatedAt: null })
    expect(vendor.id).toMatch(/^ven_/)
    expect(db().vendors).toHaveLength(before + 1)
    expect(eventsOf(vendor.id).map((event) => event.kind)).toEqual(['created'])
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toContain(vendor.id)
  })

  it('validates every field', async () => {
    const cases: Array<[Partial<VendorInput>, string]> = [
      [{ name: 'x' }, 'name'],
      [{ name: 'x'.repeat(81) }, 'name'],
      [{ company: 'x'.repeat(121) }, 'company'],
      [{ contactName: '' }, 'contactName'],
      [{ email: 'not-an-email' }, 'email'],
      [{ phone: '555-01' }, 'phone'],
      [{ phone: 'call me' }, 'phone'],
      [{ categories: [] }, 'categories'],
      [{ notes: 'x'.repeat(1_001) }, 'notes'],
    ]
    for (const [overrides, field] of cases) {
      const error = await rejection(createVendor(input(overrides)))
      expect(isServiceError(error) && error.field).toBe(field)
    }
  })

  it('stores an empty company when it repeats the name, and can add an inactive vendor', async () => {
    const vendor = await createVendor(input({ company: 'Harbor Handyman', active: false }))
    expect(vendor).toMatchObject({ company: '', active: false })
    expect(vendor.deactivatedAt).toBeTruthy()
    expect(eventsOf(vendor.id).map((event) => event.kind).sort()).toEqual(['created', 'deactivated'])
  })
})

describe('duplicate vendors', () => {
  it('blocks the same name (any case, spacing or legal suffix) and identifies the existing vendor', async () => {
    const existing = vendorByName('BlueLine Plumbing')
    for (const name of ['blueline plumbing', '  BlueLine   Plumbing ', 'BlueLine Plumbing, LLC', 'Blueline Plumbing Inc.']) {
      const error = await rejection(createVendor(input({ name })))
      expect(isVendorDuplicateError(error)).toBe(true)
      if (isVendorDuplicateError(error)) {
        expect(error).toMatchObject({ field: 'name', requiresConfirmation: false })
        expect(error.matches[0]?.vendor.id).toBe(existing.id)
      }
    }
  })

  it('blocks the same email regardless of case', async () => {
    const existing = vendorByName('ProClean Facilities')
    const error = await rejection(createVendor(input({ email: existing.email.toUpperCase() })))
    expect(isVendorDuplicateError(error) && error.field).toBe('email')
    expect(isVendorDuplicateError(error) && error.matches[0]?.vendor.id).toBe(existing.id)
  })

  it('warns for the same phone and saves only after confirmation, without merging', async () => {
    const existing = vendorByName('BrightSpark Electric')
    const count = db().vendors.length
    const error = await rejection(createVendor(input({ phone: existing.phone })))
    expect(isVendorDuplicateError(error) && error.requiresConfirmation).toBe(true)
    expect(isVendorDuplicateError(error) && error.matches[0]?.vendor.id).toBe(existing.id)
    expect(db().vendors).toHaveLength(count)

    const created = await createVendor(input({ phone: existing.phone }), { acknowledgePhoneMatch: true })
    expect(db().vendors).toHaveLength(count + 1)
    expect(vendorById(existing.id)).toEqual(existing)
    expect(created.id).not.toBe(existing.id)
  })

  it('checks duplicates ahead of saving, excluding the vendor being edited', async () => {
    const existing = vendorByName('SecureLock Co.')
    const conflicts = await checkVendorDuplicates({ name: existing.name, email: existing.email, phone: existing.phone })
    expect(conflicts.blocking.map((match) => match.field)).toEqual(['name', 'email'])
    // The seeded Lakeside Locksmiths shares SecureLock's phone.
    expect(conflicts.warnings.map((match) => match.vendor.name)).toContain('Lakeside Locksmiths')
    expect((await checkVendorDuplicates(existing, existing.id)).blocking).toEqual([])
  })
})

describe('editing vendors and historical integrity', () => {
  it('records nothing when nothing changed', async () => {
    const vendor = vendorByName('GreenLeaf Landscaping')
    const events = eventsOf(vendor.id).length
    await updateVendor(vendor.id, fromVendor(vendor))
    expect(eventsOf(vendor.id)).toHaveLength(events)
    expect(vendorById(vendor.id).updatedAt).toBe(vendor.updatedAt)
  })

  it('renaming keeps work-order ids and earlier activity untouched', async () => {
    const vendor = vendorByName('BlueLine Plumbing')
    const orders = structuredClone(db().workOrders.filter((order) => order.vendorId === vendor.id))
    const maintenanceEvents = structuredClone(db().maintenanceEvents)
    const vendorEvents = structuredClone(eventsOf(vendor.id))
    expect(orders.length).toBeGreaterThan(0)

    await updateVendor(vendor.id, fromVendor(vendor, { name: 'BlueLine Plumbing & Drains', phone: '(555) 555-0199' }), { acknowledgePhoneMatch: true })

    expect(vendorById(vendor.id).name).toBe('BlueLine Plumbing & Drains')
    expect(db().workOrders.filter((order) => order.vendorId === vendor.id)).toEqual(orders)
    expect(db().maintenanceEvents).toEqual(maintenanceEvents)
    // Earlier vendor events keep the old name; the new one says what changed.
    expect(eventsOf(vendor.id).slice(0, vendorEvents.length)).toEqual(vendorEvents)
    expect(vendorEvents.every((event) => event.vendorName === 'BlueLine Plumbing')).toBe(true)
    const latest = eventsOf(vendor.id).at(-1)
    expect(latest).toMatchObject({ kind: 'updated', vendorName: 'BlueLine Plumbing & Drains', title: 'Renamed to BlueLine Plumbing & Drains' })
    expect(latest?.description).toMatch(/Renamed from BlueLine Plumbing\. Changed: name, phone\./)
    // Detail views show the current name.
    const detail = await getVendorDetail(vendor.id)
    expect(detail?.workOrders.length).toBe(orders.length)
  })

  it('rolls back a failed edit completely', async () => {
    const vendor = vendorByName('Summit Roofing')
    const stored = window.localStorage.getItem(STORAGE_KEYS.demoData)
    await rejection(updateVendor(vendor.id, fromVendor(vendor, { name: 'Summit Roofing 2', email: vendorByName('AquaCare Pools').email })))
    expect(vendorById(vendor.id)).toEqual(vendor)
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toBe(stored)
  })
})

describe('deactivation, reactivation and assignment', () => {
  it('needs confirmation to deactivate a vendor with open jobs, listing them', async () => {
    const vendor = db().vendors.find((entry) =>
      db().workOrders.some((order) => order.vendorId === entry.id && (order.status === 'scheduled' || order.status === 'in-progress')),
    ) as Vendor
    const open = db().workOrders.filter((order) => order.vendorId === vendor.id && (order.status === 'scheduled' || order.status === 'in-progress'))
    const error = await rejection(setVendorActive(vendor.id, false))
    expect(isVendorOpenJobsError(error)).toBe(true)
    if (isVendorOpenJobsError(error)) expect(error.openWorkOrders.map((entry) => entry.order.id).sort()).toEqual(open.map((order) => order.id).sort())
    expect(vendorById(vendor.id).active).toBe(true)

    // Through the edit form too.
    expect(isVendorOpenJobsError(await rejection(updateVendor(vendor.id, fromVendor(vendor, { active: false }))))).toBe(true)

    await setVendorActive(vendor.id, false, { confirmOpenJobs: true, note: 'Contract ended' })
    expect(vendorById(vendor.id)).toMatchObject({ active: false })
    expect(vendorById(vendor.id).deactivatedAt).toBeTruthy()
    // Work orders are untouched.
    for (const order of open) expect(db().workOrders.find((entry) => entry.id === order.id)).toEqual(order)
  })

  it('blocks new work orders for inactive vendors, but existing jobs can be completed or reassigned', async () => {
    const vendor = vendorByName('Evergreen Pest Control')
    const first = await createServiceRequest(requestInput({ category: 'pest' }), { assign: { vendorId: vendor.id, scheduledFor: null, estimatedCost: 120, notes: '' } })
    const second = await createServiceRequest(requestInput({ category: 'pest', title: 'Second job' }), {
      assign: { vendorId: vendor.id, scheduledFor: null, estimatedCost: 90, notes: '' },
    })
    await setVendorActive(vendor.id, false, { confirmOpenJobs: true })

    const third = await createServiceRequest(requestInput({ category: 'pest', title: 'Third job' }))
    const assign = await rejection(assignVendor(third.id, { vendorId: vendor.id, scheduledFor: null, estimatedCost: null, notes: '' }))
    expect(isServiceError(assign) && assign.message).toMatch(/inactive/)
    const reassignTo = await rejection(reassignVendor(first.id, { vendorId: vendor.id, scheduledFor: null, estimatedCost: null, notes: '' }, ''))
    expect(isServiceError(reassignTo)).toBe(true)

    // The existing job can still be worked and completed…
    await startWork(first.id)
    await completeRequest(first.id, { completedOn: new Date().toISOString().slice(0, 10), actualCost: 130, notes: '', returnUnitToVacant: false })
    // …and the other one reassigned away to an active vendor.
    const other = db().vendors.find((entry) => entry.active && entry.id !== vendor.id) as Vendor
    await reassignVendor(second.id, { vendorId: other.id, scheduledFor: null, estimatedCost: 90, notes: '' }, 'Vendor inactive')

    const detail = await getVendorDetail(vendor.id)
    const replaced = detail?.workOrders.find((entry) => entry.order.requestId === second.id)
    expect(replaced?.order.status).toBe('cancelled')
    expect(replaced?.replacedBy).toMatchObject({ vendorId: other.id, vendorName: other.name })
    expect(detail?.workOrders.find((entry) => entry.order.requestId === first.id)?.order).toMatchObject({ status: 'completed', actualCost: 130 })
  })

  it('keeps the earlier deactivation in history when reactivating', async () => {
    const vendor = vendorByName('Rapid Rooter Drains')
    const before = eventsOf(vendor.id)
    expect(before.some((event) => event.kind === 'deactivated')).toBe(true)
    await setVendorActive(vendor.id, true, { note: 'Back under a new contract' })
    expect(vendorById(vendor.id)).toMatchObject({ active: true, deactivatedAt: null })
    expect(eventsOf(vendor.id).slice(0, before.length)).toEqual(before)
    expect(eventsOf(vendor.id).at(-1)).toMatchObject({ kind: 'reactivated', description: 'Back under a new contract' })
    // Can be assigned again.
    const request = await createServiceRequest(requestInput())
    await expect(assignVendor(request.id, { vendorId: vendor.id, scheduledFor: null, estimatedCost: null, notes: '' })).resolves.toMatchObject({ vendorId: vendor.id })

    await expect(setVendorActive(vendor.id, true)).rejects.toThrow(/already active/)
  })
})

describe('deleting vendors', () => {
  it('deletes a vendor no work order ever referenced, with its history', async () => {
    const vendor = vendorByName('Northstar Painting Co.')
    expect((await getVendorDetail(vendor.id))?.canDelete).toBe(true)
    await deleteVendor(vendor.id)
    expect(db().vendors.some((entry) => entry.id === vendor.id)).toBe(false)
    expect(eventsOf(vendor.id)).toEqual([])
  })

  it('refuses vendors referenced by any work order, including cancelled ones', async () => {
    const used = db().vendors.find((vendor) => db().workOrders.some((order) => order.vendorId === vendor.id)) as Vendor
    expect((await getVendorDetail(used.id))?.canDelete).toBe(false)
    await expect(deleteVendor(used.id)).rejects.toThrow(/Deactivate the vendor instead/)

    // A vendor whose only work order was cancelled by a reassignment.
    const fresh = await createVendor(input())
    const request = await createServiceRequest(requestInput({ category: 'general' }), { assign: { vendorId: fresh.id, scheduledFor: null, estimatedCost: null, notes: '' } })
    const other = vendorByName('Propwise In-house Team')
    await reassignVendor(request.id, { vendorId: other.id, scheduledFor: null, estimatedCost: null, notes: '' }, '')
    expect(db().workOrders.filter((order) => order.vendorId === fresh.id).map((order) => order.status)).toEqual(['cancelled'])
    await expect(deleteVendor(fresh.id)).rejects.toThrow(/can’t be deleted/)
    expect(vendorById(fresh.id)).toBeDefined()
  })
})

describe('vendor reads', () => {
  it('lists every vendor with performance, and returns null for unknown ids', async () => {
    const list = await getVendorList()
    expect(list).toHaveLength(18)
    const proclean = list.find((item) => item.vendor.name === 'ProClean Facilities')
    expect(proclean?.performance.completed).toBeGreaterThan(0)
    const northstar = list.find((item) => item.vendor.name === 'Northstar Painting Co.')
    expect(northstar?.performance).toMatchObject({ open: 0, completed: 0, lastJob: null, onTimeRate: { value: null, basedOn: 0 } })
    expect(await getVendorDetail('ven_missing')).toBeNull()
  })
})
