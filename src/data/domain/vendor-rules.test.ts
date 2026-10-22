import {
  findVendorConflicts,
  getVendorPerformance,
  isVendorReferenced,
  MIN_JOBS_FOR_RATES,
  normalizeEmail,
  normalizeVendorName,
  phoneKey,
} from '@/data/domain/vendor-rules'
import { type ServiceRequest, type WorkOrder } from '@/types'

describe('vendor name normalisation', () => {
  it.each([
    ['BlueLine Plumbing', 'blueline plumbing'],
    ['  blueline   PLUMBING ', 'blueline plumbing'],
    ['BlueLine Plumbing, LLC', 'blueline plumbing'],
    ['BlueLine Plumbing L.L.C.', 'blueline plumbing'],
    ['BlueLine Plumbing Inc.', 'blueline plumbing'],
    ['SecureLock Co.', 'securelock'],
    ['SecureLock Company', 'securelock'],
    ['The Summit Roofing Corp', 'summit roofing'],
    ['ClearView Glass & Glazing Ltd', 'clearview glass and glazing'],
    ['Café Électrique', 'cafe electrique'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeVendorName(input)).toBe(expected)
  })

  it('keeps a name that is only a suffix word', () => {
    expect(normalizeVendorName('Company')).toBe('company')
  })

  it('compares emails case-insensitively and phones by their last 10 digits', () => {
    expect(normalizeEmail('  Service@BlueLine.Example ')).toBe('service@blueline.example')
    expect(phoneKey('+1 (512) 555-0134')).toBe(phoneKey('512.555.0134'))
  })
})

describe('duplicate detection', () => {
  const vendors = [
    { id: 'a', name: 'BlueLine Plumbing', email: 'service@blueline.example', phone: '(555) 555-0141', active: true },
    { id: 'b', name: 'SecureLock Co.', email: 'service@securelock.example', phone: '(555) 555-0145', active: false },
  ]

  it('blocks the same name or email and identifies the existing vendor', () => {
    const result = findVendorConflicts(vendors, { name: 'blueline plumbing llc', email: 'SERVICE@securelock.example', phone: '(555) 555-0199' })
    expect(result.blocking).toEqual([
      { field: 'name', vendor: { id: 'a', name: 'BlueLine Plumbing', active: true } },
      { field: 'email', vendor: { id: 'b', name: 'SecureLock Co.', active: false } },
    ])
    expect(result.warnings).toEqual([])
  })

  it('only warns for the same phone', () => {
    const result = findVendorConflicts(vendors, { name: 'Lakeside Locksmiths', email: 'x@lakeside.example', phone: '555-555-0145' })
    expect(result.blocking).toEqual([])
    expect(result.warnings).toEqual([{ field: 'phone', vendor: { id: 'b', name: 'SecureLock Co.', active: false } }])
  })

  it('ignores the vendor being edited', () => {
    expect(findVendorConflicts(vendors, vendors[0] as (typeof vendors)[number], 'a')).toEqual({ blocking: [], warnings: [] })
  })
})

describe('vendor performance', () => {
  const order = (overrides: Partial<WorkOrder>): WorkOrder => ({
    id: 'WO-1',
    requestId: 'MR-1',
    vendorId: 'v1',
    status: 'completed',
    scheduledFor: null,
    estimatedCost: 100,
    actualCost: 110,
    notes: '',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    completedAt: '2026-10-02T10:00:00.000Z',
    cancelledAt: null,
    ...overrides,
  })
  const request = (id: string, dueAt: string, reopenCount = 0): Pick<ServiceRequest, 'id' | 'dueAt' | 'reopenCount'> => ({ id, dueAt, reopenCount })

  it('says "not enough data" instead of showing zeros when there are no jobs', () => {
    const result = getVendorPerformance('v1', [], [])
    expect(result).toMatchObject({ open: 0, completed: 0, cancelled: 0, lastJob: null })
    for (const key of ['onTimeRate', 'averageResolutionHours', 'totalSpend', 'costVsEstimate'] as const) {
      expect(result[key]).toEqual({ value: null, basedOn: 0 })
    }
  })

  it('needs a minimum number of jobs before showing rates and averages', () => {
    const result = getVendorPerformance('v1', [order({})], [request('MR-1', '2026-10-05T00:00:00.000Z')])
    expect(result.onTimeRate).toEqual({ value: null, basedOn: 1 })
    expect(result.averageResolutionHours).toEqual({ value: null, basedOn: 1 })
    expect(result.costVsEstimate).toEqual({ value: null, basedOn: 1 })
    // Totals and the last job are meaningful from one job.
    expect(result.totalSpend).toEqual({ value: 110, basedOn: 1 })
    expect(result.lastJob).toMatchObject({ workOrderId: 'WO-1', requestId: 'MR-1' })
    expect(MIN_JOBS_FOR_RATES).toBe(3)
  })

  it('applies the calculation rules', () => {
    const orders = [
      // On time, 24h, cost +10%.
      order({ id: 'WO-1', requestId: 'MR-1' }),
      // Late (due before completion), 48h, no estimate.
      order({ id: 'WO-2', requestId: 'MR-2', completedAt: '2026-10-03T10:00:00.000Z', estimatedCost: null, actualCost: 300 }),
      // On time, 12h, no final cost.
      order({ id: 'WO-3', requestId: 'MR-3', completedAt: '2026-10-01T22:00:00.000Z', actualCost: null }),
      // Reopened request: not eligible for on-time, still counts for time and spend.
      order({ id: 'WO-4', requestId: 'MR-4', completedAt: '2026-10-04T10:00:00.000Z', estimatedCost: 200, actualCost: 180 }),
      // Estimate and actual, on time.
      order({ id: 'WO-5', requestId: 'MR-5', completedAt: '2026-10-01T16:00:00.000Z', estimatedCost: 100, actualCost: 100 }),
      // Open and cancelled jobs.
      order({ id: 'WO-6', requestId: 'MR-6', status: 'in-progress', completedAt: null, actualCost: null }),
      order({ id: 'WO-7', requestId: 'MR-7', status: 'cancelled', completedAt: null, actualCost: null, cancelledAt: '2026-10-02T00:00:00.000Z' }),
      // MR-7 was reassigned to another vendor.
      order({ id: 'WO-8', requestId: 'MR-7', vendorId: 'v2', status: 'scheduled', createdAt: '2026-10-02T00:00:00.000Z', completedAt: null }),
    ]
    const requests = [
      request('MR-1', '2026-10-05T00:00:00.000Z'),
      request('MR-2', '2026-10-02T12:00:00.000Z'),
      request('MR-3', '2026-10-05T00:00:00.000Z'),
      request('MR-4', '2026-10-01T00:00:00.000Z', 1),
      request('MR-5', '2026-10-05T00:00:00.000Z'),
    ]
    const result = getVendorPerformance('v1', orders, requests)
    expect(result).toMatchObject({ open: 1, completed: 5, cancelled: 1, reassignedAway: 1 })
    // 3 of 4 eligible (MR-4 excluded) completed by the target.
    expect(result.onTimeRate).toEqual({ value: 75, basedOn: 4 })
    // (24 + 48 + 12 + 72 + 6) / 5
    expect(result.averageResolutionHours).toEqual({ value: 32.4, basedOn: 5 })
    // Final costs that exist: 110 + 300 + 180 + 100
    expect(result.totalSpend).toEqual({ value: 690, basedOn: 4 })
    // Only jobs with both: actual 110+180+100=390 vs estimate 100+200+100=400 → −2.5%
    expect(result.costVsEstimate).toEqual({ value: -2.5, basedOn: 3 })
    expect(result.lastJob).toMatchObject({ workOrderId: 'WO-4', completedAt: '2026-10-04T10:00:00.000Z' })
  })

  it('knows whether any work order ever referenced the vendor', () => {
    expect(isVendorReferenced('v1', [{ vendorId: 'v2' }])).toBe(false)
    expect(isVendorReferenced('v1', [{ vendorId: 'v1' }])).toBe(true)
  })
})
