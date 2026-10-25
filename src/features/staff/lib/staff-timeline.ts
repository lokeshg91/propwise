import { Building2, Pencil, ShieldCheck, UserPlus, UserRoundCheck, UserRoundX, type LucideIcon } from 'lucide-react'

import { type ActivityItem, type ActivityTone } from '@/components/shared/activity-timeline'
import { type StaffDetail } from '@/data/services'
import { type StaffEventKind } from '@/types'

const EVENT_STYLES: Record<StaffEventKind, { icon: LucideIcon; tone: ActivityTone }> = {
  created: { icon: UserPlus, tone: 'primary' },
  updated: { icon: Pencil, tone: 'info' },
  'role-changed': { icon: ShieldCheck, tone: 'warning' },
  'properties-changed': { icon: Building2, tone: 'info' },
  deactivated: { icon: UserRoundX, tone: 'neutral' },
  reactivated: { icon: UserRoundCheck, tone: 'success' },
}

/**
 * A member's history, newest first. Entries keep the name used at the time;
 * sample members without a "created" entry get one from their start date.
 */
export function buildStaffTimeline(detail: Pick<StaffDetail, 'member' | 'events'>): ActivityItem[] {
  const items: ActivityItem[] = detail.events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.staffName !== detail.member.name ? `${event.description} Recorded as “${event.staffName}”.` : event.description,
    createdAt: event.createdAt,
    ...EVENT_STYLES[event.kind],
  }))
  if (!detail.events.some((event) => event.kind === 'created')) {
    items.push({ id: `${detail.member.id}-joined`, title: 'Joined the team', description: 'Part of the sample team.', createdAt: detail.member.createdAt, icon: UserPlus, tone: 'primary' })
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
