import { z } from 'zod'

import { VENDOR_LIMITS } from '@/data/services'
import { REQUEST_CATEGORIES, type Vendor, type VendorInput } from '@/types'

const PHONE_PATTERN = /^[\d\s()+.-]+$/

/** Vendor form. The vendor service validates the same rules again on save. */
export const vendorSchema = z.object({
  name: z.string().trim().min(2, 'Enter the vendor name').max(VENDOR_LIMITS.name, `Keep the name under ${VENDOR_LIMITS.name} characters`),
  company: z.string().trim().max(VENDOR_LIMITS.company, `Keep the company name under ${VENDOR_LIMITS.company} characters`),
  status: z.enum(['active', 'inactive']),
  contactName: z.string().trim().min(2, 'Enter the contact person').max(VENDOR_LIMITS.contactName, `Keep the name under ${VENDOR_LIMITS.contactName} characters`),
  email: z.string().trim().min(1, 'Enter an email address').pipe(z.email('Enter a valid email address')),
  phone: z
    .string()
    .trim()
    .min(1, 'Enter a phone number')
    .refine((value) => PHONE_PATTERN.test(value) && value.replace(/\D/g, '').length >= 10, 'Enter a valid phone number, e.g. (512) 555-0134'),
  categories: z.array(z.enum(REQUEST_CATEGORIES)).min(1, 'Choose at least one service'),
  notes: z.string().trim().max(VENDOR_LIMITS.notes, `Keep notes under ${VENDOR_LIMITS.notes.toLocaleString('en-US')} characters`),
})

export type VendorFormDraft = z.input<typeof vendorSchema>
export type VendorFormValues = z.output<typeof vendorSchema>

export const EMPTY_VENDOR_VALUES: VendorFormDraft = {
  name: '',
  company: '',
  status: 'active',
  contactName: '',
  email: '',
  phone: '',
  categories: [],
  notes: '',
}

export function toVendorFormValues(vendor: Vendor): VendorFormDraft {
  return {
    name: vendor.name,
    company: vendor.company,
    status: vendor.active ? 'active' : 'inactive',
    contactName: vendor.contactName,
    email: vendor.email,
    phone: vendor.phone,
    categories: [...vendor.categories],
    notes: vendor.notes,
  }
}

export function toVendorInput(values: VendorFormValues): VendorInput {
  return {
    name: values.name,
    company: values.company,
    categories: values.categories,
    contactName: values.contactName,
    phone: values.phone,
    email: values.email,
    notes: values.notes,
    active: values.status === 'active',
  }
}

/** Service error fields → form fields. */
export const VENDOR_FIELD_MAP: Record<string, keyof VendorFormDraft> = {
  name: 'name',
  company: 'company',
  contactName: 'contactName',
  email: 'email',
  phone: 'phone',
  categories: 'categories',
  notes: 'notes',
  active: 'status',
}
