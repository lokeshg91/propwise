import { NavLink } from 'react-router'

import { POLICY_PAGES } from '@/features/legal/lib/policies'
import { cn } from '@/lib/utils'

/** Links to the three policy pages, for footers and Settings. */
export function PolicyLinks({ className, labels = 'short' }: { className?: string; labels?: 'short' | 'full' }) {
  return (
    <nav aria-label="Legal" className={className}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {POLICY_PAGES.map((page) => (
          <li key={page.id}>
            <NavLink
              to={page.path}
              className={({ isActive }) =>
                cn(
                  'rounded-sm text-caption underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                )
              }
            >
              {labels === 'full' ? page.title : page.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
