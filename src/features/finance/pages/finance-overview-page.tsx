import { useLoaderData } from 'react-router'

import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { FINANCE_RANGE_LABELS } from '@/data/domain/finance-labels'
import { CashFlowCard } from '@/features/finance/components/cash-flow-card'
import { CollectionsCard } from '@/features/finance/components/collections-card'
import { FinanceAddActions } from '@/features/finance/components/finance-add-actions'
import { FinanceKpis } from '@/features/finance/components/finance-kpis'
import { FinanceTabs } from '@/features/finance/components/finance-tabs'
import { ExpenseBreakdownCard, PayablesCard, RecentTransactionsCard, UpcomingCard } from '@/features/finance/components/overview-lists'
import { OverviewToolbar } from '@/features/finance/components/overview-toolbar'
import { PropertyFinanceTable } from '@/features/finance/components/property-finance-table'
import { useUrlFilters } from '@/features/finance/hooks/use-url-filters'
import { DEFAULT_OVERVIEW_FILTERS, parseOverviewFilters, type OverviewFilters } from '@/features/finance/lib/finance-filters'
import { type financeOverviewLoader } from '@/features/finance/finance.loaders'
import { formatDate } from '@/lib/format'

const DEFAULTS: OverviewFilters = { ...DEFAULT_OVERVIEW_FILTERS }

export function FinanceOverviewPage() {
  const { overview, properties } = useLoaderData<typeof financeOverviewLoader>()
  const { filters, setFilters } = useUrlFilters(DEFAULTS, parseOverviewFilters)
  const { range } = overview
  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader
        title="Finance"
        description="Income, expenses and balances across your portfolio. Records are local demo data; Propwise doesn’t process payments."
        actions={<FinanceAddActions />}
      />
      <FinanceTabs />
      <OverviewToolbar filters={filters} properties={properties} onChange={setFilters} />
      <p className="-mt-2 text-caption text-muted-foreground">
        {FINANCE_RANGE_LABELS[overview.filters.range]}: {formatDate(range.from)} – {formatDate(range.to)}. Cash basis: money received or paid in the period.
      </p>
      <FinanceKpis totals={overview.totals} previous={overview.previousTotals} receivables={overview.receivables} />
      <div className="grid gap-4 lg:grid-cols-3">
        <CashFlowCard trend={overview.trend} />
        <CollectionsCard totals={overview.totals} receivables={overview.receivables} />
      </div>
      <PropertyFinanceTable rows={overview.properties} />
      <div className="grid gap-4 xl:grid-cols-2">
        <RecentTransactionsCard items={overview.recent} />
        <UpcomingCard items={overview.upcoming} />
        <ExpenseBreakdownCard items={overview.expenseBreakdown} />
        <PayablesCard overview={overview} />
      </div>
      <p className="text-caption text-muted-foreground">The Dashboard shows fixed sample figures, so its totals differ from Finance.</p>
    </PageContainer>
  )
}
