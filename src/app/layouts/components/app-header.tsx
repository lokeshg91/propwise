import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { HeaderBreadcrumbs } from '@/app/layouts/components/header-breadcrumbs'
import { HeaderSearch } from '@/app/layouts/components/header-search'
import { NotificationsMenu } from '@/app/layouts/components/notifications-menu'
import { UserMenu } from '@/app/layouts/components/user-menu'
import { type RouteHandle } from '@/app/routes/route-handle'
import { IconButton } from '@/components/shared/icon-button'
import { ThemeSwitcher } from '@/components/shared/theme-switcher'
import { Separator } from '@/components/ui/separator'
import { type AppNotification, type User } from '@/types'

interface AppHeaderProps {
  handle: RouteHandle | undefined
  user: User
  notifications: AppNotification[]
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileNav: () => void
  onMarkAllRead: () => void
}

export function AppHeader({
  handle,
  user,
  notifications,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
  onMarkAllRead,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-header shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70 sm:gap-3 sm:px-6 lg:px-8">
      <IconButton label="Open navigation" className="-ml-1.5 lg:hidden" onClick={onOpenMobileNav}>
        <Menu />
      </IconButton>
      <IconButton
        label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!sidebarCollapsed}
        className="-ml-2 hidden lg:inline-flex"
        onClick={onToggleSidebar}
      >
        {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </IconButton>
      <Separator orientation="vertical" className="hidden h-5 data-vertical:self-center sm:block" />

      <div className="min-w-0 flex-1">
        <HeaderBreadcrumbs handle={handle} />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <HeaderSearch />
        <NotificationsMenu notifications={notifications} onMarkAllRead={onMarkAllRead} />
        <ThemeSwitcher className="hidden sm:inline-flex" />
        <Separator orientation="vertical" className="mx-1 hidden h-5 data-vertical:self-center sm:block" />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
