import { act, render, screen } from '@testing-library/react'

import { ThemeProvider } from '@/app/providers/theme-provider'
import { useTheme } from '@/hooks/use-theme'
import { STORAGE_KEYS } from '@/lib/storage'
import { mediaState } from '@/test/setup'

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <p data-testid="resolved">{resolvedTheme}</p>
      <button type="button" onClick={() => setTheme('dark')}>
        dark
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        light
      </button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

describe('ThemeProvider', () => {
  it('defaults to system and follows the OS preference', () => {
    mediaState.prefersDark = true
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('applies and persists an explicit choice', () => {
    renderProbe()
    act(() => screen.getByText('dark').click())
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')

    act(() => screen.getByText('light').click())
    expect(document.documentElement).not.toHaveClass('dark')
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('light')
  })

  it('restores the saved preference and ignores invalid values', () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, 'dark')
    const { unmount } = renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    unmount()

    window.localStorage.setItem(STORAGE_KEYS.theme, 'sepia')
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })
})
