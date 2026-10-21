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
  /** Compact variant for use inside cards and tables. */
  size?: 'default' | 'sm'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  eyebrow,
  actions,
  titleAs: Title = 'h2',
  size = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        size === 'sm' ? 'py-10' : 'py-14 sm:py-20',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border border-border bg-card shadow-sm',
          size === 'sm' ? 'mb-3 size-10' : 'mb-5 size-12',
        )}
      >
        <Icon className="size-5 text-primary" aria-hidden="true" />
      </div>
      {eyebrow ? (
        <p className="mb-1.5 text-caption font-semibold tracking-wider text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <Title className={cn('text-foreground', size === 'sm' ? 'text-h3' : 'text-h2')}>{title}</Title>
      {description ? (
        <p className="mt-1.5 max-w-md text-body text-muted-foreground">{description}</p>
      ) : null}
      {actions ? (
        <div className={cn('flex flex-wrap items-center justify-center gap-2', size === 'sm' ? 'mt-4' : 'mt-6')}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}
