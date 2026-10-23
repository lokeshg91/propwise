import { EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_LABELS } from '@/data/domain/finance-labels'
import { type ChargeStatus, type ExpenseStatus } from '@/data/domain/finance-rules'
import { FINANCE_RANGES, inWindow, resolveRange, type FinanceRange } from '@/data/domain/finance-summary'
import { customRangeErrors } from '@/data/domain/report-range'
import { type TransactionRow } from '@/data/services'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type ExpenseCategory, type IncomeCategory } from '@/types'

export const TRANSACTION_KINDS = ['all', 'income', 'expense'] as const
export type TransactionKind = (typeof TRANSACTION_KINDS)[number]

export const TRANSACTION_STATUS_FILTERS = ['all', 'unpaid', 'overdue', 'partially-paid', 'pending', 'paid', 'void'] as const
export type TransactionStatusFilter = (typeof TRANSACTION_STATUS_FILTERS)[number]

export const STATUS_FILTER_LABELS: Record<TransactionStatusFilter, string> = {
  all: 'All statuses',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  'partially-paid': 'Partially paid',
  pending: 'Pending',
  paid: 'Paid',
  void: 'Void',
}

/** Statuses that make sense for the chosen type (bills are paid in full, so they're never partially paid). */
export function statusFiltersFor(kind: TransactionKind): TransactionStatusFilter[] {
  if (kind === 'expense') return ['all', 'unpaid', 'overdue', 'pending', 'paid', 'void']
  if (kind === 'income') return [...TRANSACTION_STATUS_FILTERS]
  return ['all', 'unpaid', 'overdue', 'paid', 'void']
}

/** Presets, all dates, or a custom range (`from`/`to`, Phase 9). */
export type TransactionRangeFilter = FinanceRange | 'all' | 'custom'
export const TRANSACTION_RANGES: TransactionRangeFilter[] = [...FINANCE_RANGES, 'all']

export interface TransactionFilters extends Record<string, string> {
  q: string
  kind: TransactionKind
  status: TransactionStatusFilter
  category: IncomeCategory | ExpenseCategory | 'all'
  property: string
  range: TransactionRangeFilter
  /** Custom range dates (YYYY-MM-DD, inclusive), only with `range: 'custom'`. */
  from: string
  to: string
  /** `tenant:<id>` or `vendor:<id>`, set by links from tenant and vendor profiles. */
  party: string
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = { q: '', kind: 'all', status: 'all', category: 'all', property: 'all', range: '3m', from: '', to: '', party: 'all' }

const includes = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value)

export function parseTransactionFilters(params: URLSearchParams): TransactionFilters {
  const kind = params.get('kind') ?? ''
  const resolvedKind = includes(TRANSACTION_KINDS, kind) ? kind : 'all'
  const status = params.get('status') ?? ''
  const category = params.get('category') ?? ''
  const range = params.get('range') ?? ''
  const categories = categoriesFor(resolvedKind)
  return {
    q: params.get('q') ?? '',
    kind: resolvedKind,
    status: includes(statusFiltersFor(resolvedKind), status) ? status : 'all',
    category: includes(categories, category) ? category : 'all',
    property: params.get('property') || 'all',
    ...parseRange(range, params.get('from') ?? '', params.get('to') ?? ''),
    party: /^(tenant|vendor):[\w-]+$/.test(params.get('party') ?? '') ? (params.get('party') as string) : 'all',
  }
}

/** A custom range is kept only when valid (a broken URL falls back to the default period). */
function parseRange(range: string, from: string, to: string): Pick<TransactionFilters, 'range' | 'from' | 'to'> {
  if (range === 'custom') {
    const errors = customRangeErrors(from, to)
    if (!errors.from && !errors.to) return { range: 'custom', from, to }
  }
  return { range: includes(TRANSACTION_RANGES, range) ? range : DEFAULT_TRANSACTION_FILTERS.range, from: '', to: '' }
}

/** The dates a range filter covers; null for all dates. */
export function transactionWindow(filters: Pick<TransactionFilters, 'range' | 'from' | 'to'>, today: string): { from: string; to: string } | null {
  if (filters.range === 'all') return null
  if (filters.range === 'custom') return { from: filters.from, to: filters.to }
  return resolveRange(filters.range, today)
}

export function categoriesFor(kind: TransactionKind): Array<IncomeCategory | ExpenseCategory> {
  if (kind === 'income') return [...INCOME_CATEGORIES]
  if (kind === 'expense') return [...EXPENSE_CATEGORIES]
  return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES.filter((category) => !(INCOME_CATEGORIES as readonly string[]).includes(category))]
}

type Categorized = { kind: 'income'; category: IncomeCategory } | { kind: 'expense'; category: ExpenseCategory }
export const categoryLabel = (row: Categorized): string => (row.kind === 'income' ? INCOME_CATEGORY_LABELS[row.category] : EXPENSE_CATEGORY_LABELS[row.category])

export const categoryFilterLabel = (category: IncomeCategory | ExpenseCategory): string =>
  (INCOME_CATEGORY_LABELS as Record<string, string>)[category] ?? (EXPENSE_CATEGORY_LABELS as Record<string, string>)[category] ?? category

export const rowStatus = (row: TransactionRow): ChargeStatus | ExpenseStatus => (row.kind === 'income' ? row.state.status : row.status)

export function matchesStatus(row: TransactionRow, status: TransactionStatusFilter): boolean {
  const current = rowStatus(row)
  switch (status) {
    case 'all':
      return true
    case 'unpaid':
      return row.balanceCents > 0
    default:
      return current === status
  }
}

export function searchTextOf(row: TransactionRow): string {
  const record = row.record
  return [
    row.reference,
    row.party,
    row.propertyName,
    row.unitLabel,
    row.description,
    categoryLabel(row),
    'invoiceNumber' in record ? record.invoiceNumber : '',
    'period' in record ? record.period : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function filterTransactions(rows: readonly TransactionRow[], filters: TransactionFilters, today: string): TransactionRow[] {
  const window = transactionWindow(filters, today)
  const query = filters.q.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (filters.kind === 'all' || row.kind === filters.kind) &&
      (filters.category === 'all' || row.category === filters.category) &&
      (filters.property === 'all' || row.propertyId === filters.property) &&
      (filters.party === 'all' || row.partyKey === filters.party) &&
      (window === null || inWindow(row.date, window)) &&
      matchesStatus(row, filters.status) &&
      (query === '' || searchTextOf(row).includes(query)),
  )
}

export interface TransactionSummary {
  count: number
  incomeCents: number
  expenseCents: number
  unpaidIncomeCents: number
  unpaidExpenseCents: number
}

/** Totals for the filtered list; void records are counted but not added up. */
export function summarizeTransactions(rows: readonly TransactionRow[]): TransactionSummary {
  const summary: TransactionSummary = { count: rows.length, incomeCents: 0, expenseCents: 0, unpaidIncomeCents: 0, unpaidExpenseCents: 0 }
  for (const row of rows) {
    if (rowStatus(row) === 'void') continue
    if (row.kind === 'income') {
      summary.incomeCents += row.amountCents
      summary.unpaidIncomeCents += row.balanceCents
    } else {
      summary.expenseCents += row.amountCents
      summary.unpaidExpenseCents += row.balanceCents
    }
  }
  return summary
}
