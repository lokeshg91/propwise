import { chargeState, graceFor, paymentsByCharge, ruleFor, suggestedLateFeeCents } from '@/data/domain/finance-rules'
import {
  addRuleVersion,
  CURRENCY_OPTIONS,
  getSettings,
  readFormatters,
  REGION_OPTIONS,
  updateCurrency,
  updateFinanceSettings,
  updateGeneralSettings,
  updatePaymentTerms,
  updateRegion,
} from '@/data/services'
import { isServiceError } from '@/data/services/service-error'
import {
  isStorageError,
  migrationHooks,
  readDatabase,
  resetDemoData,
  serializeDatabase,
  STORAGE_LIMIT_CHARS,
  storageHooks,
  type DemoDatabase,
} from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { STORAGE_KEYS } from '@/lib/storage'
import { type FinanceRuleVersion } from '@/types'

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
  vi.useRealTimers()
})

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )
const RULE = { effectiveFrom: '2026-11-01', graceDays: 3, residentialCents: 7500, commercialPercent: 4 }

/** Outcome of every charge, keyed by id. */
function outcomes(db: DemoDatabase) {
  const payments = paymentsByCharge(db.payments)
  const types = new Map(db.properties.map((property) => [property.id, property.type]))
  return new Map(
    db.charges.map((charge) => [
      charge.id,
      JSON.stringify([
        chargeState(charge, payments.get(charge.id), TODAY, graceFor(db.finance, charge)),
        suggestedLateFeeCents(charge, types.get(charge.propertyId) ?? 'residential', ruleFor(db.finance, charge.dueDate)),
      ]),
    ]),
  )
}

describe('rule versions', () => {
  it('picks the rule in force on a charge’s due date', () => {
    const rules: FinanceRuleVersion[] = [
      { id: 'a', effectiveFrom: '2025-11-01', graceDays: 5, lateFee: { residentialCents: 5000, commercialPercent: 5 }, createdAt: '' },
      { id: 'b', effectiveFrom: '2026-11-01', graceDays: 3, lateFee: { residentialCents: 7500, commercialPercent: 4 }, createdAt: '' },
      { id: 'c', effectiveFrom: '2027-02-01', graceDays: 0, lateFee: { residentialCents: 0, commercialPercent: 0 }, createdAt: '' },
    ]
    expect(ruleFor({ rules }, '2025-01-01').id).toBe('a') // before history: the first rule
    expect(ruleFor({ rules }, '2026-10-31').id).toBe('a')
    expect(ruleFor({ rules }, '2026-11-01').id).toBe('b') // the start date is inclusive
    expect(ruleFor({ rules }, '2027-01-31').id).toBe('b')
    expect(ruleFor({ rules }, '2027-02-01').id).toBe('c')
    expect(() => ruleFor({ rules: [] }, TODAY)).toThrow(/no rule version/)
  })

  it('adds a future version without changing any charge due before it', async () => {
    const before = outcomes(readDatabase())
    const settings = await addRuleVersion(RULE)
    expect(settings.rules).toHaveLength(2)
    expect(settings.currentRule.id).toBe('rule_initial')
    expect(settings.upcomingRules).toEqual([expect.objectContaining({ effectiveFrom: '2026-11-01', graceDays: 3, lateFee: { residentialCents: 7500, commercialPercent: 4 } })])
    const db = readDatabase()
    const after = outcomes(db)
    for (const charge of db.charges) {
      if (charge.dueDate < RULE.effectiveFrom) expect(after.get(charge.id)).toBe(before.get(charge.id))
    }
    expect(checkFinanceIntegrity(db)).toEqual([])
    // Rent due on or after the start date uses the new rule.
    expect(ruleFor(db.finance, '2026-11-05')).toMatchObject({ graceDays: 3 })
    expect(db.settingsEvents.at(-1)).toMatchObject({
      section: 'rules',
      title: 'Rent and late-fee rule added',
      before: '5 grace days, residential $50.00, commercial 5%',
      after: '3 grace days, residential $75.00, commercial 4%',
    })
  })

  it('can start today; never in the past, twice on one date or with the same values', async () => {
    await expect(addRuleVersion({ ...RULE, effectiveFrom: TODAY })).resolves.toMatchObject({ currentRule: { effectiveFrom: TODAY } })
    resetDemoData()
    const past = await failure(addRuleVersion({ ...RULE, effectiveFrom: '2026-10-11' }))
    expect(isServiceError(past) && past.field).toBe('effectiveFrom')
    await addRuleVersion(RULE)
    const twice = await failure(addRuleVersion({ ...RULE, graceDays: 4 }))
    expect(isServiceError(twice) && twice.code).toBe('conflict')
    const same = await failure(addRuleVersion({ ...RULE, effectiveFrom: '2026-12-01' }))
    expect(isServiceError(same) && same.message).toMatch(/already in force/)
    const invalidDate = await failure(addRuleVersion({ ...RULE, effectiveFrom: '2026-13-45' }))
    expect(isServiceError(invalidDate) && invalidDate.field).toBe('effectiveFrom')
  })

  it('validates the values and saves nothing when they’re wrong', async () => {
    const raw = stored()
    for (const [input, field] of [
      [{ graceDays: 32 }, 'graceDays'],
      [{ graceDays: 1.5 }, 'graceDays'],
      [{ residentialCents: -1 }, 'residentialCents'],
      [{ residentialCents: 100001 }, 'residentialCents'],
      [{ commercialPercent: 26 }, 'commercialPercent'],
      [{ commercialPercent: 1.234 }, 'commercialPercent'],
    ] as const) {
      const error = await failure(addRuleVersion({ ...RULE, ...input }))
      expect(isServiceError(error) && error.field).toBe(field)
    }
    expect(stored()).toBe(raw)
    expect(readDatabase().finance.rules).toHaveLength(1)
  })

  it('inserts versions in date order and keeps earlier versions unchanged', async () => {
    await addRuleVersion({ ...RULE, effectiveFrom: '2027-03-01', graceDays: 7 })
    const first = structuredClone(readDatabase().finance.rules)
    await addRuleVersion(RULE)
    const rules = readDatabase().finance.rules
    expect(rules.map((rule) => rule.effectiveFrom)).toEqual(['2025-11-01', '2026-11-01', '2027-03-01'])
    for (const rule of first) expect(rules).toContainEqual(rule)
  })
})

describe('workspace settings', () => {
  it('reads the defaults', async () => {
    const settings = await getSettings()
    expect(settings).toMatchObject({
      currency: 'USD',
      currencyName: 'US dollar',
      locale: 'en-US',
      regionName: 'United States',
      paymentTermsDays: 30,
      appSettings: { defaultReportRange: '12m' },
      events: [],
    })
    expect(settings.appVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('relabels the currency without converting anything and records it', async () => {
    const before = structuredClone(readDatabase())
    await updateCurrency('eur')
    const db = readDatabase()
    expect(db.finance.currency).toBe('EUR')
    for (const key of ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'units', 'leases', 'workOrders', 'maintenanceEvents'] as const) {
      expect(db[key]).toEqual(before[key])
    }
    expect(db.settingsEvents).toEqual([expect.objectContaining({ section: 'finance', title: 'Currency changed', before: 'US dollar (USD)', after: 'Euro (EUR)' })])
    expect(db.settingsEvents[0]?.description).toMatch(/relabelled, not converted/)
    expect(readFormatters().money(125050)).toBe('€1,250.50')
  })

  it('changes the region for number and date formats', async () => {
    await updateRegion('en-GB')
    expect(readDatabase().finance.locale).toBe('en-GB')
    expect(readFormatters().date('2026-10-24')).toBe('24 Oct 2026')
    expect(readDatabase().settingsEvents.at(-1)).toMatchObject({ section: 'general', before: 'United States', after: 'United Kingdom' })
  })

  it('only offers the listed currencies and regions', async () => {
    expect(isServiceError(await failure(updateCurrency('JPY')))).toBe(true)
    expect(isServiceError(await failure(updateCurrency('XYZ')))).toBe(true)
    expect(isServiceError(await failure(updateRegion('fr-FR')))).toBe(true)
    expect(isServiceError(await failure(updateRegion('not a locale')))).toBe(true)
    expect(CURRENCY_OPTIONS.length).toBeGreaterThanOrEqual(20)
    for (const option of REGION_OPTIONS) expect(option.locale.startsWith('en')).toBe(true)
  })

  it('updates payment terms and the default report period with history', async () => {
    await updatePaymentTerms(14)
    await updateGeneralSettings({ defaultReportRange: 'ytd' })
    const settings = await getSettings()
    expect(settings.paymentTermsDays).toBe(14)
    expect(settings.appSettings.defaultReportRange).toBe('ytd')
    expect(settings.events.map((event) => event.title)).toEqual(['Default report period changed', 'Bill payment terms changed'])
    expect(isServiceError(await failure(updatePaymentTerms(121)))).toBe(true)
    expect(isServiceError(await failure(updatePaymentTerms(2.5)))).toBe(true)
    expect(isServiceError(await failure(updateGeneralSettings({ defaultReportRange: 'forever' as never })))).toBe(true)
  })

  it('writes nothing and records nothing when a value is unchanged', async () => {
    readDatabase()
    const raw = stored()
    await updateCurrency('USD')
    await updateRegion('en-US')
    await updatePaymentTerms(30)
    await updateGeneralSettings({ defaultReportRange: '12m' })
    expect(stored()).toBe(raw)
    expect(readDatabase().settingsEvents).toEqual([])
  })

  it('keeps the Finance settings update (v0.8 API) working through the same rules', async () => {
    await updateFinanceSettings({ currency: 'GBP', locale: 'en-GB' })
    expect(readDatabase().finance).toMatchObject({ currency: 'GBP', locale: 'en-GB' })
    expect(readDatabase().settingsEvents.map((event) => event.title)).toEqual(['Currency changed', 'Region changed'])
  })
})

describe('failed saves leave settings unchanged', () => {
  const changes = [
    ['currency', () => updateCurrency('EUR')],
    ['region', () => updateRegion('en-GB')],
    ['payment terms', () => updatePaymentTerms(10)],
    ['report period', () => updateGeneralSettings({ defaultReportRange: '6m' })],
    ['rule version', () => addRuleVersion(RULE)],
  ] as const

  it.each(changes)('%s: storage refuses the write', async (_label, change) => {
    const before = structuredClone(readDatabase())
    const raw = stored()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const error = await failure(change())
    expect(isStorageError(error) && error.code).toBe('write-failed')
    expect(readDatabase()).toEqual(before)
    expect(stored()).toBe(raw)
  })

  it.each(changes)('%s: the save would exceed the storage budget', async (_label, change) => {
    const before = structuredClone(readDatabase())
    storageHooks.limitChars = Math.ceil((serializeDatabase(before).length + STORAGE_KEYS.demoData.length) / 0.95)
    const error = await failure(change())
    expect(isStorageError(error) && error.code).toBe('over-budget')
    expect(readDatabase()).toEqual(before)
  })

  it.each(changes)('%s: the session is read-only', async (_label, change) => {
    // Saved v4 data whose upgrade fails puts the session in read-only mode.
    const seed = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    for (const key of ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance', 'appSettings', 'settingsEvents']) delete seed[key]
    seed.version = 4
    seed.sequences = { request: readDatabase().sequences.request }
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify(seed))
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated upgrade failure')
    }
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const raw = stored()
    const before = structuredClone(readDatabase())
    const error = await failure(change())
    expect(isStorageError(error) && error.code).toBe('suspended')
    expect(stored()).toBe(raw)
    expect(readDatabase()).toEqual(before)
  })
})
