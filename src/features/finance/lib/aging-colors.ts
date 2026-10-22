import { type AgingBucket } from '@/data/domain/finance-rules'

/** Token-based colours that darken with age; buckets are always labelled too. */
export const AGING_COLORS: Record<AgingBucket, string> = {
  current: 'var(--info)',
  '1-30': 'var(--warning)',
  '31-60': 'color-mix(in oklch, var(--warning) 45%, var(--danger))',
  '61-90': 'var(--danger)',
  '90+': 'color-mix(in oklch, var(--danger) 70%, var(--foreground))',
}
