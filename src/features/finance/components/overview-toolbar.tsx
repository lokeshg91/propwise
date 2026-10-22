import { SegmentedControl } from '@/components/shared/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FINANCE_RANGE_LABELS } from '@/data/domain/finance-labels'
import { FINANCE_RANGES, type FinanceRange } from '@/data/domain/finance-summary'
import { type OverviewFilters } from '@/features/finance/lib/finance-filters'
import { type PropertyOption } from '@/features/finance/finance.loaders'
import { type PropertyType } from '@/types'

const RANGE_OPTIONS = FINANCE_RANGES.map((range) => ({ value: range, label: FINANCE_RANGE_LABELS[range] }))
const SHORT_RANGE: Record<FinanceRange, string> = { 'this-month': 'Month', '3m': '3M', '6m': '6M', '12m': '12M', ytd: 'YTD' }

interface OverviewToolbarProps {
  filters: OverviewFilters
  properties: PropertyOption[]
  onChange: (changes: Partial<OverviewFilters>) => void
}

/** Period, property type and property for the Finance overview (kept in the URL). */
export function OverviewToolbar({ filters, properties, onChange }: OverviewToolbarProps) {
  const visible = properties.filter((property) => filters.type === 'all' || property.type === filters.type)
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <SegmentedControl
        label="Period"
        value={filters.range}
        options={RANGE_OPTIONS.map((option) => ({ ...option, label: SHORT_RANGE[option.value] }))}
        onValueChange={(range) => onChange({ range })}
        className="max-md:hidden"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:items-center">
        <Select value={filters.range} onValueChange={(range) => FINANCE_RANGES.includes(range as FinanceRange) && onChange({ range: range as FinanceRange })}>
          <SelectTrigger aria-label="Period" className="w-full md:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.type}
          onValueChange={(type) => {
            const next = type as PropertyType | 'all'
            const keep = filters.property === 'all' || next === 'all' || properties.find((property) => property.id === filters.property)?.type === next
            onChange({ type: next, ...(keep ? {} : { property: 'all' }) })
          }}
        >
          <SelectTrigger aria-label="Property type" className="w-full md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All property types</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.property} onValueChange={(property) => onChange({ property })}>
          <SelectTrigger aria-label="Property" className="w-full md:w-56">
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
      </div>
    </div>
  )
}
