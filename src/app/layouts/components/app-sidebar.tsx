import { Link } from 'react-router'

import { SidebarNav } from '@/app/layouts/components/sidebar-nav'
import { BrandLogo } from '@/components/shared/brand-logo'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  collapsed: boolean
  unreadCount: number
}

/** Fixed desktop sidebar (≥1024px). Smaller screens use `MobileNav`. */
export function AppSidebar({ collapsed, unreadCount }: AppSidebarProps) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <div
        className={cn(
          'flex h-header shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        <Link
          to="/dashboard"
          aria-label="Propwise overview"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40"
        >
          <BrandLogo compact={collapsed} />
        </Link>
      </div>

      <div
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden py-5',
          collapsed ? 'px-2' : 'px-3',
        )}
      >
        <SidebarNav collapsed={collapsed} unreadCount={unreadCount} />
      </div>
    </aside>
  )
}
