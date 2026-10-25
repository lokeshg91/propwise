import { BellOff, CheckCheck, ExternalLink, Mail, MailOpen, SearchX, Settings2 } from 'lucide-react'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useLoaderData, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { markAllNotificationsRead, NOTIFICATION_CATEGORIES, readNotifications, setNotificationRead, subscribeNotifications } from '@/data/services'
import { type notificationsLoader } from '@/features/notifications/notifications.loaders'
import { CATEGORY_LABELS, CATEGORY_STYLES } from '@/features/notifications/lib/notification-meta'
import { useFormat } from '@/hooks/use-format'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type AppNotification, type NotificationCategory } from '@/types'

const READ_FILTERS = ['all', 'unread', 'read'] as const
type ReadFilter = (typeof READ_FILTERS)[number]
const READ_LABELS: Record<ReadFilter, string> = { all: 'All', unread: 'Unread', read: 'Read' }
const isCategory = (value: string | null): value is NotificationCategory => (NOTIFICATION_CATEGORIES as readonly (string | null)[]).includes(value)
const isReadFilter = (value: string | null): value is ReadFilter => (READ_FILTERS as readonly (string | null)[]).includes(value)

/** Notifications (Phase 10.5): the whole inbox, filtered by `?category=` and `?status=` (unread / read). */
export function NotificationsPage() {
  const { notifications: loaded } = useLoaderData<typeof notificationsLoader>()
  const notifications = useSyncExternalStore(subscribeNotifications, readNotifications, readNotifications) ?? loaded
  const [params, setParams] = useSearchParams()
  const category = isCategory(params.get('category')) ? (params.get('category') as NotificationCategory) : 'all'
  const status: ReadFilter = isReadFilter(params.get('status')) ? (params.get('status') as ReadFilter) : 'all'
  const [pending, setPending] = useState(false)

  const setFilter = useCallback(
    (key: 'category' | 'status', value: string) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value === 'all') next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  )

  const unread = notifications.filter((item) => !item.read).length
  const shown = useMemo(
    () => notifications.filter((item) => (category === 'all' || item.category === category) && (status === 'all' || (status === 'unread' ? !item.read : item.read))),
    [notifications, category, status],
  )
  const statusOptions = READ_FILTERS.map((value) => ({
    value,
    label: `${READ_LABELS[value]} (${notifications.filter((item) => (category === 'all' || item.category === category) && (value === 'all' || (value === 'unread' ? !item.read : item.read))).length})`,
  }))

  const markAll = async () => {
    setPending(true)
    try {
      const changed = await markAllNotificationsRead()
      if (changed > 0) toast.success('All notifications marked read')
    } catch (error) {
      toast.error('Couldn’t mark notifications read', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setPending(false)
    }
  }

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader
        title="Notifications"
        description="Activity in your workspace. Shown in Propwise only: nothing is sent by email or push."
        meta={unread > 0 ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary dark:bg-primary/15">{unread} unread</span> : null}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/account">
                <Settings2 data-icon="inline-start" />
                Notification settings
              </Link>
            </Button>
            <Button onClick={() => void markAll()} disabled={pending || unread === 0}>
              <CheckCheck data-icon="inline-start" />
              Mark all read
            </Button>
          </>
        }
      />

      <Card className="min-w-0 pb-2">
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center gap-2 px-5">
            <SegmentedControl label="Read status" value={status} options={statusOptions} onValueChange={(value) => setFilter('status', value)} />
            <Select value={category} onValueChange={(value) => setFilter('category', value)}>
              <SelectTrigger aria-label="Filter by type" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {NOTIFICATION_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category !== 'all' || status !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })}>
                Reset filters
              </Button>
            ) : null}
            <p className="ml-auto text-caption text-muted-foreground" aria-live="polite">
              {shown.length} {shown.length === 1 ? 'notification' : 'notifications'}
            </p>
          </div>

          {shown.length === 0 ? (
            notifications.length === 0 ? (
              <EmptyState size="sm" icon={BellOff} title="No notifications" description="New activity in your workspace will appear here." />
            ) : (
              <EmptyState
                size="sm"
                icon={SearchX}
                title={status === 'unread' ? 'You’re all caught up' : 'No notifications match your filters'}
                description={status === 'unread' ? 'There are no unread notifications of this type.' : 'Try another type or status.'}
                actions={
                  <Button variant="outline" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })}>
                    Show all notifications
                  </Button>
                }
              />
            )
          ) : (
            <ul aria-label="Notifications" className="flex flex-col divide-y divide-border border-t border-border">
              {shown.map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function NotificationRow({ item }: { item: AppNotification }) {
  const { dateTime } = useFormat()
  const { icon: Icon, className } = CATEGORY_STYLES[item.category]
  const toggle = (read: boolean) =>
    setNotificationRead(item.id, read).catch((error: unknown) => {
      toast.error('Couldn’t update the notification', { description: error instanceof Error ? error.message : undefined })
    })
  return (
    <li className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start', !item.read && 'bg-primary/[0.03] dark:bg-primary/[0.06]')}>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg max-sm:hidden', className)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('text-body text-foreground', !item.read && 'font-semibold')}>{item.title}</span>
          {item.read ? null : (
            <>
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="sr-only">(unread)</span>
            </>
          )}
          <span className="text-caption text-muted-foreground">· {CATEGORY_LABELS[item.category]}</span>
        </p>
        <p className="mt-0.5 text-body text-muted-foreground">{item.message}</p>
        <p className="mt-1 text-caption text-muted-foreground">
          <time dateTime={item.createdAt} title={dateTime(item.createdAt)}>
            {formatRelativeTime(item.createdAt)}
          </time>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {item.link ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={item.link} onClick={() => !item.read && void toggle(true)} aria-label={`Open: ${item.title}`}>
              <ExternalLink data-icon="inline-start" />
              Open
            </Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => void toggle(!item.read)} aria-label={`${item.read ? 'Mark as unread' : 'Mark as read'}: ${item.title}`}>
          {item.read ? <Mail data-icon="inline-start" /> : <MailOpen data-icon="inline-start" />}
          {item.read ? 'Mark unread' : 'Mark read'}
        </Button>
      </div>
    </li>
  )
}
