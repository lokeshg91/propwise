import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

const TABS = [
  { to: '/finance', label: 'Overview', end: true },
  { to: '/finance/transactions', label: 'Transactions', end: false },
  { to: '/finance/receivables', label: 'Receivables', end: false },
] as const

/** Sub-navigation between the Finance pages (links, so each view has its own URL). */
export function FinanceTabs() {
  return (
    <nav aria-label="Finance sections" className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex h-10 items-stretch gap-5">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px flex items-center border-b-2 px-1 text-label whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
