import { type StaffProperty } from '@/data/services'
import { cn } from '@/lib/utils'

/** Assigned properties as short text: "Maple Court Apartments +2 more" or "No assignments". */
export function PropertySummary({ properties, limit = 1, className }: { properties: StaffProperty[]; limit?: number; className?: string }) {
  if (properties.length === 0) return <span className={cn('text-muted-foreground', className)}>No assignments</span>
  const shown = properties.slice(0, limit)
  const hidden = properties.length - shown.length
  return (
    <span className={cn('block min-w-0', className)} title={properties.map((property) => property.name).join(', ')}>
      <span className="block truncate text-foreground">{shown.map((property) => property.name).join(', ')}</span>
      {hidden > 0 ? <span className="block text-caption text-muted-foreground">+{hidden} more</span> : null}
    </span>
  )
}
