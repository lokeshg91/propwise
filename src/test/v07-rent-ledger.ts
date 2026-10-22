import { addDays, addMonths, parseIsoDate, todayIso, toIsoDate } from '@/data/domain/dates'
import { hashString } from '@/data/mock/tenancy-seed'
import { type Lease } from '@/types'

/** A month in the v0.7 generated ledger. */
export interface V07RentCharge {
  id: string
  leaseId: string
  period: string
  dueDate: string
  amount: number
  status: 'paid' | 'overdue' | 'scheduled' | 'pending'
  paidAt: string | null
  late: boolean
}
type RentCharge = V07RentCharge

/**
 * TEST ONLY — a frozen copy of the v0.7 tenant Payments ledger, which was
 * generated on every read and never stored. v0.8 replaced it with the stored
 * Finance ledger; tests use this copy to check the migrated history keeps the
 * months v0.7 showed paid, late or overdue.
 *
 * Demo rent ledger. Charges are generated from stored lease terms and a hash
 * of the lease id and period, so the same lease always produces the same
 * history; only the open charge moves with the calendar (upcoming → due).
 * These are sample records: Propwise does not process payments.
 */
export function generateRentLedger(lease: Lease, today: string = todayIso()): RentCharge[] {
  const charges: RentCharge[] = []
  const lastDate = lease.endedAt ?? (lease.status === 'pending' ? lease.startDate : addMonths(today, 1))
  const first = parseIsoDate(lease.startDate)
  let cursor = toIsoDate(new Date(first.getFullYear(), first.getMonth(), 1))

  while (cursor <= lastDate && charges.length < 120) {
    const period = cursor.slice(0, 7)
    const dueDate = `${period}-${String(lease.paymentDueDay).padStart(2, '0')}`
    if (dueDate >= lease.startDate && dueDate <= lastDate) {
      const roll = hashString(`${lease.id}:${period}`) % 100
      const base: Omit<RentCharge, 'status' | 'paidAt' | 'late'> = {
        id: `chg_${lease.id}_${period}`,
        leaseId: lease.id,
        period,
        dueDate,
        amount: lease.monthlyRent,
      }
      if (dueDate > today) {
        charges.push({ ...base, status: roll < 45 ? 'scheduled' : 'pending', paidAt: null, late: false })
      } else if (roll < 86) {
        const paidAt = addDays(dueDate, -(roll % 4))
        charges.push({ ...base, status: 'paid', paidAt: paidAt > today ? today : paidAt, late: false })
      } else if (roll < 97 || addDays(dueDate, 45) < today) {
        const paidAt = addDays(dueDate, 2 + (roll % 8))
        if (paidAt <= today) charges.push({ ...base, status: 'paid', paidAt, late: true })
        else charges.push({ ...base, status: 'overdue', paidAt: null, late: false })
      } else {
        charges.push({ ...base, status: 'overdue', paidAt: null, late: false })
      }
    }
    cursor = addMonths(cursor, 1)
  }

  return charges.reverse()
}
