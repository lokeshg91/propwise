import {
  availableActions,
  checkTransition,
  dueAtFor,
  getRequestTiming,
  REOPEN_WINDOW_DAYS,
  REQUEST_ACTIONS,
  type RequestAction,
  SLA_HOURS,
} from '@/data/domain/maintenance-rules'
import { type RequestStatus } from '@/types'

const NOW = new Date('2026-10-21T12:00:00.000Z')

/** Expected allowed actions per status, with and without an active work order. */
const ALLOWED: Record<RequestStatus, { withOrder: RequestAction[]; withoutOrder: RequestAction[] }> = {
  open: { withOrder: ['cancel'], withoutOrder: ['assign', 'cancel'] },
  scheduled: { withOrder: ['reassign', 'reschedule', 'start', 'hold', 'complete', 'cancel'], withoutOrder: ['cancel'] },
  'in-progress': { withOrder: ['reassign', 'hold', 'complete', 'cancel'], withoutOrder: ['cancel'] },
  'on-hold': { withOrder: ['reassign', 'resume', 'complete', 'cancel'], withoutOrder: ['cancel'] },
  completed: { withOrder: ['reopen'], withoutOrder: ['reopen'] },
  cancelled: { withOrder: [], withoutOrder: [] },
}

describe('maintenance transitions', () => {
  it.each(Object.entries(ALLOWED))('%s allows exactly the expected actions', (status, expected) => {
    const request = { status: status as RequestStatus, completedAt: '2026-10-15T12:00:00.000Z' }
    expect(availableActions(request, { hasActiveWorkOrder: true, now: NOW })).toEqual(expected.withOrder)
    expect(availableActions(request, { hasActiveWorkOrder: false, now: NOW })).toEqual(expected.withoutOrder)
  })

  it('treats cancelled as final', () => {
    for (const action of REQUEST_ACTIONS) {
      const check = checkTransition({ status: 'cancelled', completedAt: null }, action, { hasActiveWorkOrder: false, now: NOW })
      expect(check).toEqual({ allowed: false, reason: 'Cancelled requests are closed and can’t be changed.' })
    }
  })

  it('reopens completed requests only within the window', () => {
    const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()
    const inside = checkTransition({ status: 'completed', completedAt: daysAgo(REOPEN_WINDOW_DAYS - 1) }, 'reopen', { hasActiveWorkOrder: false, now: NOW })
    const outside = checkTransition({ status: 'completed', completedAt: daysAgo(REOPEN_WINDOW_DAYS + 1) }, 'reopen', { hasActiveWorkOrder: false, now: NOW })
    expect(inside.allowed).toBe(true)
    expect(outside).toMatchObject({ allowed: false, reason: expect.stringMatching(/within 30 days/) })
  })

  it('needs a vendor before starting or completing', () => {
    expect(checkTransition({ status: 'open', completedAt: null }, 'start', { hasActiveWorkOrder: false }).allowed).toBe(false)
    expect(checkTransition({ status: 'scheduled', completedAt: null }, 'complete', { hasActiveWorkOrder: false })).toEqual({
      allowed: false,
      reason: 'Assign a vendor first.',
    })
  })
})

describe('maintenance SLA', () => {
  it('sets the due time from the priority', () => {
    expect(dueAtFor('2026-10-21T00:00:00.000Z', 'urgent')).toBe('2026-10-22T00:00:00.000Z')
    expect(dueAtFor('2026-10-21T00:00:00.000Z', 'low')).toBe(new Date(Date.parse('2026-10-21T00:00:00.000Z') + SLA_HOURS.low * 3_600_000).toISOString())
  })

  it('derives overdue, due soon and on track for active requests only', () => {
    const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString()
    expect(getRequestTiming({ status: 'open', priority: 'urgent', dueAt: at(-1) }, NOW)).toBe('overdue')
    expect(getRequestTiming({ status: 'in-progress', priority: 'urgent', dueAt: at(5) }, NOW)).toBe('due-soon')
    expect(getRequestTiming({ status: 'scheduled', priority: 'urgent', dueAt: at(12) }, NOW)).toBe('on-track')
    expect(getRequestTiming({ status: 'completed', priority: 'urgent', dueAt: at(-10) }, NOW)).toBe('closed')
    expect(getRequestTiming({ status: 'cancelled', priority: 'high', dueAt: at(-10) }, NOW)).toBe('closed')
  })
})
