import { cn } from '@/lib/utils'

export interface ReportFigure {
  label: string
  value: string
  note?: string
  tone?: 'default' | 'positive' | 'negative'
}

/** Summary figures at the top of a report. */
export function ReportFigures({ figures, label }: { figures: ReportFigure[]; label: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5 print:grid-cols-5">
      {figures.map((figure) => (
        <div key={figure.label} className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-4 print:break-inside-avoid">
          <p className="text-caption text-muted-foreground">{figure.label}</p>
          <p className={cn('text-h2 text-foreground tabular-nums', figure.tone === 'negative' && 'text-danger', figure.tone === 'positive' && 'text-success')}>{figure.value}</p>
          {figure.note ? <p className="text-caption text-muted-foreground">{figure.note}</p> : null}
        </div>
      ))}
    </section>
  )
}
