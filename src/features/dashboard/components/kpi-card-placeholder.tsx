import { type LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface KpiCardPlaceholderProps {
  label: string
  icon: LucideIcon
}

export function KpiCardPlaceholder({ label, icon: Icon }: KpiCardPlaceholderProps) {
  return (
    <Card className="max-sm:[--card-spacing:--spacing(4)]">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-2 text-label text-muted-foreground">{label}</p>
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
            <Icon className="size-[1.125rem]" aria-hidden="true" />
          </span>
        </div>
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-3/5 max-w-28" />
          <Skeleton className="h-4 w-4/5 max-w-36" />
        </div>
      </CardContent>
    </Card>
  )
}
