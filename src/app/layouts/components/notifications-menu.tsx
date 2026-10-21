import {
  Bell,
  CalendarClock,
  CircleCheck,
  type LucideIcon,
  Settings,
  UserPlus,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router'

import { IconButton } from '@/components/shared/icon-button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type AppNotification, type NotificationCategory } from '@/types'

const CATEGORY_STYLES: Record<NotificationCategory, { icon: LucideIcon; className: string }> = {
  maintenance: { icon: Wrench, className: 'bg-warning/10 text-warning dark:bg-warning/15' },
  payment: { icon: CircleCheck, className: 'bg-success/10 text-success dark:bg-success/15' },
  lease: { icon: CalendarClock, className: 'bg-info/10 text-info dark:bg-info/15' },
  tenant: { icon: UserPlus, className: 'bg-primary/10 text-primary dark:bg-primary/15' },
  system: { icon: Settings, className: 'bg-muted text-muted-foreground' },
}

interface NotificationsMenuProps {
  notifications: AppNotification[]
  onMarkAllRead: () => void
}

export function NotificationsMenu({ notifications, onMarkAllRead }: NotificationsMenuProps) {
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={label} className="relative">
          <Bell />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-h3 text-foreground">Notifications</p>
            <p className="text-caption text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            // aria-disabled keeps keyboard focus on the button after use.
            aria-disabled={unreadCount === 0}
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
            onClick={() => {
              if (unreadCount > 0) onMarkAllRead()
            }}
          >
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="max-h-[22rem] overflow-y-auto p-1.5">
          {notifications.map((notification) => {
            const { icon: Icon, className } = CATEGORY_STYLES[notification.category]
            return (
              <DropdownMenuItem key={notification.id} asChild className="items-start gap-3 px-2.5 py-2.5">
                <Link to="/notifications">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', className)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-body font-medium text-foreground">
                        {notification.title}
                      </span>
                      {notification.read ? null : (
                        <>
                          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
                          <span className="sr-only">(unread)</span>
                        </>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-caption text-muted-foreground">
                      {notification.message}
                    </span>
                    <time
                      dateTime={notification.createdAt}
                      className="mt-1 block text-caption text-muted-foreground/80"
                    >
                      {formatRelativeTime(notification.createdAt)}
                    </time>
                  </span>
                </Link>
              </DropdownMenuItem>
            )
          })}
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="p-1.5">
          <DropdownMenuItem asChild className="justify-center py-2 font-medium text-primary">
            <Link to="/notifications">View all notifications</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
