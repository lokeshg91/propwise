import {
  Building2,
  CircleCheck,
  CircleDollarSign,
  DoorOpen,
  FileSignature,
  type LucideIcon,
  UserPlus,
  Wrench,
} from 'lucide-react'

import { type ActivityTone, ActivityTimeline } from '@/components/shared/activity-timeline'
import { type TimelineCategory, type TimelineItem } from '@/features/properties/lib/property-detail'

const STYLES: Record<TimelineCategory, { icon: LucideIcon; tone: ActivityTone }> = {
  property: { icon: Building2, tone: 'info' },
  unit: { icon: DoorOpen, tone: 'primary' },
  tenant: { icon: UserPlus, tone: 'primary' },
  lease: { icon: FileSignature, tone: 'primary' },
  payment: { icon: CircleDollarSign, tone: 'success' },
  maintenance: { icon: Wrench, tone: 'warning' },
  completed: { icon: CircleCheck, tone: 'success' },
}

interface PropertyTimelineProps {
  items: TimelineItem[]
  grouped?: boolean
}

export function PropertyTimeline({ items, grouped = false }: PropertyTimelineProps) {
  return (
    <ActivityTimeline
      items={items.map((item) => ({ ...item, ...STYLES[item.category] }))}
      grouped={grouped}
      emptyDescription="Changes, payments and work orders will appear here."
    />
  )
}
