import { History, type LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { useFormat } from '@/hooks/use-format'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export type ActivityTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export interface ActivityItem {
  id: string
  title: string
  description: string
  /** ISO timestamp. */
  createdAt: string
  icon: LucideIcon
  tone: ActivityTone
}

const TONES: Record<ActivityTone, string> = {
  primary: 'bg-primary/10 text-primary dark:bg-primary/15',
  info: 'bg-info/10 text-info dark:bg-info/15',
  success: 'bg-success/10 text-success dark:bg-success/15',
  warning: 'bg-warning/10 text-warning dark:bg-warning/15',
  danger: 'bg-danger/10 text-danger dark:bg-danger/15',
  neutral: 'bg-muted text-muted-foreground',
}

/** "Today", "Yesterday" or the local calendar day, e.g. "October 24, 2026" (in the workspace region). */
function dayLabel(iso: string, longDate: (isoDate: string) => string, now = new Date()): string {
  const date = new Date(iso)
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const pad = (value: number) => String(value).padStart(2, '0')
  return longDate(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`)
}

interface ActivityTimelineProps {
  items: ActivityItem[]
  /** Group entries under day headings (full activity view). */
  grouped?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

/** Vertical activity feed: icon, title, description and time, newest first. */
export function ActivityTimeline({
  items,
  grouped = false,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Changes will appear here.',
}: ActivityTimelineProps) {
  const { longDate } = useFormat()
  if (items.length === 0) {
    return <EmptyState size="sm" icon={History} title={emptyTitle} description={emptyDescription} />
  }

  if (!grouped) return <TimelineList items={items} timeStyle="relative" />

  const groups = new Map<string, ActivityItem[]>()
  for (const item of items) {
    const label = dayLabel(item.createdAt, longDate)
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

function TimelineList({ items, timeStyle }: { items: ActivityItem[]; timeStyle: 'relative' | 'clock' }) {
  const { time: formatTime } = useFormat()
  return (
    <ol className="flex flex-col gap-5">
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <li key={item.id} className="relative flex gap-3">
            {index < items.length - 1 ? (
              <span className="absolute top-10 bottom-[-1.25rem] left-[1.0625rem] w-px bg-border" aria-hidden="true" />
            ) : null}
            <span className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-full', TONES[item.tone])}>
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
