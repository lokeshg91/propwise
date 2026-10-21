import { useCallback, useState } from 'react'
import { Outlet, useLoaderData, useMatches } from 'react-router'

import { type appLayoutLoader } from '@/app/layouts/app-layout.loader'
import { AppHeader } from '@/app/layouts/components/app-header'
import { AppSidebar } from '@/app/layouts/components/app-sidebar'
import { MobileNav } from '@/app/layouts/components/mobile-nav'
import { getActiveHandle } from '@/app/routes/route-handle'
import { isBoolean, usePersistedState } from '@/hooks/use-persisted-state'
import { STORAGE_KEYS } from '@/lib/storage'
import { cn } from '@/lib/utils'

/** Authenticated application shell: sidebar, header and routed content. */
export function AppLayout() {
  const { user, notifications: initialNotifications } = useLoaderData<typeof appLayoutLoader>()
  const handle = getActiveHandle(useMatches())

  const [collapsed, setCollapsed] = usePersistedState(STORAGE_KEYS.sidebarCollapsed, false, isBoolean)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notifications, setNotifications] = useState(initialNotifications)

  const unreadCount = notifications.filter((notification) => !notification.read).length
  const markAllRead = useCallback(() => {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })))
  }, [])

  return (
    <div className="min-h-svh bg-background">
      <title>{handle ? `${handle.title} · Propwise` : 'Propwise'}</title>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <AppSidebar collapsed={collapsed} unreadCount={unreadCount} />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} unreadCount={unreadCount} />

      <div
        className={cn(
          'flex min-h-svh min-w-0 flex-col transition-[padding] duration-200 ease-out',
          collapsed ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar',
        )}
      >
        <AppHeader
          handle={handle}
          user={user}
          notifications={notifications}
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => setCollapsed(!collapsed)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onMarkAllRead={markAllRead}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
