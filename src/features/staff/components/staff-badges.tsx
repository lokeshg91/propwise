import { ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS } from '@/data/domain/staff-rules'
import { type StaffRole } from '@/types'

export function StaffStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'neutral'}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

/** Owners and admins get a shield: they can manage staff and settings. */
export function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <Badge variant="outline">
      {role === 'owner' || role === 'admin' ? <ShieldCheck className="text-primary" aria-hidden="true" /> : null}
      {ROLE_LABELS[role]}
    </Badge>
  )
}

/** Marks the signed-in user's own record. */
export function YouBadge() {
  return <Badge variant="info">You</Badge>
}
