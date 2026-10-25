import { CircleCheck, FlaskConical, type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** The card every auth page uses: one h1, a description, the form or message, and footer links. */
export function AuthCard({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <Card className={cn('w-full shadow-md', wide ? 'max-w-md' : 'max-w-sm')}>
      <CardHeader className="gap-1.5">
        <h1 data-slot="card-title" className="font-heading text-h2 text-foreground">
          {title}
        </h1>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
      {footer ? <CardFooter className="flex-col gap-2 text-center text-caption text-muted-foreground">{footer}</CardFooter> : null}
    </Card>
  )
}

/** States plainly that this flow is a frontend demo. */
export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-caption text-muted-foreground">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** The outcome of a demo flow: what happened, and what didn't. */
export function DemoResult({ icon: Icon = CircleCheck, title, children, action }: { icon?: LucideIcon; title: string; children: ReactNode; action: ReactNode }) {
  return (
    <Card className="w-full max-w-sm shadow-md">
      <CardHeader className="items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/15">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h1 data-slot="card-title" className="font-heading text-h2 text-foreground">
          {title}
        </h1>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div role="status" className="flex flex-col gap-2 text-body text-muted-foreground">
          {children}
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
