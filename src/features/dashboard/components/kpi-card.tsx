import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'

interface KpiCardProps {
  label: string
  value: string
  icon: LucideIcon
  /** Supporting line under the value: a trend or breakdown. */
  footer: ReactNode
}

export function KpiCard({ label, value, icon: Icon, footer }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-1.5 text-label text-muted-foreground">{label}</p>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
            <Icon className="size-[1.125rem]" aria-hidden="true" />
          </span>
        </div>
        <p className="text-h1 text-foreground tabular-nums sm:text-display">{value}</p>
        <div className="mt-auto">{footer}</div>
      </CardContent>
    </Card>
  )
}
