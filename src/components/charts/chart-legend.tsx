interface ChartLegendProps {
  items: ReadonlyArray<{ label: string; color: string; value?: string }>
  className?: string
}

/** Static, readable legend rendered outside the SVG so it wraps responsively. */
export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <ul className={className ?? 'flex flex-wrap items-center gap-x-4 gap-y-1.5'}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-caption text-muted-foreground">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span>{item.label}</span>
          {item.value ? <span className="font-semibold text-foreground tabular-nums">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  )
}
