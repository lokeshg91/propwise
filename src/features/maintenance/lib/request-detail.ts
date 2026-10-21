import {
  ArrowRightLeft,
  CalendarClock,
  CircleCheckBig,
  CirclePause,
  CirclePlay,
  CircleX,
  ClipboardPlus,
  DoorClosed,
  DoorOpen,
  Gauge,
  type LucideIcon,
  Pencil,
  RotateCcw,
  UserCheck,
  Wrench,
} from 'lucide-react'

import { type ActivityItem, type ActivityTone } from '@/components/shared/activity-timeline'
import { type RequestDetail } from '@/data/services'
import { type MaintenanceEventKind } from '@/types'

const EVENT_STYLES: Record<MaintenanceEventKind, { icon: LucideIcon; tone: ActivityTone }> = {
  created: { icon: ClipboardPlus, tone: 'primary' },
  updated: { icon: Pencil, tone: 'info' },
  'priority-changed': { icon: Gauge, tone: 'warning' },
  assigned: { icon: UserCheck, tone: 'primary' },
  reassigned: { icon: ArrowRightLeft, tone: 'info' },
  rescheduled: { icon: CalendarClock, tone: 'info' },
  started: { icon: Wrench, tone: 'warning' },
  'on-hold': { icon: CirclePause, tone: 'neutral' },
  resumed: { icon: CirclePlay, tone: 'info' },
  completed: { icon: CircleCheckBig, tone: 'success' },
  cancelled: { icon: CircleX, tone: 'neutral' },
  reopened: { icon: RotateCcw, tone: 'warning' },
  'unit-offline': { icon: DoorClosed, tone: 'warning' },
  'unit-returned': { icon: DoorOpen, tone: 'success' },
}

export const maintenanceEventStyle = (kind: MaintenanceEventKind) => EVENT_STYLES[kind]

/** Request history for the shared ActivityTimeline, newest first. */
export function buildRequestTimeline(detail: Pick<RequestDetail, 'events'>): ActivityItem[] {
  return detail.events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    createdAt: event.createdAt,
    ...EVENT_STYLES[event.kind],
  }))
}
