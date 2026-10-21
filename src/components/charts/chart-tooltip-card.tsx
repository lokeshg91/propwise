import { type ReactNode } from 'react'

export interface ChartTooltipRow {
  label: string
  value: string
  color: string
}

interface ChartTooltipCardProps {
  title: string
  rows: ChartTooltipRow[]
  footer?: ReactNode
}

/** Themed tooltip body for Recharts `content` render props. */
export function ChartTooltipCard({ title, rows, footer }: ChartTooltipCardProps) {
  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg">
      <p className="mb-2 text-caption font-semibold text-foreground">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-caption">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} aria-hidden="true" />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto pl-3 font-semibold text-foreground tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-2 border-t border-border pt-2 text-caption">{footer}</div> : null}
    </div>
  )
}
