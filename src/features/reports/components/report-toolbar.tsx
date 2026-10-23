import { useState, type ReactNode } from 'react'

import { CustomRangeForm } from '@/components/shared/custom-range-form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { REPORT_RANGE_LABELS, type ReportFilters } from '@/data/services'
import { RECORD_SOURCE_LABELS, RECORD_SOURCES } from '@/features/reports/lib/report-filters'
import { type RecordSource } from '@/data/domain/report-income-expense'
import { REPORT_RANGE_PRESETS, type PropertyType, type ReportRangePreset } from '@/types'

export interface ReportPropertyOption {
  id: string
  name: string
  type: PropertyType
}

interface ReportToolbarProps {
  filters: ReportFilters
  properties: ReportPropertyOption[]
  /** Window of the report shown, used to prefill a new custom range. */
  window: { from: string; to: string }
  /** A custom range from the URL that was refused. */
  invalidCustom: { from: string; to: string; message: string } | null
  onChange: (changes: Partial<ReportFilters>) => void
  /** Report-specific options (view, toggles). */
  children?: ReactNode
  /** False for reports as of today (no period). */
  showPeriod?: boolean
}

/** Period (presets or a custom range), property type, property and record source. All kept in the URL. */
export function ReportToolbar({ filters, properties, window, invalidCustom, onChange, children, showPeriod = true }: ReportToolbarProps) {
  const [custom, setCustom] = useState(filters.range.kind === 'custom' || invalidCustom !== null)
  const visible = properties.filter((property) => filters.propertyType === 'all' || property.type === filters.propertyType)
  const periodValue = custom ? 'custom' : filters.range.kind === 'preset' ? filters.range.preset : 'custom'

  return (
    <div data-report-noprint className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className={showPeriod ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>
        {showPeriod ? (
          <Select
            value={periodValue}
            onValueChange={(value) => {
              if (value === 'custom') setCustom(true)
              else {
                setCustom(false)
                onChange({ range: { kind: 'preset', preset: value as ReportRangePreset } })
              }
            }}
          >
            <SelectTrigger aria-label="Period" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_RANGE_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {REPORT_RANGE_LABELS[preset]}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom range…</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Select
          value={filters.propertyType}
          onValueChange={(value) => {
            const next = value as PropertyType | 'all'
            const keep = filters.propertyId === 'all' || next === 'all' || properties.find((property) => property.id === filters.propertyId)?.type === next
            onChange({ propertyType: next, ...(keep ? {} : { propertyId: 'all' }) })
          }}
        >
          <SelectTrigger aria-label="Property type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All property types</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.propertyId} onValueChange={(propertyId) => onChange({ propertyId })}>
          <SelectTrigger aria-label="Property" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All properties</SelectItem>
            {visible.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.source} onValueChange={(source) => onChange({ source: source as RecordSource })}>
          <SelectTrigger aria-label="Records" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECORD_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>
                {RECORD_SOURCE_LABELS[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showPeriod && custom ? (
        <CustomRangeForm
          key={`${window.from}-${window.to}`}
          initial={invalidCustom ?? window}
          initialError={invalidCustom?.message ?? null}
          onApply={(range) => onChange({ range })}
          onCancel={
            filters.range.kind === 'preset' && !invalidCustom
              ? () => setCustom(false)
              : undefined
          }
        />
      ) : null}
      {children ? <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">{children}</div> : null}
    </div>
  )
}
