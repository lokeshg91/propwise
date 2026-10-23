import { todayIso } from '@/data/domain/dates'
import { type PropertyScope } from '@/data/domain/finance-summary'
import { incomeExpenseReport, type IncomeExpenseReport, type RecordSource } from '@/data/domain/report-income-expense'
import { noticesFor, resolveReportWindow, type ReportNotices, type ReportRangeSpec, type ReportWindow } from '@/data/domain/report-range'
import { maintenanceReport, type MaintenanceBasis, type MaintenanceReport } from '@/data/domain/report-maintenance'
import { propertyPerformanceReport, type PropertyPerformanceReport } from '@/data/domain/report-property'
import { receivablesReport, type ReceivablesReport } from '@/data/domain/report-receivables'
import { rentCollectionReport, type RentCollectionReport } from '@/data/domain/report-rent-collection'
import { snapshotOf } from '@/data/services/finance-service'
import { simulateLatency } from '@/data/services/simulate-latency'
import { readDatabase, sampleRecordIds, type DemoDatabase } from '@/data/store/demo-store'
import { type PropertyType } from '@/types'

/**
 * Reports (Phase 9): read-only. Each report is a pure function over the same
 * Finance records and rule versions the Finance pages use, for a period,
 * a property type or property, and a record source.
 */

export interface ReportFilters {
  range: ReportRangeSpec
  propertyType: PropertyType | 'all'
  propertyId: string | 'all'
  source: RecordSource
}

export interface ReportMeta {
  filters: ReportFilters
  window: ReportWindow
  notices: ReportNotices
  generatedAt: string
  today: string
  currency: string
  locale: string
  financeStartPeriod: string
  /** Name of the selected property, when one is selected. */
  propertyName: string | null
  /** The selected property doesn't exist (any more). */
  unknownProperty: boolean
}

function scopeFor(db: DemoDatabase, filters: Pick<ReportFilters, 'propertyType' | 'propertyId'>): PropertyScope {
  if (filters.propertyId !== 'all') return new Set([filters.propertyId])
  if (filters.propertyType === 'all') return null
  return new Set(db.properties.filter((property) => property.type === filters.propertyType).map((property) => property.id))
}

function metaFor(db: DemoDatabase, filters: ReportFilters, now: Date): ReportMeta {
  const today = todayIso(now)
  const window = resolveReportWindow(filters.range, today)
  const property = filters.propertyId === 'all' ? null : db.properties.find((entry) => entry.id === filters.propertyId)
  return {
    filters,
    window,
    notices: noticesFor(window, today, db.finance.startPeriod),
    generatedAt: now.toISOString(),
    today,
    currency: db.finance.currency,
    locale: db.finance.locale,
    financeStartPeriod: db.finance.startPeriod,
    propertyName: property?.name ?? null,
    unknownProperty: filters.propertyId !== 'all' && !property,
  }
}

export interface IncomeExpenseResult {
  meta: ReportMeta
  report: IncomeExpenseReport
}

export function buildIncomeExpense(db: DemoDatabase, filters: ReportFilters, now: Date = new Date()): IncomeExpenseResult {
  const meta = metaFor(db, filters, now)
  return { meta, report: incomeExpenseReport(snapshotOf(db), meta.window, scopeFor(db, filters), filters.source) }
}

export function getIncomeExpenseReport(filters: ReportFilters): Promise<IncomeExpenseResult> {
  return simulateLatency(buildIncomeExpense(readDatabase(), filters))
}

export interface RentCollectionFilters extends ReportFilters {
  /** Also count recurring charges (parking, service charges…) besides rent. */
  includeRecurring: boolean
}

export interface RentCollectionResult {
  meta: ReportMeta
  report: RentCollectionReport
}

export function buildRentCollection(db: DemoDatabase, filters: RentCollectionFilters, now: Date = new Date()): RentCollectionResult {
  const meta = metaFor(db, filters, now)
  const report = rentCollectionReport({ ...snapshotOf(db), tenants: db.tenants }, meta.window, scopeFor(db, filters), filters.source, meta.today, {
    includeRecurring: filters.includeRecurring,
  })
  return { meta, report }
}

export function getRentCollectionReport(filters: RentCollectionFilters): Promise<RentCollectionResult> {
  return simulateLatency(buildRentCollection(readDatabase(), filters))
}

/** Properties for the report filters. */
export function getReportProperties(): Promise<Array<{ id: string; name: string; type: PropertyType }>> {
  const properties = readDatabase()
    .properties.map((property) => ({ id: property.id, name: property.name, type: property.type }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return simulateLatency(properties)
}

/* ------------------------------------------------------------- Stage 4 */

const reportSnapshot = (db: DemoDatabase) => ({ ...snapshotOf(db), tenants: db.tenants, serviceRequests: db.serviceRequests, vendors: db.vendors })
/** Request categories stay as ids here; the screen shows their labels. */
const reportOptions = () => {
  const sample = sampleRecordIds().workOrders
  return { categoryLabel: (category: string) => category, isSampleWorkOrder: (id: string) => sample.has(id) }
}

export type ReceivablesFilters = Omit<ReportFilters, 'range'>

export interface ReceivablesResult {
  meta: Omit<ReportMeta, 'window' | 'notices'> & { asOf: string }
  report: ReceivablesReport
}

/** Receivables & Aging: as of today (no period). */
export function buildReceivables(db: DemoDatabase, filters: ReceivablesFilters, now: Date = new Date()): ReceivablesResult {
  const meta = metaFor(db, { ...filters, range: { kind: 'preset', preset: 'this-month' } }, now)
  const { window: _window, notices: _notices, ...rest } = meta
  void _window
  void _notices
  return { meta: { ...rest, asOf: meta.today }, report: receivablesReport(reportSnapshot(db), meta.today, scopeFor(db, filters), filters.source) }
}

export function getReceivablesReport(filters: ReceivablesFilters): Promise<ReceivablesResult> {
  return simulateLatency(buildReceivables(readDatabase(), filters))
}

export interface PropertyPerformanceResult {
  meta: ReportMeta
  report: PropertyPerformanceReport
}

export function buildPropertyPerformance(db: DemoDatabase, filters: ReportFilters, now: Date = new Date()): PropertyPerformanceResult {
  const meta = metaFor(db, filters, now)
  return { meta, report: propertyPerformanceReport(reportSnapshot(db), meta.window, meta.today, scopeFor(db, filters), filters.source, reportOptions()) }
}

export function getPropertyPerformanceReport(filters: ReportFilters): Promise<PropertyPerformanceResult> {
  return simulateLatency(buildPropertyPerformance(readDatabase(), filters))
}

export interface MaintenanceFilters extends ReportFilters {
  basis: MaintenanceBasis
}

export interface MaintenanceResult {
  meta: ReportMeta
  report: MaintenanceReport
}

export function buildMaintenance(db: DemoDatabase, filters: MaintenanceFilters, now: Date = new Date()): MaintenanceResult {
  const meta = metaFor(db, filters, now)
  return { meta, report: maintenanceReport(reportSnapshot(db), meta.window, scopeFor(db, filters), filters.source, filters.basis, reportOptions()) }
}

export function getMaintenanceReport(filters: MaintenanceFilters): Promise<MaintenanceResult> {
  return simulateLatency(buildMaintenance(readDatabase(), filters))
}
