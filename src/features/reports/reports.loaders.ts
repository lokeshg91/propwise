import { type LoaderFunctionArgs } from 'react-router'

import {
  getIncomeExpenseReport,
  getMaintenanceReport,
  getPropertyPerformanceReport,
  getReceivablesReport,
  getRentCollectionReport,
  getReportProperties,
  getSettings,
} from '@/data/services'
import { parseReportFilters } from '@/features/reports/lib/report-filters'

export const INCOME_EXPENSE_VIEWS = ['month', 'income', 'expense'] as const
export type IncomeExpenseView = (typeof INCOME_EXPENSE_VIEWS)[number]
export const RENT_COLLECTION_VIEWS = ['property', 'tenant'] as const
export type RentCollectionView = (typeof RENT_COLLECTION_VIEWS)[number]

const pick = <T extends string>(value: string | null, options: readonly T[]): T => (options as readonly (string | null)[]).includes(value) ? (value as T) : (options[0] as T)

async function common(request: Request) {
  const params = new URL(request.url).searchParams
  const [settings, properties] = await Promise.all([getSettings(), getReportProperties()])
  return { params, properties, parsed: parseReportFilters(params, settings.appSettings.defaultReportRange) }
}

export async function reportsHubLoader() {
  const settings = await getSettings()
  return { defaultRange: settings.appSettings.defaultReportRange }
}

export async function incomeExpenseLoader({ request }: LoaderFunctionArgs) {
  const { params, properties, parsed } = await common(request)
  const result = await getIncomeExpenseReport(parsed.filters)
  return { ...result, properties, invalidCustom: parsed.invalidCustom, view: pick(params.get('view'), INCOME_EXPENSE_VIEWS) }
}

export async function rentCollectionLoader({ request }: LoaderFunctionArgs) {
  const { params, properties, parsed } = await common(request)
  const includeRecurring = params.get('recurring') === '1'
  const result = await getRentCollectionReport({ ...parsed.filters, includeRecurring })
  return { ...result, properties, invalidCustom: parsed.invalidCustom, view: pick(params.get('view'), RENT_COLLECTION_VIEWS), includeRecurring }
}

/* ------------------------------------------------------------- Stage 4 */

export const RECEIVABLES_VIEWS = ['tenant', 'property'] as const
export type ReceivablesView = (typeof RECEIVABLES_VIEWS)[number]
export const MAINTENANCE_VIEWS = ['property', 'payee', 'category'] as const
export type MaintenanceView = (typeof MAINTENANCE_VIEWS)[number]

export async function receivablesLoader({ request }: LoaderFunctionArgs) {
  const { params, properties, parsed } = await common(request)
  const { range: _range, ...filters } = parsed.filters
  void _range
  const result = await getReceivablesReport(filters)
  return { ...result, properties, view: pick(params.get('view'), RECEIVABLES_VIEWS) }
}

export async function propertyPerformanceLoader({ request }: LoaderFunctionArgs) {
  const { properties, parsed } = await common(request)
  const result = await getPropertyPerformanceReport(parsed.filters)
  return { ...result, properties, invalidCustom: parsed.invalidCustom }
}

export async function maintenanceLoader({ request }: LoaderFunctionArgs) {
  const { params, properties, parsed } = await common(request)
  const basis: 'paid' | 'incurred' = params.get('basis') === 'incurred' ? 'incurred' : 'paid'
  const result = await getMaintenanceReport({ ...parsed.filters, basis })
  return { ...result, properties, invalidCustom: parsed.invalidCustom, view: pick(params.get('view'), MAINTENANCE_VIEWS), basis }
}
