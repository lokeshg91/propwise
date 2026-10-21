import { type ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
}

/** Card-based form section with a title column on wide screens. */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-10">
        <CardHeader className="content-start self-start lg:pr-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="grid gap-5 lg:pl-0">{children}</CardContent>
      </div>
    </Card>
  )
}
