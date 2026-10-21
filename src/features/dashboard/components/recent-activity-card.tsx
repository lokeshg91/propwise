import { Building2, CircleCheck, CircleDollarSign, FileSignature, History, type LucideIcon, UserPlus, Wrench } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type Activity, type ActivityType } from '@/types'

const ACTIVITY_STYLES: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  'tenant-added': { icon: UserPlus, tone: 'bg-primary/10 text-primary dark:bg-primary/15' },
  'payment-received': { icon: CircleDollarSign, tone: 'bg-success/10 text-success dark:bg-success/15' },
  'maintenance-created': { icon: Wrench, tone: 'bg-warning/10 text-warning dark:bg-warning/15' },
  'work-order-completed': { icon: CircleCheck, tone: 'bg-success/10 text-success dark:bg-success/15' },
  'property-added': { icon: Building2, tone: 'bg-info/10 text-info dark:bg-info/15' },
  'lease-signed': { icon: FileSignature, tone: 'bg-primary/10 text-primary dark:bg-primary/15' },
}

export function RecentActivityCard({ activities }: { activities: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest events across your properties</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState size="sm" icon={History} title="No recent activity" description="Events for the selected properties will appear here." />
        ) : (
          <ol className="relative space-y-5">
            {activities.map((activity, index) => {
              const { icon: Icon, tone } = ACTIVITY_STYLES[activity.type]
              return (
                <li key={activity.id} className="relative flex gap-3">
                  {index < activities.length - 1 ? (
                    <span className="absolute top-10 bottom-[-1.25rem] left-[1.0625rem] w-px bg-border" aria-hidden="true" />
                  ) : null}
                  <span className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-full', tone)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-body font-medium text-foreground">{activity.title}</p>
                      <time dateTime={activity.createdAt} className="shrink-0 text-caption text-muted-foreground">
                        {formatRelativeTime(activity.createdAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-caption text-muted-foreground">{activity.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
