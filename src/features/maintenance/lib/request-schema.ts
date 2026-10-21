import { z } from 'zod'

import { type RequestDetail, type RequestFormOptions } from '@/data/services'
import { numberField } from '@/lib/form-schema'
import {
  MAINTENANCE_PRIORITIES,
  REQUEST_CATEGORIES,
  REQUEST_SOURCES,
  type ServiceRequestInput,
  type Vendor,
  type WorkOrderInput,
} from '@/types'

export const TITLE_LIMIT = 120
export const DESCRIPTION_LIMIT = 1_000

/**
 * Request form. Mirrors the maintenance service rules, which validate again
 * on save. `canTakeOffline` and `vendors` let the form check choices against
 * current data (vacant units only, active vendors only).
 */
export function createRequestSchema(context: {
  canTakeOffline: (unitId: string) => boolean
  vendors: Vendor[]
}) {
  return z
    .object({
      title: z.string().trim().min(3, 'Describe the issue in a few words').max(TITLE_LIMIT, `Keep the title under ${TITLE_LIMIT} characters`),
      category: z.enum(REQUEST_CATEGORIES, { error: 'Choose a category' }),
      priority: z.enum(MAINTENANCE_PRIORITIES, { error: 'Choose a priority' }),
      description: z.string().trim().max(DESCRIPTION_LIMIT, `Keep the description under ${DESCRIPTION_LIMIT.toLocaleString('en-US')} characters`),
      propertyId: z.string().min(1, 'Choose a property'),
      locationType: z.enum(['unit', 'area']),
      unitId: z.string(),
      area: z.string().trim(),
      source: z.enum(REQUEST_SOURCES),
      tenantId: z.string(),
      permissionToEnter: z.boolean(),
      accessNotes: z.string().trim().max(300, 'Keep access notes under 300 characters'),
      takeUnitOffline: z.boolean(),
      assignNow: z.boolean(),
      vendorId: z.string(),
      scheduledFor: z.string(),
      estimatedCost: numberField('the estimate').min(0, 'The estimate can’t be negative').max(1_000_000, 'The estimate looks too large').nullable(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (values.locationType === 'unit' && !values.unitId) issue('unitId', 'Choose the unit')
      if (values.locationType === 'area' && values.area.length < 2) issue('area', 'Name the common area, e.g. Lobby')
      if (values.source === 'tenant' && !values.tenantId) issue('tenantId', 'Choose the tenant who reported it')
      if (values.takeUnitOffline && (values.locationType !== 'unit' || !context.canTakeOffline(values.unitId))) {
        issue('takeUnitOffline', 'Only a vacant unit without an active or pending lease can be taken offline')
      }
      if (values.assignNow) {
        const vendor = context.vendors.find((entry) => entry.id === values.vendorId)
        if (!vendor) issue('vendorId', 'Choose a vendor')
        else if (!vendor.active) issue('vendorId', `${vendor.name} is inactive and can’t take new work orders`)
        if (values.scheduledFor && Number.isNaN(Date.parse(values.scheduledFor))) issue('scheduledFor', 'Enter a valid date and time')
      }
    })
}

export type RequestFormDraft = z.input<ReturnType<typeof createRequestSchema>>
export type RequestFormValues = z.output<ReturnType<typeof createRequestSchema>>

export function emptyRequestValues(prefill: { propertyId?: string; unitId?: string; tenantId?: string } = {}): RequestFormDraft {
  return {
    title: '',
    category: 'general',
    priority: 'medium',
    description: '',
    propertyId: prefill.propertyId ?? '',
    locationType: 'unit',
    unitId: prefill.unitId ?? '',
    area: '',
    source: prefill.tenantId ? 'tenant' : 'staff',
    tenantId: prefill.tenantId ?? '',
    permissionToEnter: false,
    accessNotes: '',
    takeUnitOffline: false,
    assignNow: false,
    vendorId: '',
    scheduledFor: '',
    estimatedCost: null,
  }
}

export function toRequestFormValues(detail: RequestDetail): RequestFormDraft {
  const { request } = detail
  return {
    ...emptyRequestValues(),
    title: request.title,
    category: request.category,
    priority: request.priority,
    description: request.description,
    propertyId: request.propertyId,
    locationType: request.unitId ? 'unit' : 'area',
    unitId: request.unitId ?? '',
    area: request.area ?? '',
    source: request.source,
    tenantId: request.tenantId ?? '',
    permissionToEnter: request.permissionToEnter,
    accessNotes: request.accessNotes,
  }
}

export function toRequestInput(values: RequestFormValues): ServiceRequestInput {
  const unit = values.locationType === 'unit'
  return {
    title: values.title,
    description: values.description,
    category: values.category,
    priority: values.priority,
    propertyId: values.propertyId,
    unitId: unit ? values.unitId : null,
    area: unit ? null : values.area,
    tenantId: unit && values.tenantId ? values.tenantId : null,
    source: values.source,
    permissionToEnter: unit && values.permissionToEnter,
    accessNotes: values.accessNotes,
  }
}

export function toWorkOrderInput(values: Pick<RequestFormValues, 'vendorId' | 'scheduledFor' | 'estimatedCost'>, notes = ''): WorkOrderInput {
  return {
    vendorId: values.vendorId,
    scheduledFor: values.scheduledFor ? new Date(values.scheduledFor).toISOString() : null,
    estimatedCost: values.estimatedCost,
    notes,
  }
}

/** Service error fields → form fields. */
export const REQUEST_FIELD_MAP: Record<string, keyof RequestFormDraft> = {
  title: 'title',
  description: 'description',
  unitId: 'unitId',
  area: 'area',
  tenantId: 'tenantId',
  takeUnitOffline: 'takeUnitOffline',
  vendorId: 'vendorId',
  scheduledFor: 'scheduledFor',
  estimatedCost: 'estimatedCost',
}

export type FormUnit = RequestFormOptions['properties'][number]['units'][number]
