import { addDays, todayIso } from '@/data/domain/dates'
import { expenseStatus } from '@/data/domain/finance-rules'
import { isActiveRequest } from '@/data/domain/maintenance-rules'
import { createFormatters } from '@/lib/formatters'
import { NOTIFICATION_CATEGORIES } from '@/data/domain/account-rules'
import {
  NOTIFICATION_KINDS,
  type Account,
  type NotificationCategory,
  type NotificationKind,
  type StoredNotification,
} from '@/types'

/**
 * Event-based notifications (Phase 10.5). Each one records something that
 * happened in the workspace after the inbox was last checked
 * (`notificationsCheckedAt`: first set when the workspace is created or
 * upgraded, then moved forward by every save). So a fresh or just-upgraded
 * workspace shows exactly the five sample items, and an event is considered
 * once: if its category is off at that moment, it is never notified later.
 *
 * - Write events: a payment recorded, a maintenance request created, a
 *   tenant added (the record's own creation time).
 * - Date events: a request passing its target time, a lease entering its
 *   last 30 days, a bill becoming overdue (the start of the day after its
 *   due date). They are noticed on the next save or page load, if that
 *   moment is within the last 30 days.
 *
 * Ids are derived from the record (and its date), so an event can never be
 * notified twice. Text is written as it reads at the time.
 */

export const NOTIFICATION_LIMITS = {
  /** Event notifications kept; older ones are removed first (sample items always stay). */
  maxStored: 200,
  /** Date events older than this aren't notified any more. */
  windowDays: 30,
  /** A lease is "expiring" this many days before it ends. */
  leaseNoticeDays: 30,
} as const

export const KIND_CATEGORY: Record<NotificationKind, NotificationCategory> = {
  sample: 'system',
  'payment-recorded': 'payment',
  'bill-overdue': 'payment',
  'request-created': 'maintenance',
  'request-overdue': 'maintenance',
  'lease-expiring': 'lease',
  'tenant-added': 'tenant',
}

interface Location {
  name: string
  unit: string | null
}

/** The parts of the workspace notifications read (kept structural so the store can pass its draft). */
export interface NotificationSource {
  properties: Array<{ id: string; name: string }>
  units: Array<{ id: string; number: string; propertyId: string }>
  tenants: Array<{ id: string; name: string; createdAt: string }>
  leases: Array<{ id: string; tenantId: string; unitId: string; endDate: string; status: string }>
  serviceRequests: Array<{ id: string; title: string; status: string; priority: string; propertyId: string; unitId: string | null; dueAt: string; createdAt: string }>
  charges: Array<{ id: string; propertyId: string; leaseId?: string; unitId?: string }>
  payments: Array<{ id: string; chargeId: string; amountCents: number; voidedAt?: string; demo?: true; createdAt: string }>
  expenses: Array<{ id: string; reference: string; propertyId: string; vendorId?: string; payeeName?: string; amountCents: number; dueDate: string; paidOn?: string; voidedAt?: string; demo?: true; createdAt: string }>
  vendors: Array<{ id: string; name: string }>
  finance: { currency: string; locale: string }
  account: Pick<Account, 'notificationPreferences'>
  notifications: StoredNotification[]
  notificationsCheckedAt: string
}

const isoOf = (date: string) => new Date(`${date}T00:00:00`).toISOString()

/**
 * New notifications for events since the last check. Pure: the caller adds
 * them. `created` lists records added by the change being saved: they count
 * as new whatever their timestamp (a service may stamp a record a moment
 * before the save checks the inbox).
 */
export function pendingNotifications(db: NotificationSource, now: Date, sampleIds: ReadonlySet<string> = new Set(), created: ReadonlySet<string> = new Set()): StoredNotification[] {
  const nowIso = now.toISOString()
  const today = todayIso(now)
  const since = db.notificationsCheckedAt
  const windowStart = addDays(today, -NOTIFICATION_LIMITS.windowDays)
  const existing = new Set(db.notifications.map((item) => item.id))
  const prefs = db.account.notificationPreferences
  const format = createFormatters({ currency: db.finance.currency, locale: db.finance.locale })
  const properties = new Map(db.properties.map((property) => [property.id, property.name]))
  const units = new Map(db.units.map((unit) => [unit.id, unit.number]))
  const where = ({ name, unit }: Location) => (unit ? `${name}, Unit ${unit}` : name)
  const place = (propertyId: string, unitId?: string | null): Location => ({ name: properties.get(propertyId) ?? 'a property', unit: unitId ? (units.get(unitId) ?? null) : null })
  const out: StoredNotification[] = []
  const add = (kind: NotificationKind, key: string, createdAt: string, title: string, message: string, link: string | null) => {
    const id = `ntf_${kind}_${key}`
    if (existing.has(id) || !prefs[KIND_CATEGORY[kind]]) return
    existing.add(id)
    out.push({ id, kind, category: KIND_CATEGORY[kind], title, message, createdAt, ageMinutes: null, read: false, link, demo: false })
  }

  // Write events: the record was created since the last check (or by this change).
  const isNew = (record: { id: string; createdAt: string }) => created.has(record.id) || (record.createdAt > since && record.createdAt <= nowIso)
  const charges = new Map(db.charges.map((charge) => [charge.id, charge]))
  const leases = new Map(db.leases.map((lease) => [lease.id, lease]))
  const tenants = new Map(db.tenants.map((tenant) => [tenant.id, tenant]))
  for (const payment of db.payments) {
    if (payment.demo || payment.voidedAt || !isNew(payment)) continue
    const charge = charges.get(payment.chargeId)
    const lease = charge?.leaseId ? leases.get(charge.leaseId) : undefined
    const payer = lease ? tenants.get(lease.tenantId)?.name : undefined
    const location = charge ? where(place(charge.propertyId, lease?.unitId ?? charge.unitId)) : 'a charge'
    add('payment-recorded', payment.id, payment.createdAt, 'Payment recorded', `${payer ? `${payer} paid` : 'Payment of'} ${format.money(payment.amountCents)} for ${location}.`, charge ? `/finance/transactions/${charge.id}` : null)
  }
  for (const request of db.serviceRequests) {
    if (sampleIds.has(request.id) || !isNew(request)) continue
    add('request-created', request.id, request.createdAt, 'New maintenance request', `${request.title} at ${where(place(request.propertyId, request.unitId))}.`, `/maintenance/${request.id}`)
  }
  for (const tenant of db.tenants) {
    if (sampleIds.has(tenant.id) || !isNew(tenant)) continue
    const lease = db.leases.find((entry) => entry.tenantId === tenant.id)
    add('tenant-added', tenant.id, tenant.createdAt, 'New tenant', `${tenant.name} was added${lease ? ` for ${where({ name: propertyOfUnit(db, lease.unitId), unit: units.get(lease.unitId) ?? null })}` : ''}.`, `/tenants/${tenant.id}`)
  }

  // Date events: the moment passed after notifications started, within the window.
  for (const request of db.serviceRequests) {
    if (!isActiveRequest(request as never) || request.dueAt <= since || request.dueAt > nowIso || request.dueAt.slice(0, 10) < windowStart) continue
    add('request-overdue', `${request.id}_${request.dueAt.slice(0, 10)}`, request.dueAt, 'Request overdue', `${request.id}: ${request.title} at ${where(place(request.propertyId, request.unitId))} is past its ${request.priority}-priority target.`, `/maintenance/${request.id}`)
  }
  for (const lease of db.leases) {
    if (lease.status !== 'active' || lease.endDate < today) continue
    const trigger = addDays(lease.endDate, -NOTIFICATION_LIMITS.leaseNoticeDays)
    if (isoOf(trigger) <= since || trigger > today || trigger < windowStart) continue
    const tenant = tenants.get(lease.tenantId)
    add('lease-expiring', `${lease.id}_${lease.endDate}`, isoOf(trigger), 'Lease expiring soon', `The lease for ${where({ name: propertyOfUnit(db, lease.unitId), unit: units.get(lease.unitId) ?? null })}${tenant ? ` (${tenant.name})` : ''} ends on ${format.date(lease.endDate)}.`, `/tenants/${lease.tenantId}`)
  }
  for (const expense of db.expenses) {
    if (expenseStatus(expense, today) !== 'overdue') continue
    const trigger = addDays(expense.dueDate, 1)
    if (isoOf(trigger) <= since || trigger > today || trigger < windowStart) continue
    const payee = expense.vendorId ? (db.vendors.find((vendor) => vendor.id === expense.vendorId)?.name ?? 'A vendor') : (expense.payeeName ?? 'A payee')
    add('bill-overdue', `${expense.id}_${expense.dueDate}`, isoOf(trigger), 'Bill overdue', `${expense.reference} to ${payee} for ${format.money(expense.amountCents)} was due ${format.date(expense.dueDate)}.`, `/finance/transactions/${expense.id}`)
  }
  return out
}

function propertyOfUnit(db: NotificationSource, unitId: string): string {
  const unit = db.units.find((entry) => entry.id === unitId)
  return (unit && db.properties.find((property) => property.id === unit.propertyId)?.name) ?? 'a property'
}

/** Adds new items and keeps storage bounded: sample items stay; event items beyond the limit go oldest first. */
export function mergeNotifications(current: StoredNotification[], added: StoredNotification[]): StoredNotification[] {
  const samples = current.filter((item) => item.kind === 'sample')
  const events = [...current.filter((item) => item.kind !== 'sample'), ...added].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id))
  return [...samples, ...events.slice(0, NOTIFICATION_LIMITS.maxStored)]
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isIso = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const LINK = /^\/[A-Za-z0-9/_?=&%.-]*$/

/** Why one stored item is invalid, or null. Links must be same-app paths. */
function itemProblem(item: unknown): string | null {
  if (!isObject(item) || typeof item.id !== 'string' || !item.id.startsWith('ntf_')) return 'has no valid id'
  if (!(NOTIFICATION_KINDS as readonly unknown[]).includes(item.kind)) return 'has an unknown kind'
  if (!(NOTIFICATION_CATEGORIES as readonly unknown[]).includes(item.category)) return 'has an unknown category'
  if (typeof item.title !== 'string' || typeof item.message !== 'string' || item.title.length > 200 || item.message.length > 500) return 'has invalid text'
  if (typeof item.read !== 'boolean' || typeof item.demo !== 'boolean') return 'has an invalid read state'
  if (item.link !== null && (typeof item.link !== 'string' || item.link.startsWith('//') || !LINK.test(item.link))) return 'has an invalid link'
  if (item.kind === 'sample' ? typeof item.ageMinutes !== 'number' || item.createdAt !== null : !isIso(item.createdAt) || item.ageMinutes !== null) return 'has an invalid time'
  return null
}

/** Everything wrong with stored notifications (backups are refused when any). */
export function notificationProblems(items: unknown, since: unknown): string[] {
  if (!Array.isArray(items)) return ['the notifications are missing']
  if (!isIso(since)) return ['the notifications have no valid start time']
  const problems: string[] = []
  const ids = new Set<string>()
  items.forEach((item, index) => {
    const problem = itemProblem(item)
    if (problem) problems.push(`notification ${index + 1} ${problem}`)
    else if (ids.has((item as StoredNotification).id)) problems.push(`notification ${index + 1} repeats an id`)
    else ids.add((item as StoredNotification).id)
  })
  return problems
}

/** Keeps the valid, first-seen items of stored data (used when loading; nothing is written until the next change). */
export function repairNotifications(items: unknown): StoredNotification[] {
  if (!Array.isArray(items)) return []
  const seen = new Set<string>()
  return items.filter((item): item is StoredNotification => {
    if (itemProblem(item) !== null || seen.has((item as StoredNotification).id)) return false
    seen.add((item as StoredNotification).id)
    return true
  })
}
