import { CalendarClock, CircleCheck, type LucideIcon, Settings, UserPlus, Wrench } from 'lucide-react'

import { type NotificationCategory } from '@/types'

/** Icon and tint per category (header menu and Notifications page). */
export const CATEGORY_STYLES: Record<NotificationCategory, { icon: LucideIcon; className: string }> = {
  maintenance: { icon: Wrench, className: 'bg-warning/10 text-warning dark:bg-warning/15' },
  payment: { icon: CircleCheck, className: 'bg-success/10 text-success dark:bg-success/15' },
  lease: { icon: CalendarClock, className: 'bg-info/10 text-info dark:bg-info/15' },
  tenant: { icon: UserPlus, className: 'bg-primary/10 text-primary dark:bg-primary/15' },
  system: { icon: Settings, className: 'bg-muted text-muted-foreground' },
}

/** Same labels as the notification preferences on the Account page. */
export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  maintenance: 'Maintenance',
  payment: 'Payments',
  lease: 'Leases',
  tenant: 'Tenants',
  system: 'Workspace',
}

