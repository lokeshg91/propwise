import { cleanup, screen, waitFor } from '@testing-library/react'

import { updateCurrency, updateRegion } from '@/data/services'
import { readDatabase, resetDemoData } from '@/data/store/demo-store'
import { renderApp } from '@/test/render-app'

/**
 * App-wide formatting (Phase 9): every module follows the workspace currency
 * and region, while the Dashboard keeps its fixed sample formatting.
 */

beforeEach(() => resetDemoData())

async function dashboardText() {
  const { container } = renderApp('/dashboard')
  await screen.findByRole('heading', { level: 1 })
  // Let lazy charts and cards settle.
  await waitFor(() => expect(container.querySelector('main')?.textContent?.length ?? 0).toBeGreaterThan(200))
  const text = container.querySelector('main')?.textContent ?? ''
  cleanup()
  return text
}

describe('workspace formatting', () => {
  it('uses the workspace currency and region outside the Dashboard', async () => {
    readDatabase()
    await updateCurrency('EUR')
    await updateRegion('en-GB')
    const { container } = renderApp('/properties')
    await screen.findByRole('heading', { level: 1, name: 'Properties' })
    await waitFor(() => expect(container.textContent).toContain('€'))
    expect(container.querySelector('main')?.textContent).not.toMatch(/\$\d/)
    cleanup()

    const finance = renderApp('/finance')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    await waitFor(() => expect(finance.container.textContent).toContain('€'))
    expect(finance.container.querySelector('main')?.textContent).not.toMatch(/\$\d/)
    // en-GB dates: day before month.
    expect(finance.container.textContent).toMatch(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/)
  })

  it('keeps the Dashboard exactly as it is, whatever the settings', async () => {
    // Fixed clock: the Dashboard shows "Updated <time>", which would differ if a minute passed between the two renders.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T12:00:00'))
    onTestFinished(() => {
      vi.useRealTimers()
    })
    readDatabase()
    const before = await dashboardText()
    expect(before).toContain('$')
    await updateCurrency('EUR')
    await updateRegion('en-GB')
    const after = await dashboardText()
    expect(after).toBe(before)
    expect(after).not.toContain('€')
  })
})
