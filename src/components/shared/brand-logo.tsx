import { BrandMark } from '@/components/shared/brand-mark'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  /** Hide the wordmark and show only the mark (collapsed sidebar). */
  compact?: boolean
  className?: string
}

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span
        className={cn(
          'text-[1.0625rem] font-semibold tracking-[-0.02em] text-foreground transition-opacity duration-200',
          compact && 'sr-only',
        )}
      >
        Propwise
      </span>
    </span>
  )
}
