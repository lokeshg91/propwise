import { z } from 'zod'

import { US_STATE_CODES } from '@/data/reference/us-states'
import { numberField, requiredNumber } from '@/lib/form-schema'
import { PROPERTY_STATUSES, PROPERTY_TYPES, type PropertyInput } from '@/types'

export const MAX_TOTAL_UNITS = 1_000
const CURRENT_YEAR = new Date().getFullYear()

interface PropertySchemaOptions {
  /** Units already configured; total units can't be lower (edit mode). */
  minTotalUnits?: number
}

export function createPropertySchema({ minTotalUnits = 0 }: PropertySchemaOptions = {}) {
  const minimum = Math.max(1, minTotalUnits)

  return z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Enter a property name of at least 2 characters')
      .max(80, 'Keep the name under 80 characters'),
    type: z.enum(PROPERTY_TYPES, { error: 'Choose a property type' }),
    status: z.enum(PROPERTY_STATUSES, { error: 'Choose a status' }),
    street: z.string().trim().min(3, 'Enter the street address').max(120, 'Keep the street address under 120 characters'),
    city: z.string().trim().min(2, 'Enter a city').max(60, 'Keep the city under 60 characters'),
    state: z.string().refine((value) => US_STATE_CODES.includes(value), 'Choose a state'),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
    totalUnits: requiredNumber(
      numberField('the total number of units')
        .int('Enter the total number of units as a whole number')
        .min(
          minimum,
          minTotalUnits > 0
            ? `This property already has ${minTotalUnits} units, so total units can't be lower`
            : 'A property needs at least 1 unit',
        )
        .max(MAX_TOTAL_UNITS, `Total units can't exceed ${MAX_TOTAL_UNITS.toLocaleString('en-US')}`),
      'Enter the total number of units',
    ),
    description: z.string().trim().max(500, 'Keep the description under 500 characters'),
    yearBuilt: numberField('the year built')
      .int('Enter a 4-digit year')
      .min(1800, 'Enter a year from 1800 onwards')
      .max(CURRENT_YEAR + 3, `Enter a year up to ${CURRENT_YEAR + 3}`)
      .nullable(),
    areaSqft: numberField('the building area')
      .int('Enter the area in whole square feet')
      .min(100, 'Building area must be at least 100 sq ft')
      .max(10_000_000, 'Building area looks too large')
      .nullable(),
  }) satisfies z.ZodType<PropertyInput>
}

export type PropertyFormValues = z.output<ReturnType<typeof createPropertySchema>>

/** Form state before validation: required numbers may still be blank. */
export type PropertyFormDraft = z.input<ReturnType<typeof createPropertySchema>>

export const EMPTY_PROPERTY_VALUES: PropertyFormDraft = {
  name: '',
  type: 'residential',
  status: 'stable',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  totalUnits: null,
  description: '',
  yearBuilt: null,
  areaSqft: null,
}
