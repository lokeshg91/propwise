import { AGING_BUCKET_LABELS } from '@/data/domain/finance-labels'
import { AGING_BUCKETS, type AgingBucket } from '@/data/domain/finance-rules'
import { useMoney } from '@/features/finance/hooks/use-money'
import { AGING_COLORS } from '@/features/finance/lib/aging-colors'

/** Open balances by age as one stacked bar plus a labelled list (never colour alone). */
export function AgingBar({ aging, label = 'Receivables by age' }: { aging: Record<AgingBucket, number>; label?: string }) {
  const money = useMoney()
  const total = AGING_BUCKETS.reduce((sum, bucket) => sum + aging[bucket], 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${AGING_BUCKETS.map((bucket) => `${AGING_BUCKET_LABELS[bucket]} ${money(aging[bucket])}`).join(', ')}`}>
        {total > 0
          ? AGING_BUCKETS.map((bucket) =>
              aging[bucket] > 0 ? <span key={bucket} style={{ width: `${(aging[bucket] / total) * 100}%`, backgroundColor: AGING_COLORS[bucket] }} /> : null,
            )
          : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
        {AGING_BUCKETS.map((bucket) => (
          <div key={bucket} className="flex min-w-0 items-start gap-2">
            <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: AGING_COLORS[bucket] }} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-caption text-muted-foreground">{AGING_BUCKET_LABELS[bucket]}</dt>
              <dd className="text-label text-foreground tabular-nums">{money(aging[bucket], { whole: true })}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  )
}
