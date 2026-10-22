import { useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { createExpense } from '@/data/services'
import { ExpenseForm } from '@/features/finance/components/expense-form'
import { useMoney } from '@/features/finance/hooks/use-money'
import { toExpenseInput } from '@/features/finance/lib/expense-input'
import { emptyExpense } from '@/features/finance/lib/finance-schemas'
import { type financeFormLoader } from '@/features/finance/finance.loaders'

export function ExpenseCreatePage() {
  const options = useLoaderData<typeof financeFormLoader>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const money = useMoney()
  const vendorId = options.vendors.some((vendor) => vendor.id === params.get('vendorId')) ? (params.get('vendorId') ?? undefined) : undefined
  const propertyId = options.properties.some((property) => property.id === params.get('propertyId')) ? (params.get('propertyId') ?? undefined) : undefined
  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to="/finance/transactions?kind=expense" label="Transactions" />
        <PageHeader title="Add bill" description="Record an operating expense. Bills for completed work orders are created automatically from Maintenance." />
      </div>
      <ExpenseForm
        mode="create"
        options={options}
        defaultValues={emptyExpense(options.settings.paymentTermsDays, { propertyId, vendorId })}
        cancelHref="/finance/transactions?kind=expense"
        onSave={async (values, acknowledgeDuplicate) => {
          const expense = await createExpense(toExpenseInput(values), {
            acknowledgeDuplicate,
            ...(values.paid ? { paidNow: { paidOn: values.paidOn, method: values.method, paymentRef: values.paymentRef } } : {}),
          })
          toast.success(`${expense.reference} added`, { description: `${money(expense.amountCents)}${values.paid ? ', paid' : `, due ${expense.dueDate}`}.` })
          await navigate(`/finance/transactions/${expense.id}`)
        }}
      />
    </PageContainer>
  )
}
