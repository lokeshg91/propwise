import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Label/value pairs in a responsive grid. */
export function DetailList({ items, className }: { items: Array<{ label: string; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-caption text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-body text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
