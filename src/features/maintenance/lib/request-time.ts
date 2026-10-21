import { getRequestTiming, type RequestTiming } from '@/data/domain/maintenance-rules'
import { formatDate } from '@/lib/format'
import { type ServiceRequest } from '@/types'

/** "45 minutes", "5 hours", "3 days". */
export function formatDuration(hours: number): string {
  const value = Math.abs(hours)
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} minutes`
  if (value < 36) {
    const rounded = Math.round(value)
    return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`
  }
  const days = Math.round(value / 24)
  return `${days} days`
}

export const hoursUntil = (iso: string, now: Date = new Date()) => (new Date(iso).getTime() - now.getTime()) / 3_600_000

/** Date and time, e.g. "Oct 24, 2026, 9:30 AM". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** One-line timing summary for a request, e.g. "Overdue by 2 days". */
export function timingLine(
  request: Pick<ServiceRequest, 'status' | 'dueAt' | 'priority' | 'completedAt' | 'cancelledAt'>,
  now: Date = new Date(),
): { timing: RequestTiming; text: string } {
  const timing = getRequestTiming(request, now)
  if (timing === 'closed') {
    const at = request.status === 'completed' ? request.completedAt : request.cancelledAt
    return { timing, text: at ? `${request.status === 'completed' ? 'Completed' : 'Cancelled'} ${formatDate(at.slice(0, 10))}` : '' }
  }
  const left = hoursUntil(request.dueAt, now)
  return { timing, text: left < 0 ? `Overdue by ${formatDuration(left)}` : `Due in ${formatDuration(left)}` }
}

/** ISO timestamp → value for an `<input type="datetime-local">` (local time). */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Tomorrow at 9:00 local time, as a datetime-local value. */
export function defaultVisitTime(now: Date = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0)
  return toDateTimeLocal(date.toISOString())
}
