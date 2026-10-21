import { BrandMark } from '@/components/shared/brand-mark'

/** Shown while the first route and its data load. */
export function AppLoadingScreen() {
  return (
    <div role="status" className="flex min-h-svh items-center justify-center bg-background">
      <BrandMark className="size-10 animate-pulse" />
      <span className="sr-only">Loading Propwise…</span>
    </div>
  )
}
