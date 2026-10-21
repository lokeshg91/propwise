import { Building2 } from 'lucide-react'

import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type TenantKind } from '@/types'

/** Initials for people, a building icon for businesses. */
export function TenantAvatar({ name, kind, className }: { name: string; kind: TenantKind; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-semibold text-primary dark:bg-primary/15',
        className,
      )}
      aria-hidden="true"
    >
      {kind === 'business' ? <Building2 className="size-4" /> : getInitials(name)}
    </span>
  )
}
