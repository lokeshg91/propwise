import { Badge } from '@/components/ui/badge'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/features/maintenance/lib/request-meta'
import { cn } from '@/lib/utils'
import { type RequestCategory } from '@/types'

export function VendorStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'neutral'}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

/** Service categories as small chips. `limit` shows the first few plus "+N". */
export function CategoryChips({ categories, limit, className }: { categories: RequestCategory[]; limit?: number; className?: string }) {
  const shown = limit ? categories.slice(0, limit) : categories
  const hidden = categories.length - shown.length
  return (
    <span className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {shown.map((category) => {
        const Icon = CATEGORY_ICONS[category]
        return (
          <span
            key={category}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 text-caption text-foreground"
          >
            <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {CATEGORY_LABELS[category]}
          </span>
        )
      })}
      {hidden > 0 ? (
        <span className="text-caption text-muted-foreground" title={categories.slice(shown.length).map((category) => CATEGORY_LABELS[category]).join(', ')}>
          +{hidden} more
        </span>
      ) : null}
    </span>
  )
}
