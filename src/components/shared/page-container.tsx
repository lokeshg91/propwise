import { type ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Constrains page content width and applies consistent responsive padding. */
export function PageContainer({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8',
        className,
      )}
      {...props}
    />
  )
}
