import { useState } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { ChangeDueDateDialog, MarkPaidDialog, MarkUnpaidDialog, VoidExpenseDialog } from '@/features/finance/components/expense-actions'
import { type ExpenseAction, ExpenseDetail } from '@/features/finance/components/expense-detail'
import { AddLateFeeDialog, AdjustChargeDialog, EndRecurringDialog, RecordPaymentDialog, VoidChargeDialog, VoidPaymentDialog } from '@/features/finance/components/income-actions'
import { type IncomeAction, IncomeDetail } from '@/features/finance/components/income-detail'
import { type transactionDetailLoader } from '@/features/finance/finance.loaders'
import { type Payment } from '@/types'

type Open = { kind: IncomeAction | ExpenseAction } | { kind: 'void-payment'; payment: Payment } | null

/** One income or expense record with its actions. Changes appear only after they've been saved. */
export function TransactionDetailPage() {
  const detail = useLoaderData<typeof transactionDetailLoader>()
  const revalidator = useRevalidator()
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const done = (message: string) => {
    setOpen(null)
    toast.success(message)
    void revalidator.revalidate()
  }
  const props = { onClose: close, onDone: done }

  return (
    <PageContainer>
      <NavigationProgress />
      <BackLink to="/finance/transactions" label="Transactions" />
      {detail.kind === 'income' ? (
        <>
          <IncomeDetail detail={detail} onAction={(kind) => setOpen({ kind })} onVoidPayment={(payment) => setOpen({ kind: 'void-payment', payment })} />
          {open?.kind === 'pay' ? <RecordPaymentDialog detail={detail} {...props} /> : null}
          {open?.kind === 'adjust' ? <AdjustChargeDialog detail={detail} {...props} /> : null}
          {open?.kind === 'void' ? <VoidChargeDialog detail={detail} {...props} /> : null}
          {open?.kind === 'late-fee' ? <AddLateFeeDialog detail={detail} {...props} /> : null}
          {open?.kind === 'end-recurring' && detail.recurring ? <EndRecurringDialog schedule={detail.recurring} {...props} /> : null}
          {open?.kind === 'void-payment' ? <VoidPaymentDialog payment={open.payment} {...props} /> : null}
        </>
      ) : (
        <>
          <ExpenseDetail detail={detail} onAction={(kind) => setOpen({ kind })} />
          {open?.kind === 'mark-paid' ? <MarkPaidDialog expense={detail.expense} {...props} /> : null}
          {open?.kind === 'mark-unpaid' ? <MarkUnpaidDialog expense={detail.expense} {...props} /> : null}
          {open?.kind === 'void' ? <VoidExpenseDialog expense={detail.expense} {...props} /> : null}
          {open?.kind === 'due-date' ? <ChangeDueDateDialog expense={detail.expense} {...props} /> : null}
        </>
      )}
    </PageContainer>
  )
}
