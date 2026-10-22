/**
 * Phase 8 Stage 3: every Finance write, saved and failed.
 *
 * A failed save must reject with a StorageError, leave the in-memory data and
 * the stored data exactly as they were, and report the failure through the
 * storage status (which drives the banner). The same write then succeeds once
 * storage works again.
 */
import { addDays } from '@/data/domain/dates'
import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import {
  addLateFee,
  adjustCharge,
  createCharge,
  createExpense,
  createRecurringCharge,
  endRecurringCharge,
  getTransactionDetail,
  isFinanceDuplicateError,
  markExpensePaid,
  markExpenseUnpaid,
  recordPayment,
  updateCharge,
  updateExpense,
  updateFinanceSettings,
  voidCharge,
  voidExpense,
  voidPayment,
} from '@/data/services'
import {
  getStorageStatus,
  isStorageError,
  migrationHooks,
  readDatabase,
  resetDemoData,
  STORAGE_LIMIT_CHARS,
  storageHooks,
  type DemoDatabase,
} from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { STORAGE_KEYS } from '@/lib/storage'
import { type Charge } from '@/types'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
  storageHooks.limitChars = STORAGE_LIMIT_CHARS
  vi.restoreAllMocks()
  expect(checkFinanceIntegrity(readDatabase())).toEqual([])
  vi.useRealTimers()
})

const db = () => readDatabase()
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const rejection = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as Error & { field?: string; code?: string })
const lease = () => db().leases.find((entry) => entry.status === 'active' && !db().recurringCharges.some((recurring) => recurring.leaseId === entry.id)) ?? db().leases[0]
const activeVendor = () => db().vendors.find((vendor) => vendor.active)
const bill = { category: 'utilities' as const, payeeName: 'Larkspur Power & Water', propertyId: 'prop_101', description: 'Electricity', amountCents: 41000, billDate: TODAY }

/** Open rent charges with no payments and no late fee, due before `before`. */
function openRentCharges(before: string, type?: 'residential' | 'commercial'): Charge[] {
  const data = db()
  const payments = paymentsByCharge(data.payments)
  const fees = new Set(data.charges.map((charge) => charge.parentChargeId).filter(Boolean))
  const types = new Map(data.properties.map((property) => [property.id, property.type]))
  return data.charges.filter(
    (charge) =>
      charge.category === 'rent' &&
      !charge.voidedAt &&
      !fees.has(charge.id) &&
      (payments.get(charge.id) ?? []).length === 0 &&
      charge.dueDate < before &&
      (type === undefined || types.get(charge.propertyId) === type),
  )
}
const lateRent = (type?: 'residential' | 'commercial') => {
  const charge = openRentCharges(addDays(TODAY, -5), type)[0]
  if (!charge) throw new Error(`no late ${type ?? ''} rent charge`)
  return charge
}

/**
 * Each case sets up what it needs (with successful saves) and returns the
 * write under test, which is then run once failing and once succeeding.
 */
const CASES: [string, () => Promise<() => Promise<unknown>>][] = [
  ['createCharge (tenant)', async () => () => createCharge({ leaseId: lease()?.id, category: 'parking', description: 'Guest permit', amountCents: 2500, dueDate: TODAY })],
  [
    'createCharge (other payer, already received)',
    async () => () => createCharge({ propertyId: 'prop_101', payerName: 'Vending Co', category: 'other-income', description: 'Vending', amountCents: 9000, dueDate: TODAY }, { receivedNow: { receivedOn: TODAY, method: 'cash' } }),
  ],
  [
    'updateCharge',
    async () => {
      const charge = await createCharge({ propertyId: 'prop_101', payerName: 'Vending Co', category: 'other-income', description: 'Vending', amountCents: 9000, dueDate: TODAY })
      return () => updateCharge(charge.id, { payerName: 'Vending Co', description: 'Vending, October', amountCents: 9500, dueDate: addDays(TODAY, 3) })
    },
  ],
  ['adjustCharge', async () => () => adjustCharge(lateRent().id, lateRent().amountCents - 10000, 'Concession agreed')],
  [
    'voidCharge',
    async () => {
      const charge = await createCharge({ leaseId: lease()?.id, category: 'parking', description: 'Guest permit', amountCents: 2500, dueDate: TODAY })
      return () => voidCharge(charge.id, 'Billed by mistake')
    },
  ],
  ['recordPayment (partial)', async () => () => recordPayment(lateRent().id, { amountCents: 10000, receivedOn: TODAY, method: 'check', externalRef: '1042' })],
  [
    'voidPayment',
    async () => {
      const payment = await recordPayment(lateRent().id, { amountCents: 10000, receivedOn: TODAY, method: 'check' })
      return () => voidPayment(payment.id, 'Check returned')
    },
  ],
  ['addLateFee', async () => () => addLateFee(lateRent().id)],
  ['createRecurringCharge', async () => () => createRecurringCharge({ leaseId: lease()?.id ?? '', category: 'parking', description: 'Garage', amountCents: 9000, startPeriod: '2026-10' })],
  [
    'endRecurringCharge',
    async () => {
      const schedule = await createRecurringCharge({ leaseId: lease()?.id ?? '', category: 'parking', description: 'Garage', amountCents: 9000, startPeriod: '2026-10' })
      return () => endRecurringCharge(schedule.id, '2026-11')
    },
  ],
  ['createExpense (vendor)', async () => () => createExpense({ ...bill, payeeName: undefined, vendorId: activeVendor()?.id, category: 'maintenance', invoiceNumber: 'INV-9001' })],
  ['createExpense (already paid)', async () => () => createExpense(bill, { paidNow: { paidOn: TODAY, method: 'bank-transfer', paymentRef: 'ACH 7' } })],
  [
    'updateExpense',
    async () => {
      const expense = await createExpense(bill)
      return () => updateExpense(expense.id, { ...bill, amountCents: 42000, dueDate: addDays(TODAY, 14) })
    },
  ],
  [
    'markExpensePaid',
    async () => {
      const expense = await createExpense(bill)
      return () => markExpensePaid(expense.id, { paidOn: TODAY, method: 'bank-transfer' })
    },
  ],
  [
    'markExpenseUnpaid',
    async () => {
      const expense = await createExpense(bill, { paidNow: { paidOn: TODAY, method: 'bank-transfer' } })
      return () => markExpenseUnpaid(expense.id, 'Payment returned')
    },
  ],
  [
    'voidExpense',
    async () => {
      const expense = await createExpense(bill)
      return () => voidExpense(expense.id, 'Entered twice')
    },
  ],
  [
    'changeDueDate (work-order bill)',
    async () => {
      const expense = db().expenses.find((entry) => entry.source === 'work-order' && !entry.voidedAt)
      if (!expense) throw new Error('no work-order bill')
      const { category, vendorId, propertyId, description, amountCents, billDate } = expense
      return () => updateExpense(expense.id, { category, vendorId, propertyId, description, amountCents, billDate, dueDate: addDays(expense.dueDate, 7) })
    },
  ],
  ['updateFinanceSettings', async () => () => updateFinanceSettings({ currency: 'EUR', locale: 'de-DE' })],
]

/** Saves once so there is stored data to compare against. */
async function primeStorage() {
  await updateFinanceSettings({ currency: 'USD', locale: 'en-US' })
  expect(stored()).not.toBeNull()
}

async function expectFailureLeavesEverything(write: () => Promise<unknown>, code: string) {
  const memory = JSON.stringify(readDatabase())
  const raw = stored()
  const error = await rejection(write())
  expect(isStorageError(error)).toBe(true)
  expect(error?.code).toBe(code)
  expect(JSON.stringify(readDatabase())).toBe(memory)
  expect(stored()).toBe(raw)
  expect(getStorageStatus().lastError?.code).toBe(code)
}

describe.each(CASES)('%s', (_name, prepare) => {
  it('fails cleanly when the browser refuses to store, then saves once it works', async () => {
    await primeStorage()
    const write = await prepare()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    await expectFailureLeavesEverything(write, 'write-failed')
    spy.mockRestore()

    const before = stored()
    await expect(write()).resolves.toBeTruthy()
    expect(stored()).not.toBe(before)
    expect(getStorageStatus().lastError).toBeNull()
  })

  it('fails cleanly when storage is over budget', async () => {
    await primeStorage()
    const write = await prepare()
    storageHooks.limitChars = 1000
    await expectFailureLeavesEverything(write, 'over-budget')
    storageHooks.limitChars = STORAGE_LIMIT_CHARS
    await expect(write()).resolves.toBeTruthy()
  })
})

describe('suspended session (saved data could not be upgraded)', () => {
  /** Stores the seed as a Phase 7 (v4) save and makes its upgrade fail. */
  function suspend() {
    const seed = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    for (const key of ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance']) delete seed[key]
    seed.version = 4
    seed.sequences = { request: (readDatabase() as DemoDatabase).sequences.request }
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify(seed))
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated upgrade failure')
    }
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    readDatabase()
    expect(getStorageStatus().mode).toBe('suspended')
  }

  it.each(CASES)('%s is refused without changing anything', async (_name, prepare) => {
    // Set-up writes are refused too, so build the write first (on a working store)
    // where it doesn't need earlier saves; otherwise check the set-up itself is refused.
    suspend()
    const raw = stored()
    const memory = JSON.stringify(readDatabase())
    const error = await rejection(prepare().then((write) => write()))
    expect(isStorageError(error) && error.code).toBe('suspended')
    expect(stored()).toBe(raw)
    expect(JSON.stringify(readDatabase())).toBe(memory)
  })
})

describe('late fees (central rule)', () => {
  it('residential: a fixed $50, whatever the rent', async () => {
    const charge = lateRent('residential')
    const fee = await addLateFee(charge.id)
    expect(fee).toMatchObject({ amountCents: 5000, category: 'late-fee', source: 'late-fee', parentChargeId: charge.id, dueDate: TODAY })
  })

  it('commercial: 5% of the full rent charge rounded to cents, not of the balance', async () => {
    const charge = lateRent('commercial')
    await adjustCharge(charge.id, 123457, 'Rent review')
    await recordPayment(charge.id, { amountCents: 50000, receivedOn: TODAY, method: 'bank-transfer' })
    const fee = await addLateFee(charge.id)
    expect(fee.amountCents).toBe(6173) // 5% of 1,234.57 = 61.7285 → 61.73
  })

  it('commercial rounding goes half up at the cent', async () => {
    const charge = lateRent('commercial')
    await adjustCharge(charge.id, 100010, 'Rent review') // 5% = 50.005 → 50.01
    expect((await addLateFee(charge.id)).amountCents).toBe(5001)
  })

  it('is blocked through day 5 of the grace period and allowed from day 6', async () => {
    const charge = db().charges.find((entry) => entry.category === 'rent' && entry.dueDate === '2026-10-01' && openRentCharges('2026-10-02').some((open) => open.id === entry.id))
    if (!charge) throw new Error('no open October rent')
    vi.setSystemTime(new Date('2026-10-06T23:59:00'))
    expect(await rejection(addLateFee(charge.id))).toMatchObject({ message: 'The grace period hasn’t ended yet.' })
    expect(db().charges.some((entry) => entry.parentChargeId === charge.id)).toBe(false)
    vi.setSystemTime(new Date('2026-10-07T00:01:00'))
    expect((await addLateFee(charge.id)).parentChargeId).toBe(charge.id)
  })

  it('allows one late-fee record per charge, even after the fee is voided', async () => {
    const charge = lateRent()
    const fee = await addLateFee(charge.id)
    const message = 'A late fee was already added for this charge. Only one late fee per charge is allowed, even if it was voided.'
    expect(await rejection(addLateFee(charge.id))).toMatchObject({ message })
    await voidCharge(fee.id, 'Waived as a courtesy')
    expect(await rejection(addLateFee(charge.id))).toMatchObject({ message })
    // The voided fee is kept with its reason; nothing else was added.
    const fees = db().charges.filter((entry) => entry.parentChargeId === charge.id)
    expect(fees).toEqual([expect.objectContaining({ id: fee.id, voidReason: 'Waived as a courtesy', voidedBy: 'user', amountCents: fee.amountCents })])
    const detail = await getTransactionDetail(charge.id)
    expect(detail?.kind === 'income' && detail.lateFee?.id).toBe(fee.id)
    expect(detail?.kind === 'income' && detail.lateFeeAllowed).toMatchObject({ allowed: false, reason: message })
  })

  it('applies to rent only and only while a balance is open', async () => {
    const parking = await createCharge({ leaseId: lease()?.id, category: 'parking', description: 'Permit', amountCents: 2500, dueDate: addDays(TODAY, -20), issuedOn: addDays(TODAY, -30) })
    expect(await rejection(addLateFee(parking.id))).toMatchObject({ message: 'Late fees apply to rent charges only.' })
    const charge = lateRent()
    await recordPayment(charge.id, { amountCents: charge.amountCents, receivedOn: TODAY, method: 'cash' })
    expect(await rejection(addLateFee(charge.id))).toMatchObject({ message: 'This charge is paid in full.' })
    const fee = db().charges.find((entry) => entry.category === 'late-fee' && !entry.voidedAt) as Charge
    expect(await rejection(addLateFee(fee.id))).toMatchObject({ message: 'Late fees apply to rent charges only.' })
  })

  it('is never added automatically, even months later', async () => {
    await primeStorage()
    const fees = () => db().charges.filter((charge) => charge.category === 'late-fee').length
    const before = fees()
    const raw = stored() ?? ''
    resetDemoData()
    vi.setSystemTime(new Date('2027-01-20T12:00:00'))
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    const later = readDatabase()
    expect(later.charges.some((charge) => charge.period === '2027-01' && charge.category === 'rent')).toBe(true)
    expect(fees()).toBe(before)
    const open = later.charges.filter((charge) => charge.category === 'rent' && chargeState(charge, paymentsByCharge(later.payments).get(charge.id), '2027-01-20').balanceCents > 0)
    expect(open.length).toBeGreaterThan(0)
  })
})

describe('duplicate prevention', () => {
  it('warns about a look-alike charge and saves it only when confirmed', async () => {
    const input = { propertyId: 'prop_101', payerName: 'Vending Co', category: 'other-income' as const, description: 'Vending', amountCents: 9000, dueDate: TODAY }
    await createCharge(input)
    const count = db().charges.length
    const warning = await rejection(createCharge({ ...input, payerName: ' VENDING co ' }))
    expect(isFinanceDuplicateError(warning) && warning.requiresConfirmation).toBe(true)
    expect(db().charges).toHaveLength(count)
    await createCharge(input, { acknowledgeDuplicate: true })
    expect(db().charges).toHaveLength(count + 1)
  })

  it('warns about a repeated payment and saves it only when confirmed', async () => {
    const charge = lateRent()
    await recordPayment(charge.id, { amountCents: 10000, receivedOn: TODAY, method: 'check' })
    const warning = await rejection(recordPayment(charge.id, { amountCents: 10000, receivedOn: TODAY, method: 'cash' }))
    expect(isFinanceDuplicateError(warning) && warning.requiresConfirmation).toBe(true)
    expect(db().payments.filter((payment) => payment.chargeId === charge.id)).toHaveLength(1)
    await recordPayment(charge.id, { amountCents: 10000, receivedOn: TODAY, method: 'cash' }, { acknowledgeDuplicate: true })
    expect(db().payments.filter((payment) => payment.chargeId === charge.id)).toHaveLength(2)
  })

  it('blocks a repeated invoice number for the same payee, even when confirmed', async () => {
    await createExpense({ ...bill, invoiceNumber: 'LPW-77' })
    const blocked = await rejection(createExpense({ ...bill, invoiceNumber: 'lpw 77', amountCents: 1 }, { acknowledgeDuplicate: true }))
    expect(isFinanceDuplicateError(blocked) && !blocked.requiresConfirmation).toBe(true)
    // Another payee may use the same number.
    await expect(createExpense({ ...bill, payeeName: 'Other Utility', invoiceNumber: 'LPW-77' })).resolves.toBeTruthy()
  })

  it('warns about a look-alike bill without an invoice number', async () => {
    await createExpense(bill)
    const warning = await rejection(createExpense(bill))
    expect(isFinanceDuplicateError(warning) && warning.requiresConfirmation).toBe(true)
    await expect(createExpense(bill, { acknowledgeDuplicate: true })).resolves.toBeTruthy()
  })

  it('checks duplicates on edit too', async () => {
    const input = { propertyId: 'prop_101', payerName: 'Vending Co', category: 'other-income' as const, description: 'Vending', amountCents: 9000, dueDate: TODAY }
    await createCharge(input)
    const second = await createCharge({ ...input, amountCents: 9100 })
    const warning = await rejection(updateCharge(second.id, { ...input, amountCents: 9000 }))
    expect(isFinanceDuplicateError(warning) && warning.requiresConfirmation).toBe(true)
    expect(db().charges.find((charge) => charge.id === second.id)?.amountCents).toBe(9100)
  })
})
