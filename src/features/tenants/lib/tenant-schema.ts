import { z } from 'zod'

import { addDays, addMonths, monthsBetween, todayIso } from '@/data/domain/dates'
import { MAX_DEPOSIT_MULTIPLE, type TenantDetail } from '@/data/services'
import { numberField } from '@/lib/form-schema'
import { TENANT_KINDS, type TenantInput } from '@/types'

const PHONE_DIGITS = /\d/g
const isPhone = (value: string) => (value.match(PHONE_DIGITS)?.length ?? 0) >= 10 && /^[\d\s()+.-]+$/.test(value)

/**
 * Tenant form. The lease block is required when adding a tenant and optional
 * for past tenants (start a new lease). Rules match the tenant service, which
 * validates again on save.
 */
export function createTenantSchema({ requireLease, today = todayIso() }: { requireLease: boolean; today?: string }) {
  return z
    .object({
      kind: z.enum(TENANT_KINDS),
      name: z.string().trim().min(2, 'Enter the tenant’s name').max(80, 'Keep the name under 80 characters'),
      email: z.string().trim().min(1, 'Enter an email address').pipe(z.email('Enter a valid email address')),
      phone: z
        .string()
        .trim()
        .min(1, 'Enter a phone number')
        .refine(isPhone, 'Enter a valid phone number, e.g. (512) 555-0134'),
      street: z.string().trim().min(3, 'Enter the street address'),
      city: z.string().trim().min(2, 'Enter the city'),
      state: z.string().min(2, 'Choose a state'),
      postalCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
      hasEmergencyContact: z.boolean(),
      emergencyName: z.string().trim(),
      emergencyPhone: z.string().trim(),
      emergencyRelationship: z.string().trim(),
      notes: z.string().trim().max(500, 'Keep notes under 500 characters'),

      assignLease: z.boolean(),
      propertyId: z.string(),
      unitId: z.string(),
      leaseStatus: z.enum(['active', 'pending']),
      startDate: z.string(),
      endDate: z.string(),
      monthlyRent: numberField('the monthly rent').nullable(),
      securityDeposit: numberField('the deposit').min(0, 'Deposit can’t be negative').nullable(),
      paymentDueDay: numberField('the due day')
        .int('Use a whole day of the month')
        .min(1, 'Choose a day from 1 to 28')
        .max(28, 'Choose a day from 1 to 28')
        .nullable(),
    })
    .superRefine((values, context) => {
      const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })

      if (values.hasEmergencyContact) {
        if (values.emergencyName.length < 2) issue('emergencyName', 'Enter the contact’s name')
        if (!isPhone(values.emergencyPhone)) issue('emergencyPhone', 'Enter a valid phone number')
        if (values.emergencyRelationship.length < 2) issue('emergencyRelationship', 'Enter the relationship, e.g. Parent')
      }

      if (!requireLease && !values.assignLease) return
      if (!values.propertyId) issue('propertyId', 'Choose a property')
      if (!values.unitId) issue('unitId', 'Choose an available unit')
      if (!values.startDate) issue('startDate', 'Choose the lease start date')
      if (!values.endDate) issue('endDate', 'Choose the lease end date')
      if (values.startDate && values.endDate) {
        if (values.endDate <= values.startDate) issue('endDate', 'Lease end must be after the start date')
        else if (monthsBetween(values.startDate, values.endDate) > 120) issue('endDate', 'Leases can be at most 10 years long')
      }
      if (values.startDate && values.leaseStatus === 'active' && values.startDate > today) {
        issue('startDate', 'A lease starting in the future must be Pending')
      }
      if (values.startDate && values.leaseStatus === 'pending' && values.startDate <= today) {
        issue('startDate', 'A pending lease must start after today')
      }
      if (values.monthlyRent === null) issue('monthlyRent', 'Enter the monthly rent')
      else if (values.monthlyRent <= 0) issue('monthlyRent', 'Rent must be above $0')
      else if (values.monthlyRent > 1_000_000) issue('monthlyRent', 'Rent looks too large')
      if (values.securityDeposit === null) issue('securityDeposit', 'Enter the security deposit, or 0')
      else if (values.monthlyRent !== null && values.monthlyRent > 0 && values.securityDeposit > values.monthlyRent * MAX_DEPOSIT_MULTIPLE) {
        issue('securityDeposit', `Deposit can be at most ${MAX_DEPOSIT_MULTIPLE}× the monthly rent`)
      }
      if (values.paymentDueDay === null) issue('paymentDueDay', 'Enter the rent due day')
    })
}

export type TenantFormDraft = z.input<ReturnType<typeof createTenantSchema>>
export type TenantFormValues = z.output<ReturnType<typeof createTenantSchema>>

export function emptyTenantValues(prefill: { propertyId?: string; unitId?: string; rent?: number } = {}): TenantFormDraft {
  const today = todayIso()
  return {
    kind: 'individual',
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    hasEmergencyContact: false,
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    notes: '',
    assignLease: true,
    propertyId: prefill.propertyId ?? '',
    unitId: prefill.unitId ?? '',
    leaseStatus: 'active',
    startDate: today,
    endDate: addDays(addMonths(today, 12), -1),
    monthlyRent: prefill.rent ?? null,
    securityDeposit: prefill.rent ?? null,
    paymentDueDay: 1,
  }
}

/** Form values for an existing tenant; the lease block mirrors their current lease. */
export function toTenantFormValues(detail: TenantDetail): TenantFormDraft {
  const { tenant } = detail
  const current = detail.lease && (detail.lease.status === 'active' || detail.lease.status === 'pending') ? detail.lease : null
  const base = emptyTenantValues()
  return {
    ...base,
    kind: tenant.kind,
    name: tenant.name,
    email: tenant.email,
    phone: tenant.phone,
    street: tenant.mailingAddress.street,
    city: tenant.mailingAddress.city,
    state: tenant.mailingAddress.state,
    postalCode: tenant.mailingAddress.postalCode,
    hasEmergencyContact: tenant.emergencyContact !== null,
    emergencyName: tenant.emergencyContact?.name ?? '',
    emergencyPhone: tenant.emergencyContact?.phone ?? '',
    emergencyRelationship: tenant.emergencyContact?.relationship ?? '',
    notes: tenant.notes ?? '',
    ...(current
      ? {
          assignLease: true,
          propertyId: current.propertyId,
          unitId: current.unitId,
          leaseStatus: current.status === 'pending' ? 'pending' : 'active',
          startDate: current.startDate,
          endDate: current.endDate,
          monthlyRent: current.monthlyRent,
          securityDeposit: current.securityDeposit,
          paymentDueDay: current.paymentDueDay,
        }
      : { assignLease: false }),
  }
}

export function toTenantInput(values: TenantFormValues): TenantInput {
  return {
    kind: values.kind,
    name: values.name,
    email: values.email,
    phone: values.phone,
    mailingAddress: { street: values.street, city: values.city, state: values.state, postalCode: values.postalCode },
    emergencyContact: values.hasEmergencyContact
      ? { name: values.emergencyName, phone: values.emergencyPhone, relationship: values.emergencyRelationship }
      : null,
    notes: values.notes,
    lease: values.assignLease
      ? {
          propertyId: values.propertyId,
          unitId: values.unitId,
          startDate: values.startDate,
          endDate: values.endDate,
          monthlyRent: values.monthlyRent ?? 0,
          securityDeposit: values.securityDeposit ?? 0,
          paymentDueDay: values.paymentDueDay ?? 1,
          status: values.leaseStatus,
        }
      : null,
  }
}

/** Form fields that a tenant-service error can point at. */
export const SERVICE_FIELD_MAP: Record<string, keyof TenantFormDraft> = {
  email: 'email',
  unitId: 'unitId',
  propertyId: 'propertyId',
  startDate: 'startDate',
  endDate: 'endDate',
  monthlyRent: 'monthlyRent',
  securityDeposit: 'securityDeposit',
  paymentDueDay: 'paymentDueDay',
  status: 'leaseStatus',
}
