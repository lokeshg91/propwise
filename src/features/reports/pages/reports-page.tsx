import { ArrowRight, Building2, HandCoins, Hourglass, Scale, Wrench, type LucideIcon } from 'lucide-react'
import { Link, useLoaderData } from 'react-router'

import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { REPORT_RANGE_LABELS } from '@/data/services'
import { type reportsHubLoader } from '@/features/reports/reports.loaders'
import { cn } from '@/lib/utils'

interface ReportCard {
  title: string
  purpose: string
  basis: string
  icon: LucideIcon
  to?: string
}

const REPORTS: ReportCard[] = [
  { title: 'Income & Expense', purpose: 'Money collected and bills paid by month and category, with billed and incurred alongside.', basis: 'Cash basis', icon: Scale, to: '/reports/income-expense' },
  { title: 'Rent Collection', purpose: 'Rent due in a period: collected, outstanding, paid on time or late, by property and tenant.', basis: 'As of today', icon: HandCoins, to: '/reports/rent-collection' },
  { title: 'Receivables & Aging', purpose: 'Every open balance today in one of six age buckets, including charges not yet due.', basis: 'As of today', icon: Hourglass, to: '/reports/receivables' },
  { title: 'Property performance', purpose: 'Billed, collected, expenses, net cash flow, maintenance and occupancy for each property.', basis: 'Cash basis', icon: Building2, to: '/reports/property-performance' },
  { title: 'Maintenance expenses', purpose: 'Finance maintenance bills by property, vendor or payee, and request category.', basis: 'Bills only', icon: Wrench, to: '/reports/maintenance-expenses' },
]

/** Reports hub. */
export function ReportsPage() {
  const { defaultRange } = useLoaderData<typeof reportsHubLoader>()
  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description={
          <>
            Figures from the same Finance records as the Finance pages. Export any report as CSV, or print it and save as PDF. Reports open with {REPORT_RANGE_LABELS[defaultRange].toLowerCase()};{' '}
            <Link to="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              change the default in Settings
            </Link>
            .
          </>
        }
      />
      <ul aria-label="Reports" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <Badge variant={report.to ? 'secondary' : 'outline'}>{report.to ? report.basis : 'Coming next'}</Badge>
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-h3 text-foreground">{report.title}</h2>
                <p className="text-body text-muted-foreground">{report.purpose}</p>
              </div>
              {report.to ? (
                <span className="mt-auto inline-flex items-center gap-1 text-label text-primary">
                  Open report
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              ) : (
                <span className="mt-auto text-caption text-muted-foreground">Available in the next update.</span>
              )}
            </>
          )
          const className = 'flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5'
          return (
            <li key={report.title}>
              {report.to ? (
                <Link to={report.to} className={cn(className, 'transition-colors outline-none hover:border-primary/50 hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/50')}>
                  {body}
                </Link>
              ) : (
                <div aria-disabled="true" className={cn(className, 'opacity-70')}>
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </PageContainer>
  )
}
