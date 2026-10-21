import {
  Bug,
  ChefHat,
  CircleEllipsis,
  Droplets,
  Hammer,
  House,
  KeyRound,
  Leaf,
  type LucideIcon,
  MoveVertical,
  Sparkles,
  Thermometer,
  Zap,
} from 'lucide-react'

import { type RequestTiming } from '@/data/domain/maintenance-rules'
import { type HoldReason, type RequestCategory, type RequestSource, type RequestStatus, type WorkOrderStatus } from '@/types'

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Open',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  'on-hold': 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const REQUEST_STATUS_TONES: Record<RequestStatus, BadgeTone> = {
  open: 'brand',
  scheduled: 'info',
  'in-progress': 'warning',
  'on-hold': 'neutral',
  completed: 'success',
  cancelled: 'neutral',
}

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const WORK_ORDER_STATUS_TONES: Record<WorkOrderStatus, BadgeTone> = {
  scheduled: 'info',
  'in-progress': 'warning',
  completed: 'success',
  cancelled: 'neutral',
}

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'Heating & cooling',
  appliance: 'Appliance',
  general: 'General repair',
  'locks-security': 'Locks & security',
  pest: 'Pest control',
  landscaping: 'Landscaping',
  cleaning: 'Cleaning',
  elevator: 'Elevator',
  roofing: 'Roofing',
  other: 'Other',
}

export const CATEGORY_ICONS: Record<RequestCategory, LucideIcon> = {
  plumbing: Droplets,
  electrical: Zap,
  hvac: Thermometer,
  appliance: ChefHat,
  general: Hammer,
  'locks-security': KeyRound,
  pest: Bug,
  landscaping: Leaf,
  cleaning: Sparkles,
  elevator: MoveVertical,
  roofing: House,
  other: CircleEllipsis,
}

export const SOURCE_LABELS: Record<RequestSource, string> = {
  tenant: 'Tenant',
  staff: 'Staff',
  inspection: 'Inspection',
}

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  parts: 'Waiting for parts',
  access: 'Waiting for access',
  tenant: 'Waiting for the tenant',
  approval: 'Waiting for approval',
  weather: 'Weather',
  other: 'Other',
}

export const TIMING_LABELS: Record<RequestTiming, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  'on-track': 'On track',
  closed: 'Closed',
}

/** Status filter groups for the listing. */
export const STATUS_GROUPS = ['active', 'completed', 'cancelled', 'all'] as const
export type StatusGroup = (typeof STATUS_GROUPS)[number]

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  all: 'All',
}
