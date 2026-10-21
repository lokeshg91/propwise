import { z } from 'zod'

/** A number field with friendly messages for blank and non-numeric input. */
export const numberField = (label: string) =>
  z.number({
    error: (issue) =>
      issue.input === undefined || issue.input === null ? `Enter ${label}` : `Enter ${label} as a number`,
  })

/** Accepts `null` from a blank input but reports it as a required-field error. */
export function requiredNumber<TSchema extends z.ZodType<number>>(schema: TSchema, message: string) {
  return schema.nullable().transform((value, context) => {
    if (value === null) {
      context.addIssue({ code: 'custom', message })
      return z.NEVER
    }
    return value
  })
}

/** Converts an input's text to a number, or `null` when blank. Use with `register(..., { setValueAs })`. */
export const toNullableNumber = (value: unknown): number | null =>
  value === '' || value === null || value === undefined ? null : Number(value)
