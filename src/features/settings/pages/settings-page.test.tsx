import { screen, waitFor, within } from '@testing-library/react'

import { createProperty, createBackup, serializeBackup } from '@/data/services'
import { migrationHooks, parseStoredDatabase, readDatabase, resetDemoData, serializeDatabase, type DemoDatabase } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'

/** Phase 9 Stage 2: the Settings screens and their workflows. */

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const toasts = () => Array.from(document.querySelectorAll('[data-sonner-toast]'), (node) => node.textContent ?? '')
const refuseWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string) {
    if (key === STORAGE_KEYS.demoData) throw new DOMException('Quota exceeded', 'QuotaExceededError')
  })

let downloads: Array<{ name: string; text: Promise<string> }>
beforeEach(() => {
  resetDemoData()
  window.localStorage.removeItem(STORAGE_KEYS.theme)
  downloads = []
  Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => (downloads.push({ name: '', text: blob.text() }), `blob:${downloads.length}`)), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const last = downloads.at(-1)
    if (last) last.name = this.download
  })
})
afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
  vi.restoreAllMocks()
})

async function open(tab: string) {
  const app = renderApp(`/settings?tab=${tab}`)
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
  return app
}

async function addUserProperty() {
  await createProperty({ name: 'Settings Test Plaza', type: 'residential', status: 'stable', street: '3 Test Street', city: 'Austin', state: 'TX', postalCode: '78701', totalUnits: 2, description: '', yearBuilt: null, areaSqft: null })
}

describe('General', () => {
  it('applies the theme straight away and keeps it in this browser', async () => {
    const { user } = await open('general')
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('saves the region with a live preview; Save stays disabled until something changes', async () => {
    const { user } = await open('general')
    const card = screen.getByRole('heading', { name: 'Region' }).closest('form') as HTMLElement
    const save = within(card).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.click(within(card).getByRole('combobox', { name: 'Region' }))
    await user.click(await screen.findByRole('option', { name: 'United Kingdom (en-GB)' }))
    expect(within(card).getByText('24 Oct 2026')).toBeInTheDocument()
    expect(save).toBeEnabled()
    await user.click(save)
    await waitFor(() => expect(readDatabase().finance.locale).toBe('en-GB'))
    expect(await screen.findByText('Region saved')).toBeInTheDocument()
    expect(readDatabase().settingsEvents.at(-1)).toMatchObject({ title: 'Region changed', after: 'United Kingdom' })
  })

  it('saves the default report period', async () => {
    const { user } = await open('general')
    const card = screen.getByRole('heading', { name: 'Default report period' }).closest('form') as HTMLElement
    await user.click(within(card).getByRole('combobox', { name: 'Report period' }))
    await user.click(await screen.findByRole('option', { name: 'Year to date' }))
    await user.click(within(card).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(readDatabase().appSettings.defaultReportRange).toBe('ytd'))
    expect(readDatabase().settingsEvents.at(-1)).toMatchObject({ before: 'Last 12 months', after: 'Year to date' })
  })

  it('shows a failed save next to the form, changes nothing and shows no success message', async () => {
    readDatabase()
    const { user } = await open('general')
    const before = stored()
    const shown = toasts().length
    const card = screen.getByRole('heading', { name: 'Region' }).closest('form') as HTMLElement
    await user.click(within(card).getByRole('combobox', { name: 'Region' }))
    await user.click(await screen.findByRole('option', { name: 'Australia (en-AU)' }))
    refuseWrites()
    await user.click(within(card).getByRole('button', { name: 'Save' }))
    expect(await within(card).findByRole('alert')).toHaveTextContent(/wasn’t saved/)
    expect(readDatabase().finance.locale).toBe('en-US')
    expect(stored()).toBe(before)
    expect(toasts().slice(shown).some((text) => text.includes('Region saved'))).toBe(false)
  })
})

describe('Finance', () => {
  it('asks for confirmation that the currency is relabelled, not converted', async () => {
    const { user } = await open('finance')
    expect(screen.getByText(/Relabels, doesn’t convert/)).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Workspace currency' }))
    await user.click(await screen.findByRole('option', { name: 'Euro (EUR)' }))
    await user.click(screen.getByRole('button', { name: 'Change currency…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change the currency to Euro?' })
    expect(within(dialog).getByText(/relabelled, not converted/)).toBeInTheDocument()
    expect(within(dialog).getByText('$1,250.50')).toBeInTheDocument()
    expect(within(dialog).getByText('€1,250.50')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(readDatabase().finance.currency).toBe('USD')

    await user.click(screen.getByRole('button', { name: 'Change currency…' }))
    const again = await screen.findByRole('dialog')
    const amounts = structuredClone(readDatabase().charges)
    await user.click(within(again).getByRole('button', { name: 'Relabel as EUR' }))
    await waitFor(() => expect(readDatabase().finance.currency).toBe('EUR'))
    expect(readDatabase().charges).toEqual(amounts)
    expect(await screen.findByText('Currency changed')).toBeInTheDocument()
  })

  it('validates and saves bill payment terms', async () => {
    const { user } = await open('finance')
    const field = screen.getByRole('spinbutton', { name: /Days from bill date/ })
    await user.clear(field)
    await user.type(field, '500')
    const card = field.closest('form') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Save' }))
    expect(within(card).getByText(/whole number of days from 0 to 120/)).toBeInTheDocument()
    expect(readDatabase().finance.paymentTermsDays).toBe(30)
    await user.clear(field)
    await user.type(field, '14')
    await user.click(within(card).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(readDatabase().finance.paymentTermsDays).toBe(14))
  })
})

describe('Rent & late fees', () => {
  it('adds a future rule version after a review and lists it read-only', async () => {
    const { user } = await open('rules')
    expect(screen.getByRole('heading', { name: 'Rule in force today' })).toBeInTheDocument()
    const grace = screen.getByRole('spinbutton', { name: /Grace period/ })
    await user.clear(grace)
    await user.type(grace, '3')
    await user.click(screen.getByRole('button', { name: 'Review rule…' }))
    const dialog = await screen.findByRole('dialog', { name: /Add a rule from/ })
    expect(within(dialog).getByText(/can’t be edited or removed later/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add rule version' }))
    await waitFor(() => expect(readDatabase().finance.rules).toHaveLength(2))
    const history = await screen.findByRole('table', { name: 'Rent and late-fee rule versions' })
    expect(await within(history).findByText('Upcoming')).toBeInTheDocument()
    expect(within(history).getAllByRole('row')).toHaveLength(3)
    // Read-only: no edit or delete controls anywhere in the history.
    expect(within(history).queryAllByRole('button')).toHaveLength(0)
  })

  it('refuses a past start date, an unchanged rule and out-of-range values before saving', async () => {
    const { user } = await open('rules')
    const date = screen.getByLabelText(/Applies to rent due from/)
    await user.clear(date)
    await user.type(date, '2020-01-01')
    await user.click(screen.getByRole('button', { name: 'Review rule…' }))
    expect(screen.getByText(/Choose today or a later date/)).toBeInTheDocument()
    await user.clear(date)
    await user.type(date, '2099-01-01')
    await user.click(screen.getByRole('button', { name: 'Review rule…' }))
    expect(screen.getByText(/already in force on that date/)).toBeInTheDocument()
    const percent = screen.getByRole('spinbutton', { name: /Commercial late fee/ })
    await user.clear(percent)
    await user.type(percent, '30')
    await user.click(screen.getByRole('button', { name: 'Review rule…' }))
    expect(screen.getByText(/percentage from 0 to 25/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(readDatabase().finance.rules).toHaveLength(1)
  })
})

describe('Data & storage', () => {
  it('shows storage use and downloads a backup of the stored data', async () => {
    await addUserProperty()
    const { user } = await open('data')
    expect(screen.getByRole('meter', { name: 'Browser storage used' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Download backup' }))
    expect(await screen.findByText(/Checked: this file can be restored/)).toBeInTheDocument()
    expect(downloads).toHaveLength(1)
    expect(downloads[0]?.name).toMatch(/^propwise-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
    const backup = JSON.parse(await (downloads[0] as { text: Promise<string> }).text) as { data: string; appVersion: string; savedDataVersion: number }
    expect(backup.data).toBe(stored())
    expect(backup.savedDataVersion).toBe(6)
  })

  it('reset: needs a downloaded backup and the word RESET, then saves the sample workspace', async () => {
    await addUserProperty()
    window.localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, 'true')
    const { user } = await open('data')
    await user.click(screen.getByRole('button', { name: 'Reset workspace…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset the whole workspace?' })
    expect(within(dialog).getByText(/All data in this browser will be deleted/)).toBeInTheDocument()
    expect(within(dialog).getByText(/1 record you created/)).toBeInTheDocument()
    expect(within(dialog).getByRole('table', { name: 'Records that will be deleted' })).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Delete everything and reset' })
    await user.type(within(dialog).getByRole('textbox', { name: /Type RESET/ }), 'RESET')
    expect(confirm).toBeDisabled() // no backup yet
    await user.click(within(dialog).getByRole('button', { name: 'Download backup' }))
    expect(confirm).toBeEnabled()
    await user.clear(within(dialog).getByRole('textbox', { name: /Type RESET/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /Type RESET/ }), 'reset')
    expect(confirm).toBeDisabled() // exact word only
    await user.clear(within(dialog).getByRole('textbox', { name: /Type RESET/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /Type RESET/ }), 'RESET')
    await user.click(confirm)
    expect(await screen.findByText('Workspace reset')).toBeInTheDocument()
    expect(readDatabase().properties.some((property) => property.name === 'Settings Test Plaza')).toBe(false)
    expect(parseStoredDatabase(stored() ?? '')).toEqual(readDatabase())
    expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe('true')
  })

  it('reset: a failed save deletes nothing and shows no success message', async () => {
    await addUserProperty()
    const { user } = await open('data')
    const before = stored()
    const shown = toasts().length
    await user.click(screen.getByRole('button', { name: 'Reset workspace…' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Download backup' }))
    await user.type(within(dialog).getByRole('textbox', { name: /Type RESET/ }), 'RESET')
    refuseWrites()
    await user.click(within(dialog).getByRole('button', { name: 'Delete everything and reset' }))
    expect(await within(dialog).findByText(/Nothing was deleted/)).toBeInTheDocument()
    expect(stored()).toBe(before)
    expect(readDatabase().properties.some((property) => property.name === 'Settings Test Plaza')).toBe(true)
    expect(toasts().slice(shown).some((text) => text.includes('Workspace reset'))).toBe(false)
  })

  it('restore: checks the file, needs a current backup and RESTORE, then replaces the workspace', async () => {
    await addUserProperty()
    const original = structuredClone(readDatabase())
    const file = new File([serializeBackup(createBackup())], 'propwise-backup-test.json', { type: 'application/json' })
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, serializeDatabase(readDatabase()))
    const { user } = await open('data')
    await user.upload(screen.getByLabelText('Backup file'), file)
    expect(await screen.findByText('This backup can be restored.')).toBeInTheDocument()
    expect(screen.getByText('propwise-backup-test.json')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore this backup…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Restore from backup' })
    const confirm = within(dialog).getByRole('button', { name: 'Replace workspace with backup' })
    await user.type(within(dialog).getByRole('textbox', { name: /Type RESTORE/ }), 'RESTORE')
    expect(confirm).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Download backup' }))
    expect(downloads).toHaveLength(1)
    await user.click(confirm)
    expect(await screen.findByText('Workspace restored')).toBeInTheDocument()
    expect(readDatabase()).toEqual(original)
  })

  it('restore: an invalid file can’t be restored and nothing changes', async () => {
    await addUserProperty()
    const before = stored()
    const { user } = await open('data')
    await user.upload(screen.getByLabelText('Backup file'), new File(['{"app":"other"}'], 'notes.json', { type: 'application/json' }))
    expect(await screen.findByText('This file can’t be restored.')).toBeInTheDocument()
    expect(screen.getByText('This file isn’t a Propwise backup.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Restore this backup…' })).toBeNull()
    expect(stored()).toBe(before)
  })

  it('restore: a failed save keeps the current workspace and shows no success message', async () => {
    const file = new File([serializeBackup(createBackup())], 'backup.json', { type: 'application/json' })
    await addUserProperty()
    const before = stored()
    const db: DemoDatabase = structuredClone(readDatabase())
    const { user } = await open('data')
    const shown = toasts().length
    await user.upload(screen.getByLabelText('Backup file'), file)
    await user.click(await screen.findByRole('button', { name: 'Restore this backup…' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Download backup' }))
    await user.type(within(dialog).getByRole('textbox', { name: /Type RESTORE/ }), 'RESTORE')
    refuseWrites()
    await user.click(within(dialog).getByRole('button', { name: 'Replace workspace with backup' }))
    expect(await within(dialog).findByText(/Nothing was changed/)).toBeInTheDocument()
    expect(stored()).toBe(before)
    expect(readDatabase()).toEqual(db)
    expect(toasts().slice(shown).some((text) => text.includes('Workspace restored'))).toBe(false)
  })

  it('lists settings changes in the history', async () => {
    readDatabase()
    const { updatePaymentTerms } = await import('@/data/services')
    await updatePaymentTerms(21)
    await open('data')
    const history = screen.getByRole('list', { name: 'Settings history' })
    expect(within(history).getByText(/Bill payment terms changed/)).toBeInTheDocument()
    expect(within(history).getByText('21 days')).toBeInTheDocument()
  })
})
