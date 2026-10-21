import { CircleAlert } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FieldControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
  'aria-required': boolean | undefined
}

interface FormFieldProps {
  label: string
  /** Render prop receiving the id and ARIA attributes to spread on the control. */
  children: (control: FieldControlProps) => ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  /** Extra content aligned with the label, e.g. a character counter. */
  labelAside?: ReactNode
  className?: string
}

/** Label, control, hint and error message, wired together for assistive tech. */
export function FormField({ label, children, error, hint, required, labelAside, className }: FormFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span className="text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
        {labelAside}
      </div>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
        'aria-required': required || undefined,
      })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-caption font-medium text-danger">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
