import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: ReactNode
  /** Optional small text above the title, e.g. an error code. */
  eyebrow?: string
  actions?: ReactNode
  /** Use `h1` when the empty state is the page's main content. */
  titleAs?: 'h1' | 'h2' | 'h3'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  eyebrow,
  actions,
  titleAs: Title = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center sm:py-20',
        className,
      )}
    >
      <div className="mb-5 flex size-12 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
        <Icon className="size-5 text-primary" aria-hidden="true" />
      </div>
      {eyebrow ? (
        <p className="mb-1.5 text-caption font-semibold tracking-wider text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <Title className="text-h2 text-foreground">{title}</Title>
      {description ? (
        <p className="mt-2 max-w-md text-body text-muted-foreground">{description}</p>
      ) : null}
      {actions ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
