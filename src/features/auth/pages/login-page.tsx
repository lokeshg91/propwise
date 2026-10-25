import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthCard, DemoNotice } from '@/features/auth/components/auth-card'
import { PasswordInput } from '@/features/auth/components/password-input'
import { loginSchema, type LoginValues } from '@/features/auth/lib/auth-schemas'
import { useNext } from '@/features/auth/lib/use-next'
import { signIn } from '@/lib/session'

/**
 * Demo sign-in. DEMO ONLY: there are no accounts, so any valid email and
 * password open the workspace. Nothing typed here is stored or sent; signing
 * in only clears the demo "signed out" flag. Replace `onSubmit` with your auth
 * provider.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const { next, withNext } = useNext()
  const [failure, setFailure] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'alex.morgan@example.com', password: 'demo-password' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const onSubmit = handleSubmit(async () => {
    setFailure(null)
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (!signIn()) {
      setFailure('This browser didn’t allow Propwise to save the sign-in. Check that site data is allowed, then try again.')
      return
    }
    await navigate(next, { replace: true })
  })

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your properties."
      footer={
        <p>
          New to Propwise?{' '}
          <Link to={withNext('/signup')} className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      {failure ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-foreground dark:bg-danger/15">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden="true" />
          {failure}
        </p>
      ) : null}
      <form id="login-form" onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" error={errors.email?.message}>
          {(field) => <Input {...field} {...register('email')} type="email" autoComplete="email" inputMode="email" />}
        </FormField>
        <FormField
          label="Password"
          error={errors.password?.message}
          labelAside={
            <Link to={withNext('/forgot-password')} className="text-caption font-medium text-primary underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
        >
          {(field) => <PasswordInput {...field} {...register('password')} autoComplete="current-password" />}
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          Sign in
        </Button>
      </form>
      <DemoNotice>Demo: any email and password work. Nothing you type is saved or sent.</DemoNotice>
    </AuthCard>
  )
}
