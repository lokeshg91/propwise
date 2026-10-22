import { type ServiceRequest, type Vendor, type WorkOrder } from '@/types'

/* ------------------------------------------------------------- duplicates */

/** Legal-form words ignored when comparing names ("BlueLine Plumbing, LLC" = "BlueLine Plumbing"). */
const LEGAL_SUFFIXES = new Set([
  'llc',
  'inc',
  'incorporated',
  'co',
  'company',
  'corp',
  'corporation',
  'ltd',
  'limited',
  'plc',
  'lp',
  'llp',
  'pllc',
  'pc',
])

/**
 * Name used to detect duplicates: trimmed, case-insensitive, accents and
 * punctuation removed, "&" read as "and", a leading "the" and trailing legal
 * suffixes dropped.
 */
export function normalizeVendorName(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    // Dots go first so "L.L.C." reads as "llc" and "Co." as "co".
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  while (words.length > 1 && LEGAL_SUFFIXES.has(words.at(-1) ?? '')) words.pop()
  if (words.length > 1 && words[0] === 'the') words.shift()
  return words.join(' ')
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** Last 10 digits, so "+1 (512) 555-0134" matches "512-555-0134". */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

export interface VendorMatch {
  field: 'name' | 'email' | 'phone'
  vendor: Pick<Vendor, 'id' | 'name' | 'active'>
}

export interface VendorConflicts {
  /** Same name or email: saving is blocked. */
  blocking: VendorMatch[]
  /** Same phone: saving needs explicit confirmation. */
  warnings: VendorMatch[]
}

/** Possible duplicates of `input` among `vendors` (excluding `exceptId`). Vendors are never merged automatically. */
export function findVendorConflicts(
  vendors: Array<Pick<Vendor, 'id' | 'name' | 'email' | 'phone' | 'active'>>,
  input: { name: string; email: string; phone: string },
  exceptId?: string,
): VendorConflicts {
  const name = normalizeVendorName(input.name)
  const email = normalizeEmail(input.email)
  const phone = phoneKey(input.phone)
  const result: VendorConflicts = { blocking: [], warnings: [] }
  for (const vendor of vendors) {
    if (vendor.id === exceptId) continue
    const match = { id: vendor.id, name: vendor.name, active: vendor.active }
    if (name && normalizeVendorName(vendor.name) === name) result.blocking.push({ field: 'name', vendor: match })
    if (email && normalizeEmail(vendor.email) === email) result.blocking.push({ field: 'email', vendor: match })
    if (phone.length >= 10 && phoneKey(vendor.phone) === phone) result.warnings.push({ field: 'phone', vendor: match })
  }
  return result
}

/* ------------------------------------------------------------ performance */

/**
 * Minimum eligible jobs before a rate or average is shown. Below it the UI
 * says "Not enough data" rather than presenting a number from one or two jobs.
 */
export const MIN_JOBS_FOR_RATES = 3

/** A metric value, or null with the number of eligible jobs it was based on. */
export interface Metric<T> {
  value: T | null
  /** Eligible jobs used for the calculation. */
  basedOn: number
}

export interface VendorPerformance {
  /** Scheduled or in-progress work orders. */
  open: number
  completed: number
  /** Cancelled work orders, including ones replaced by a reassignment. */
  cancelled: number
  /** Cancelled because the request was reassigned to another vendor. */
  reassignedAway: number
  /**
   * Completed jobs finished by the request's resolution target ÷ eligible
   * completed jobs (0–100). Eligible: completed, with a completion time, on a
   * request that was never reopened (reopening resets the target).
   */
  onTimeRate: Metric<number>
  /** Average hours from work-order assignment (creation) to completion, over completed jobs. */
  averageResolutionHours: Metric<number>
  /** Sum of the final cost of completed jobs that have one. */
  totalSpend: Metric<number>
  /**
   * Final cost vs estimate in percent ((Σ final − Σ estimate) ÷ Σ estimate),
   * only over completed jobs that have both values (estimate above 0).
   */
  costVsEstimate: Metric<number>
  /** Most recent completed work order. */
  lastJob: { workOrderId: string; requestId: string; completedAt: string } | null
}

const metric = <T,>(value: T | null, basedOn: number, minimum = 1): Metric<T> => ({
  value: basedOn >= minimum ? value : null,
  basedOn,
})

/** Performance for one vendor from its work orders. Pure: pass the vendor's orders and all requests. */
export function getVendorPerformance(
  vendorId: string,
  workOrders: WorkOrder[],
  requests: Array<Pick<ServiceRequest, 'id' | 'dueAt' | 'reopenCount'>>,
): VendorPerformance {
  const mine = workOrders.filter((order) => order.vendorId === vendorId)
  const requestById = new Map(requests.map((request) => [request.id, request]))
  const completed = mine.filter((order) => order.status === 'completed' && order.completedAt)
  const cancelled = mine.filter((order) => order.status === 'cancelled')

  // Reassigned away: a later work order on the same request went to another vendor.
  const reassignedAway = cancelled.filter((order) =>
    workOrders.some(
      (other) => other.requestId === order.requestId && other.id !== order.id && other.vendorId !== vendorId && other.createdAt >= order.createdAt,
    ),
  ).length

  const onTimeEligible = completed.filter((order) => {
    const request = requestById.get(order.requestId)
    return request !== undefined && request.reopenCount === 0
  })
  const onTime = onTimeEligible.filter((order) => (order.completedAt ?? '') <= (requestById.get(order.requestId)?.dueAt ?? ''))

  const durations = completed
    .map((order) => (Date.parse(order.completedAt ?? '') - Date.parse(order.createdAt)) / 3_600_000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0)

  const costed = completed.filter((order) => order.actualCost !== null)
  const compared = completed.filter((order) => order.actualCost !== null && order.estimatedCost !== null && order.estimatedCost > 0)
  const estimateSum = compared.reduce((sum, order) => sum + (order.estimatedCost ?? 0), 0)
  const actualSum = compared.reduce((sum, order) => sum + (order.actualCost ?? 0), 0)

  const last = [...completed].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]

  return {
    open: mine.filter((order) => order.status === 'scheduled' || order.status === 'in-progress').length,
    completed: completed.length,
    cancelled: cancelled.length,
    reassignedAway,
    onTimeRate: metric(onTimeEligible.length ? (onTime.length / onTimeEligible.length) * 100 : null, onTimeEligible.length, MIN_JOBS_FOR_RATES),
    averageResolutionHours: metric(
      durations.length ? durations.reduce((sum, hours) => sum + hours, 0) / durations.length : null,
      durations.length,
      MIN_JOBS_FOR_RATES,
    ),
    totalSpend: metric(costed.reduce((sum, order) => sum + (order.actualCost ?? 0), 0), costed.length),
    costVsEstimate: metric(estimateSum > 0 ? ((actualSum - estimateSum) / estimateSum) * 100 : null, compared.length, MIN_JOBS_FOR_RATES),
    lastJob: last ? { workOrderId: last.id, requestId: last.requestId, completedAt: last.completedAt ?? '' } : null,
  }
}

/** Whether any work order has ever referenced the vendor (any status). Such vendors can't be deleted. */
export function isVendorReferenced(vendorId: string, workOrders: Array<Pick<WorkOrder, 'vendorId'>>): boolean {
  return workOrders.some((order) => order.vendorId === vendorId)
}
