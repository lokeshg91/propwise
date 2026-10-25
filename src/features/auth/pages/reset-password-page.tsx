import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { AuthCard, DemoNotice, DemoResult } from '@/features/auth/components/auth-card'
import { PasswordInput, PasswordRules } from '@/features/auth/components/password-input'
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/lib/auth-schemas'
import { useDemoToken } from '@/features/auth/lib/use-demo-token'
import { useNext } from '@/features/auth/lib/use-next'

/** Demo "choose a new password". DEMO ONLY: the new password is checked against the rules and then discarded. */
export function ResetPasswordPage() {
  const { withNext } = useNext()
  const status = useDemoToken('reset', '/reset-password')
  const [done, setDone] = useState(false)
  const rulesId = useId()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' }, mode: 'onSubmit', reValidateMode: 'onChange' })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150))
    reset({ password: '', confirmPassword: '' })
    setDone(true)
  })

  if (done) {
    return (
      <DemoResult
        icon={KeyRound}
        title="Demo complete — no password was changed"
        action={
          <Button asChild size="lg" className="w-full">
            <Link to={withNext('/login')}>Back to sign in</Link>
          </Button>
        }
      >
        <p>This is a demonstration. Your new password wasn’t saved, and no account password was changed.</p>
        <p>In a live app, you would now sign in with your new password.</p>
      </DemoResult>
    )
  }

  if (status !== 'valid') {
    return (
      <DemoResult
        icon={TriangleAlert}
        title="This link is invalid or has expired"
        action={
          <div className="flex flex-col gap-2">
            <Button asChild size="lg" className="w-full">
              <Link to={withNext('/forgot-password')}>Request a new link</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to={withNext('/login')}>Back to sign in</Link>
            </Button>
          </div>
        }
      >
        <p>Reset links work once. Request a new one to choose a password.</p>
        <p>Demo: no email is sent and links aren’t saved; the next page has a new demo link.</p>
      </DemoResult>
    )
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Use a password you don’t use anywhere else."
      footer={
        <Link to={withNext('/login')} className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
        {/* Lets password managers associate the new password with an account. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly value="" />
        <div className="flex flex-col gap-2">
          <FormField label="New password" required error={errors.password?.message}>
            {(field) => <PasswordInput {...field} {...register('password')} autoComplete="new-password" />}
          </FormField>
          <PasswordRules id={rulesId} value={password} />
        </div>
        <FormField label="Confirm new password" required error={errors.confirmPassword?.message}>
          {(field) => <PasswordInput {...field} {...register('confirmPassword')} autoComplete="new-password" />}
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          Set new password
        </Button>
      </form>
      <DemoNotice>Demo: no password is changed and nothing you type is saved. This page only checks the password rules.</DemoNotice>
    </AuthCard>
  )
}
