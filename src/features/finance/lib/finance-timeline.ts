import { Ban, Banknote, CalendarPlus, CircleCheck, FilePlus2, Pencil, RotateCcw, Scale, TimerReset, Undo2 } from 'lucide-react'

import { type ActivityItem, type ActivityTone } from '@/components/shared/activity-timeline'
import { type TimelineEntry } from '@/data/services'

const STYLES: Record<TimelineEntry['kind'], { icon: ActivityItem['icon']; tone: ActivityTone }> = {
  posted: { icon: CalendarPlus, tone: 'primary' },
  created: { icon: FilePlus2, tone: 'primary' },
  payment: { icon: Banknote, tone: 'success' },
  'payment-voided': { icon: Undo2, tone: 'danger' },
  edited: { icon: Pencil, tone: 'neutral' },
  adjusted: { icon: Scale, tone: 'warning' },
  'auto-adjusted': { icon: RotateCcw, tone: 'info' },
  voided: { icon: Ban, tone: 'danger' },
  'auto-voided': { icon: Ban, tone: 'neutral' },
  'marked-paid': { icon: CircleCheck, tone: 'success' },
  'marked-unpaid': { icon: Undo2, tone: 'warning' },
  'late-fee-added': { icon: TimerReset, tone: 'warning' },
  'recurring-ended': { icon: Ban, tone: 'neutral' },
}

const ACTOR: Record<TimelineEntry['actor'], string> = {
  user: '',
  system: 'Automatic',
  demo: 'Demo record',
}

/** Finance history entries for the shared activity timeline. */
export function toActivityItems(entries: TimelineEntry[], money: (cents: number) => string): ActivityItem[] {
  return entries.map((entry) => {
    const extras = [entry.amountCents !== undefined ? money(entry.amountCents) : '', ACTOR[entry.actor]].filter(Boolean).join(' · ')
    return {
      id: entry.id,
      title: entry.title,
      description: [entry.description, extras].filter(Boolean).join(' — '),
      createdAt: entry.at,
      ...STYLES[entry.kind],
    }
  })
}
