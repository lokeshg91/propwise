import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Initials, or your profile photo on your own record. */
export function StaffAvatar({ name, photo, className }: { name: string; photo?: string | null; className?: string }) {
  return (
    <Avatar className={cn('size-9', className)}>
      {photo ? <AvatarImage src={photo} alt="" /> : null}
      <AvatarFallback className="bg-muted text-caption font-semibold text-foreground">{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
