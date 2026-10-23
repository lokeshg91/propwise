import { CircleAlert, LoaderCircle } from 'lucide-react'
import { type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** One settings group: a card with its own form and Save button. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
  tone = 'default',
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  tone?: 'default' | 'danger'
}) {
  return (
    <Card className={cn('min-w-0', tone === 'danger' && 'border-danger/40', className)}>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className={cn(tone === 'danger' && 'text-danger')}>
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {children}
        {footer}
      </CardContent>
    </Card>
  )
}

/** An error from a failed save, shown where the change was made. */
export function SaveError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger dark:bg-danger/15">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}

/** Error and Save button for one settings form. Save stays disabled until something changes. */
export function SaveFooter({ error, pending, dirty, label = 'Save', note }: { error: string | null; pending: boolean; dirty: boolean; label?: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <SaveError message={error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-muted-foreground">{note}</p>
        <Button type="submit" disabled={pending || !dirty} className="sm:self-end">
          {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          {pending ? 'Saving…' : label}
        </Button>
      </div>
    </div>
  )
}
