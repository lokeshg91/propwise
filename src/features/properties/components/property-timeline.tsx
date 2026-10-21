import {
  Building2,
  CircleCheck,
  CircleDollarSign,
  DoorOpen,
  FileSignature,
  History,
  type LucideIcon,
  UserPlus,
  Wrench,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { type TimelineCategory, type TimelineItem } from '@/features/properties/lib/property-detail'
import { formatRelativeTime, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const STYLES: Record<TimelineCategory, { icon: LucideIcon; tone: string }> = {
  property: { icon: Building2, tone: 'bg-info/10 text-info dark:bg-info/15' },
  unit: { icon: DoorOpen, tone: 'bg-primary/10 text-primary dark:bg-primary/15' },
  tenant: { icon: UserPlus, tone: 'bg-primary/10 text-primary dark:bg-primary/15' },
  lease: { icon: FileSignature, tone: 'bg-primary/10 text-primary dark:bg-primary/15' },
  payment: { icon: CircleDollarSign, tone: 'bg-success/10 text-success dark:bg-success/15' },
  maintenance: { icon: Wrench, tone: 'bg-warning/10 text-warning dark:bg-warning/15' },
  completed: { icon: CircleCheck, tone: 'bg-success/10 text-success dark:bg-success/15' },
}

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return dayFormat.format(date)
}

interface PropertyTimelineProps {
  items: TimelineItem[]
  /** Group entries under day headings (full activity view). */
  grouped?: boolean
}

export function PropertyTimeline({ items, grouped = false }: PropertyTimelineProps) {
  if (items.length === 0) {
    return <EmptyState size="sm" icon={History} title="No activity yet" description="Changes, payments and work orders will appear here." />
  }

  if (!grouped) return <TimelineList items={items} timeStyle="relative" />

  const groups = new Map<string, TimelineItem[]>()
  for (const item of items) {
    const label = dayLabel(item.createdAt)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }

  return (
    <div className="flex flex-col gap-8">
      {[...groups.entries()].map(([label, entries]) => (
        <section key={label} aria-label={label} className="flex flex-col gap-4">
          <h3 className="text-caption font-semibold tracking-wider text-muted-foreground uppercase">{label}</h3>
          <TimelineList items={entries} timeStyle="clock" />
        </section>
      ))}
    </div>
  )
}

function TimelineList({ items, timeStyle }: { items: TimelineItem[]; timeStyle: 'relative' | 'clock' }) {
  return (
    <ol className="flex flex-col gap-5">
      {items.map((item, index) => {
        const { icon: Icon, tone } = STYLES[item.category]
        return (
          <li key={item.id} className="relative flex gap-3">
            {index < items.length - 1 ? (
              <span className="absolute top-10 bottom-[-1.25rem] left-[1.0625rem] w-px bg-border" aria-hidden="true" />
            ) : null}
            <span className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-full', tone)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-body font-medium text-foreground">{item.title}</p>
                <time dateTime={item.createdAt} className="shrink-0 text-caption text-muted-foreground">
                  {timeStyle === 'clock' ? formatTime(item.createdAt) : formatRelativeTime(item.createdAt)}
                </time>
              </div>
              <p className="mt-0.5 text-caption text-muted-foreground">{item.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
