import { useNavigation } from 'react-router'

import { cn } from '@/lib/utils'

/**
 * Thin indeterminate bar shown while the next page's data loads. Place it at
 * the top of a page; it announces "Loading" to screen readers.
 */
export function NavigationProgress({ className }: { className?: string }) {
  const navigation = useNavigation()
  const loading = navigation.state !== 'idle'
  return (
    <div className={cn('pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden', className)} aria-hidden={!loading}>
      {loading ? (
        <>
          <span className="sr-only" role="status">
            Loading…
          </span>
          <span className="block h-full w-1/3 animate-[navigation-progress_1s_ease-in-out_infinite] rounded-full bg-primary motion-reduce:w-full motion-reduce:animate-none" />
        </>
      ) : null}
    </div>
  )
}
