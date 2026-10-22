import { ReceiptText, SearchX, X } from 'lucide-react'
import { useMemo } from 'react'
import { useLoaderData } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { todayIso } from '@/data/domain/dates'
import { FINANCE_RANGE_LABELS } from '@/data/domain/finance-labels'
import { FinanceAddActions } from '@/features/finance/components/finance-add-actions'
import { FinanceTabs } from '@/features/finance/components/finance-tabs'
import { TransactionCard } from '@/features/finance/components/transaction-card'
import { useMoney } from '@/features/finance/hooks/use-money'
import { useTransactionColumns } from '@/features/finance/hooks/use-transaction-columns'
import { useUrlFilters } from '@/features/finance/hooks/use-url-filters'
import {
  categoriesFor,
  categoryFilterLabel,
  DEFAULT_TRANSACTION_FILTERS,
  filterTransactions,
  parseTransactionFilters,
  STATUS_FILTER_LABELS,
  statusFiltersFor,
  summarizeTransactions,
  TRANSACTION_RANGES,
  type TransactionFilters,
  type TransactionKind,
} from '@/features/finance/lib/transaction-list'
import { type transactionsLoader } from '@/features/finance/finance.loaders'
import { formatNumber } from '@/lib/format'

const KIND_OPTIONS: Array<{ value: TransactionKind; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
]

const rangeLabel = (range: TransactionFilters['range']) => (range === 'all' ? 'All dates' : FINANCE_RANGE_LABELS[range])

export function TransactionsPage() {
  const { rows, properties } = useLoaderData<typeof transactionsLoader>()
  const { filters, setFilters, clearFilters, hasFilters } = useUrlFilters(DEFAULT_TRANSACTION_FILTERS, parseTransactionFilters)
  const money = useMoney()
  const columns = useTransactionColumns()
  const filtered = useMemo(() => filterTransactions(rows, filters, todayIso()), [rows, filters])
  const summary = useMemo(() => summarizeTransactions(filtered), [filtered])
  const statuses = statusFiltersFor(filters.kind)
  const partyName = filters.party === 'all' ? null : (rows.find((row) => row.partyKey === filters.party)?.party ?? null)
  const categories = categoriesFor(filters.kind)

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader title="Transactions" description="Every income and expense record, with its status. Dates are due dates for income and bill dates for expenses." actions={<FinanceAddActions />} />
      <FinanceTabs />

      <Card className="min-w-0 pb-4">
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-col gap-3 px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <SearchInput
                label="Search transactions"
                placeholder="Reference, tenant, payee, invoice or unit…"
                value={filters.q}
                onValueChange={(q) => setFilters({ q })}
                className="xl:max-w-80 xl:flex-1"
              />
              <SegmentedControl
                label="Type"
                value={filters.kind}
                options={KIND_OPTIONS}
                onValueChange={(kind) => setFilters({ kind, status: 'all', category: 'all' })}
                className="xl:ml-auto"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
              <Select value={filters.status} onValueChange={(status) => setFilters({ status: status as TransactionFilters['status'] })}>
                <SelectTrigger aria-label="Filter by status" className="w-full lg:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_FILTER_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.category} onValueChange={(category) => setFilters({ category: category as TransactionFilters['category'] })}>
                <SelectTrigger aria-label="Filter by category" className="w-full lg:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryFilterLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.property} onValueChange={(property) => setFilters({ property })}>
                <SelectTrigger aria-label="Filter by property" className="w-full lg:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.range} onValueChange={(range) => setFilters({ range: range as TransactionFilters['range'] })}>
                <SelectTrigger aria-label="Filter by date" className="w-full lg:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_RANGES.map((range) => (
                    <SelectItem key={range} value={range}>
                      {rangeLabel(range)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-self-start lg:ml-auto">
                  Reset filters
                </Button>
              ) : null}
            </div>
            {filters.party !== 'all' ? (
              <p className="flex flex-wrap items-center gap-2 text-body text-foreground">
                <span>
                  Showing records for <span className="font-medium">{partyName ?? 'this record'}</span>
                  {partyName === null ? ' (no records found)' : ''}
                </span>
                <Button variant="outline" size="xs" onClick={() => setFilters({ party: 'all' })} aria-label="Show records for everyone">
                  <X data-icon="inline-start" />
                  {filters.party.startsWith('vendor:') ? 'All payees' : 'All payers'}
                </Button>
              </p>
            ) : null}
          </div>

          <dl aria-label="Totals for the filtered records" className="mx-5 grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-caption sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Records</dt>
              <dd className="text-label text-foreground tabular-nums">{formatNumber(summary.count)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Income billed</dt>
              <dd className="text-label text-foreground tabular-nums">{money(summary.incomeCents, { whole: true })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expenses billed</dt>
              <dd className="text-label text-foreground tabular-nums">{money(summary.expenseCents, { whole: true })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Unpaid</dt>
              <dd className="text-label text-foreground tabular-nums">
                {money(summary.unpaidIncomeCents, { whole: true })} in · {money(summary.unpaidExpenseCents, { whole: true })} out
              </dd>
            </div>
          </dl>

          <DataTable
            caption="Transactions. Column headers are sortable."
            data={filtered}
            columns={columns}
            initialSorting={[{ id: 'date', desc: true }]}
            pageSize={20}
            getRowId={(row) => row.id}
            itemLabel="records"
            minWidth="70rem"
            renderMobileRow={(row) => <TransactionCard row={row} />}
            emptyState={
              rows.length === 0 ? (
                <EmptyState size="sm" icon={ReceiptText} title="No financial records yet" description="Rent is posted from leases, and bills are created when work orders are completed." />
              ) : (
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No records match your filters"
                  description={`Nothing for these filters in ${rangeLabel(filters.range).toLowerCase()}. Try a longer period or reset the filters.`}
                  actions={
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Reset filters
                    </Button>
                  }
                />
              )
            }
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
