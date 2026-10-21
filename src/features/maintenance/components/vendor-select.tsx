import { type Ref } from 'react'

import { type FieldControlProps } from '@/components/forms/form-field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORY_LABELS } from '@/features/maintenance/lib/request-meta'
import { type RequestCategory, type Vendor } from '@/types'

interface VendorSelectProps {
  vendors: Vendor[]
  category: RequestCategory
  value: string
  onValueChange: (value: string) => void
  onBlur?: () => void
  triggerRef?: Ref<HTMLButtonElement>
  aria: FieldControlProps
  /** A vendor to leave out, e.g. the current one when reassigning. */
  excludeId?: string
}

/**
 * Vendor picker: vendors for the request's category first, then others.
 * Inactive vendors are listed but can't be chosen.
 */
export function VendorSelect({ vendors, category, value, onValueChange, onBlur, triggerRef, aria, excludeId }: VendorSelectProps) {
  const pool = vendors.filter((vendor) => vendor.id !== excludeId)
  const recommended = pool.filter((vendor) => vendor.active && vendor.categories.includes(category))
  const others = pool.filter((vendor) => vendor.active && !vendor.categories.includes(category))
  const inactive = pool.filter((vendor) => !vendor.active)

  const item = (vendor: Vendor, disabled = false) => (
    <SelectItem key={vendor.id} value={vendor.id} disabled={disabled}>
      {vendor.name}
      <span className="text-muted-foreground">
        {' '}
        · {disabled ? 'Inactive' : vendor.categories.map((entry) => CATEGORY_LABELS[entry]).join(', ')}
      </span>
    </SelectItem>
  )

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger {...aria} ref={triggerRef} onBlur={onBlur} className="w-full">
        <SelectValue placeholder="Select vendor" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {recommended.length > 0 ? (
          <SelectGroup>
            <SelectLabel>Recommended for {CATEGORY_LABELS[category].toLowerCase()}</SelectLabel>
            {recommended.map((vendor) => item(vendor))}
          </SelectGroup>
        ) : null}
        {others.length > 0 ? (
          <>
            {recommended.length > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              <SelectLabel>Other vendors</SelectLabel>
              {others.map((vendor) => item(vendor))}
            </SelectGroup>
          </>
        ) : null}
        {inactive.length > 0 ? (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Inactive (can’t take new work)</SelectLabel>
              {inactive.map((vendor) => item(vendor, true))}
            </SelectGroup>
          </>
        ) : null}
      </SelectContent>
    </Select>
  )
}
