import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

/** "Add income" / "Add bill" header actions, optionally pre-filtered to a property. */
export function FinanceAddActions({ propertyId }: { propertyId?: string }) {
  const query = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''
  return (
    <>
      <Button asChild variant="outline">
        <Link to={`/finance/expenses/new${query}`}>
          <Plus data-icon="inline-start" />
          Add bill
        </Link>
      </Button>
      <Button asChild>
        <Link to={`/finance/income/new${query}`}>
          <Plus data-icon="inline-start" />
          Add income
        </Link>
      </Button>
    </>
  )
}
