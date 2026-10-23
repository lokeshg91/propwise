import { RequestStatusBadge, TimingText } from '@/features/maintenance/components/request-badges'
import { type RequestRow } from '@/features/maintenance/lib/request-list'
import { timingLine } from '@/features/maintenance/lib/request-time'
import { useFormat } from '@/hooks/use-format'

/** Status badge with the request's timing line (in the workspace date format). */
export function RequestStatusCell({ request }: { request: RequestRow['request'] }) {
  const { date: formatDate } = useFormat()
  const { timing, text } = timingLine(request, formatDate)
  return (
    <span className="flex flex-col items-start gap-1">
      <RequestStatusBadge status={request.status} />
      <TimingText timing={timing} text={text} />
    </span>
  )
}
