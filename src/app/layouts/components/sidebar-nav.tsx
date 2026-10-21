import { NavLink, useMatch } from 'react-router'

import { NAV_SECTIONS, type NavItem } from '@/app/routes/navigation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarNavProps {
  collapsed?: boolean
  /** Unread notification count shown next to "Notifications". */
  unreadCount?: number
  onNavigate?: () => void
}

export function SidebarNav({ collapsed = false, unreadCount = 0, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-6">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.label} className="flex flex-col gap-1">
          {collapsed ? (
            index > 0 ? (
              <div className="mx-auto mb-1 h-px w-6 bg-sidebar-border" aria-hidden="true" />
            ) : null
          ) : (
            <p className="px-3 pb-1 text-caption font-semibold tracking-wider text-sidebar-muted-foreground uppercase">
              {section.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.path}>
                <SidebarNavLink
                  item={item}
                  collapsed={collapsed}
                  count={item.path === '/notifications' ? unreadCount : 0}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

interface SidebarNavLinkProps {
  item: NavItem
  collapsed: boolean
  count: number
  onNavigate?: () => void
}

function SidebarNavLink({ item, collapsed, count, onNavigate }: SidebarNavLinkProps) {
  const Icon = item.icon
  const accessibleCount = count > 0 ? `, ${count} unread` : ''
  // Computed here (not via NavLink's render props) because Radix `asChild`
  // triggers merge `className` as a string and cannot pass functions through.
  const isActive = useMatch({ path: item.path, end: false }) !== null

  const link = (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      aria-label={collapsed ? `${item.label}${accessibleCount}` : undefined}
      className={cn(
        'group/nav relative flex h-9 items-center gap-3 rounded-lg px-3 text-body font-medium text-sidebar-foreground transition-colors duration-150 outline-none',
        'hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/40',
        isActive &&
          'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed && 'mx-auto w-10 justify-center px-0',
      )}
    >
      <span className="relative flex">
        <Icon
          aria-hidden="true"
          className={cn(
            'size-[1.125rem] shrink-0 text-sidebar-muted-foreground transition-colors group-hover/nav:text-foreground',
            isActive && 'text-sidebar-primary group-hover/nav:text-sidebar-primary',
          )}
        />
        {collapsed && count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 size-2 rounded-full bg-primary ring-2 ring-sidebar"
          />
        ) : null}
      </span>
      {collapsed ? null : (
        <>
          <span className="truncate">{item.label}</span>
          {count > 0 ? (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-semibold text-primary-foreground tabular-nums">
              {count}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}
