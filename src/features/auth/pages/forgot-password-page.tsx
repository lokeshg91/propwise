import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthCard, DemoNotice } from '@/features/auth/components/auth-card'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/lib/auth-schemas'
import { rememberEmailForThisPage } from '@/features/auth/lib/pending-email'
import { useNext } from '@/features/auth/lib/use-next'

/** Demo "forgot password". DEMO ONLY: no email is sent; the next page offers the demo link instead. */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { withNext } = useNext()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' }, mode: 'onSubmit', reValidateMode: 'onChange' })

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((resolve) => setTimeout(resolve, 150))
    rememberEmailForThisPage(values.email)
    await navigate(withNext('/check-email', { for: 'reset' }))
  })

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email address you use for Propwise to get a link for choosing a new password."
      footer={
        <Link to={withNext('/login')} className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" required error={errors.email?.message}>
          {(field) => <Input {...field} {...register('email')} type="email" autoComplete="email" inputMode="email" />}
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          Get reset link
        </Button>
      </form>
      <DemoNotice>Demo: no email is sent and the address isn’t saved. The next page has a demo link instead.</DemoNotice>
    </AuthCard>
  )
}
