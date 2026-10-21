import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type StatusAlertTone = 'danger' | 'warning' | 'info' | 'success'

const TONES: Record<StatusAlertTone, string> = {
  danger: 'border-danger/30 bg-danger/10 text-danger dark:bg-danger/15',
  warning: 'border-warning/30 bg-warning/10 text-warning dark:bg-warning/15',
  info: 'border-info/30 bg-info/10 text-info dark:bg-info/15',
  success: 'border-success/30 bg-success/10 text-success dark:bg-success/15',
}

interface StatusAlertProps {
  tone: StatusAlertTone
  icon: LucideIcon
  title: ReactNode
  children: ReactNode
  /** Optional buttons aligned to the end on wider screens. */
  action?: ReactNode
  className?: string
}

/** Tinted notice for a state that needs attention, with the next step. */
export function StatusAlert({ tone, icon: Icon, title, children, action, className }: StatusAlertProps) {
  return (
    <div role="status" className={cn('flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center', TONES[tone], className)}>
      <Icon className="size-5 shrink-0 max-sm:hidden" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{title}</p>
        <p className="text-caption text-foreground/80">{children}</p>
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  )
}
