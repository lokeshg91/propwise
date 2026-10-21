import { z } from 'zod'

import { numberField, requiredNumber } from '@/lib/form-schema'
import { type PropertyType, UNIT_STATUSES, type UnitInput } from '@/types'

import { unitTypesFor } from './property-meta'

export function createUnitSchema(propertyType: PropertyType) {
  const types = unitTypesFor(propertyType) as [string, ...string[]]

  return z
    .object({
      number: z
        .string()
        .trim()
        .min(1, 'Enter a unit number')
        .max(10, 'Keep the unit number under 10 characters')
        .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers or hyphens only'),
      type: z.enum(types, { error: 'Choose a unit type' }),
      floor: requiredNumber(
        numberField('the floor').int('Enter the floor as a whole number').min(-5, 'Floor must be −5 or higher').max(200, 'Floor must be 200 or lower'),
        'Enter the floor',
      ),
      areaSqft: requiredNumber(
        numberField('the size').int('Enter the size in whole square feet').min(50, 'Size must be at least 50 sq ft').max(100_000, 'Size looks too large'),
        'Enter the size in square feet',
      ),
      rent: requiredNumber(
        numberField('the monthly rent').min(0, 'Rent can’t be negative').max(1_000_000, 'Rent looks too large'),
        'Enter the monthly rent',
      ),
      status: z.enum(UNIT_STATUSES, { error: 'Choose an occupancy status' }),
      tenantName: z.string().trim().max(80, 'Keep the tenant name under 80 characters'),
      leaseEndDate: z.string(),
    })
    .superRefine((values, context) => {
      if (values.status !== 'occupied') return
      if (values.tenantName.length < 2) {
        context.addIssue({ code: 'custom', path: ['tenantName'], message: 'Enter the tenant’s name for an occupied unit' })
      }
      if (values.rent <= 0) {
        context.addIssue({ code: 'custom', path: ['rent'], message: 'Occupied units need a rent above $0' })
      }
      if (values.leaseEndDate && values.leaseEndDate <= new Date().toISOString().slice(0, 10)) {
        context.addIssue({ code: 'custom', path: ['leaseEndDate'], message: 'Lease end date must be in the future' })
      }
    })
}

export type UnitFormDraft = z.input<ReturnType<typeof createUnitSchema>>
export type UnitFormValues = z.output<ReturnType<typeof createUnitSchema>>

export function toUnitInput(values: UnitFormValues): UnitInput {
  return {
    number: values.number,
    type: values.type as UnitInput['type'],
    floor: values.floor,
    areaSqft: values.areaSqft,
    rent: values.rent,
    status: values.status,
    tenantName: values.status === 'occupied' ? values.tenantName : null,
    leaseEndDate: values.status === 'occupied' && values.leaseEndDate ? values.leaseEndDate : null,
  }
}
