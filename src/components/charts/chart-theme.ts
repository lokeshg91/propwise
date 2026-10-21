/**
 * Shared Recharts styling. Values reference theme tokens so charts switch
 * with light and dark mode without re-rendering.
 */
export const chartAxisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
  tickMargin: 8,
} as const

export const chartGridProps = {
  stroke: 'var(--border)',
  strokeDasharray: '4 4',
  vertical: false,
} as const

export const chartCursor = { fill: 'var(--muted)', opacity: 0.6 } as const

/** Token-backed series colours. */
export const CHART_COLORS = {
  primary: 'var(--chart-1)',
  secondary: 'var(--chart-2)',
  tertiary: 'var(--chart-3)',
  quaternary: 'var(--chart-4)',
  neutral: 'var(--chart-5)',
} as const
