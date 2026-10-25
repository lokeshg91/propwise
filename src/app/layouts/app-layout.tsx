import { useCallback, useState, useSyncExternalStore } from 'react'
import { Navigate, Outlet, useLoaderData, useLocation, useMatches } from 'react-router'
import { toast } from 'sonner'

import { type appLayoutLoader } from '@/app/layouts/app-layout.loader'
import { AppHeader } from '@/app/layouts/components/app-header'
import { AppSidebar } from '@/app/layouts/components/app-sidebar'
import { MobileNav } from '@/app/layouts/components/mobile-nav'
import { StorageBanner } from '@/app/layouts/components/storage-banner'
import { markAllNotificationsRead, readCurrentUser, readNotifications, subscribeAccount, subscribeNotifications } from '@/data/services'
import { getActiveHandle } from '@/app/routes/route-handle'
import { isBoolean, usePersistedState } from '@/hooks/use-persisted-state'
import { loginPathFor } from '@/lib/safe-next'
import { isSignedIn, signedOutInThisTab, subscribeSession } from '@/lib/session'
import { STORAGE_KEYS } from '@/lib/storage'
import { cn } from '@/lib/utils'

/** Authenticated application shell: sidebar, header and routed content. */
export function AppLayout() {
  const { user: loadedUser, notifications: initialNotifications } = useLoaderData<typeof appLayoutLoader>()
  // The header follows the saved profile as soon as it changes (Account page, restore, reset).
  const user = useSyncExternalStore(subscribeAccount, readCurrentUser, readCurrentUser) ?? loadedUser
  const handle = getActiveHandle(useMatches())

  const [collapsed, setCollapsed] = usePersistedState(STORAGE_KEYS.sidebarCollapsed, false, isBoolean)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // Header menu, sidebar badge and the Notifications page all read the saved inbox.
  const notifications = useSyncExternalStore(subscribeNotifications, readNotifications, readNotifications) ?? initialNotifications
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const markAllRead = useCallback(() => {
    markAllNotificationsRead().catch((error: unknown) => {
      toast.error('Couldn’t mark notifications read', { description: error instanceof Error ? error.message : undefined })
    })
  }, [])

  // Signed out while a page is open: from another tab, go to sign-in and offer to come back here;
  // from this tab's Sign out, go to plain sign-in (the user menu navigates there too).
  const signedIn = useSyncExternalStore(subscribeSession, isSignedIn, isSignedIn)
  const location = useLocation()
  if (!signedIn) {
    const target = signedOutInThisTab() ? '/login' : loginPathFor(`${location.pathname}${location.search}${location.hash}`)
    return <Navigate to={target} replace />
  }

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
        <StorageBanner />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
