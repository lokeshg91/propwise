import { type ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Propwise brand mark: a "P" whose bowl is topped with a gable roof.
 * Colors come from theme tokens, so the mark adapts to light and dark mode.
 * The favicon (`public/favicon/favicon.svg`) uses the same geometry.
 */
export function BrandMark({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('size-8 shrink-0', className)}
      {...props}
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M11.5 24.5V11.8L16 7.6l4.5 4.2v3.4a3.8 3.8 0 0 1-3.8 3.8h-5.2"
        className="stroke-primary-foreground"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
