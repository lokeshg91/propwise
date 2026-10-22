import { ReceiptText } from 'lucide-react'

import { RouteErrorState } from '@/components/shared/route-error-state'

/** Shown inside the app shell when a finance record can't be loaded. */
export function FinanceRouteError() {
  return (
    <RouteErrorState
      icon={ReceiptText}
      noun="Transaction"
      notFoundDescription="This income or expense record doesn’t exist in the demo data."
      errorDescription="We couldn’t load this record. Please try again."
      backTo="/finance/transactions"
      backLabel="Back to transactions"
    />
  )
}
