import { z } from 'zod'

import { numberField, requiredNumber } from '@/lib/form-schema'
import { type PropertyType, UNIT_STATUSES, type UnitInput } from '@/types'

import { unitTypesFor } from './property-meta'

/**
 * Unit details form. Occupancy and the tenant are not edited here: a unit
 * becomes occupied or vacant only through a lease in the Tenants module.
 */
export function createUnitSchema(propertyType: PropertyType) {
  const types = unitTypesFor(propertyType) as [string, ...string[]]

  return z.object({
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
  }
}
