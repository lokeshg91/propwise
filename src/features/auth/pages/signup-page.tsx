import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { AuthCard, DemoNotice } from '@/features/auth/components/auth-card'
import { PasswordInput, PasswordRules } from '@/features/auth/components/password-input'
import { signupSchema, type SignupValues } from '@/features/auth/lib/auth-schemas'
import { rememberEmailForThisPage } from '@/features/auth/lib/pending-email'
import { useNext } from '@/features/auth/lib/use-next'

const LINK = 'font-medium text-primary underline-offset-4 hover:underline'

/** Demo sign-up. DEMO ONLY: no account is created and nothing typed here is saved; it continues to the demo email verification. */
export function SignupPage() {
  const navigate = useNavigate()
  const { withNext } = useNext()
  const rulesId = useId()
  const termsErrorId = useId()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((resolve) => setTimeout(resolve, 150))
    rememberEmailForThisPage(values.email)
    await navigate(withNext('/check-email', { for: 'verify' }))
  })

  return (
    <AuthCard
      wide
      title="Create your account"
      description="Start managing your properties with Propwise."
      footer={
        <p>
          Already have an account?{' '}
          <Link to={withNext('/login')} className={LINK}>
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
        <FormField label="Full name" required error={errors.name?.message}>
          {(field) => <Input {...field} {...register('name')} autoComplete="name" />}
        </FormField>
        <FormField label="Work email" required error={errors.email?.message}>
          {(field) => <Input {...field} {...register('email')} type="email" autoComplete="email" inputMode="email" />}
        </FormField>
        <div className="flex flex-col gap-2">
          <FormField label="Password" required error={errors.password?.message}>
            {(field) => <PasswordInput {...field} {...register('password')} autoComplete="new-password" />}
          </FormField>
          <PasswordRules id={rulesId} value={password} />
        </div>
        <FormField label="Confirm password" required error={errors.confirmPassword?.message}>
          {(field) => <PasswordInput {...field} {...register('confirmPassword')} autoComplete="new-password" />}
        </FormField>
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="accept-terms"
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(errors.acceptTerms)}
                  aria-describedby={errors.acceptTerms ? termsErrorId : undefined}
                  className="mt-0.5"
                />
                <label htmlFor="accept-terms" className="text-body text-muted-foreground">
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" rel="noopener" className={LINK}>
                    Terms of service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" target="_blank" rel="noopener" className={LINK}>
                    Privacy policy
                  </Link>
                  .
                </label>
              </div>
              {errors.acceptTerms ? (
                <p id={termsErrorId} className="text-caption font-medium text-danger">
                  {errors.acceptTerms.message}
                </p>
              ) : null}
            </div>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          Create account
        </Button>
      </form>
      <DemoNotice>Demo: no account is created, and your name, email and password aren’t saved or sent. You’ll continue as the demo user.</DemoNotice>
    </AuthCard>
  )
}
