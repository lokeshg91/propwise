import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// The first render lazy-loads route modules (including Recharts).
configure({ asyncUtilTimeout: 4000 })

/** Controls the mocked `prefers-color-scheme: dark` result in tests. */
export const mediaState = { prefersDark: false }

function installBrowserStubs() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('dark') ? mediaState.prefersDark : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub

  // Radix primitives rely on pointer-capture and scroll APIs jsdom lacks.
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
}

installBrowserStubs()

beforeEach(() => {
  mediaState.prefersDark = false
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
})

afterEach(() => {
  cleanup()
})
