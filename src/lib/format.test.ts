import { formatRelativeTime, getInitials } from '@/lib/format'

describe('format helpers', () => {
  const now = new Date('2026-10-21T12:00:00Z')

  it('formats relative times', () => {
    expect(formatRelativeTime('2026-10-21T11:59:40Z', now)).toBe('just now')
    expect(formatRelativeTime('2026-10-21T11:48:00Z', now)).toBe('12 minutes ago')
    expect(formatRelativeTime('2026-10-20T12:00:00Z', now)).toBe('yesterday')
  })

  it('builds initials', () => {
    expect(getInitials('Alex Morgan')).toBe('AM')
    expect(getInitials('  priya  ')).toBe('P')
  })
})
