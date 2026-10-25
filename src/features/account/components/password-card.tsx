import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { DemoNotice } from '@/features/auth/components/auth-card'
import { PasswordInput, PasswordRules } from '@/features/auth/components/password-input'
import { changePasswordSchema, type ChangePasswordValues } from '@/features/auth/lib/auth-schemas'
import { SettingsCard } from '@/features/settings/components/settings-card'

const EMPTY: ChangePasswordValues = { currentPassword: '', password: '', confirmPassword: '' }

/**
 * Change password. DEMO ONLY: the current password isn't checked, and
 * nothing typed here is stored or sent. The form is cleared afterwards.
 */
export function PasswordCard({ email }: { email: string }) {
  const rulesId = useId()
  const [done, setDone] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY, mode: 'onSubmit', reValidateMode: 'onChange' })
  const password = useWatch({ control, name: 'password' })

  const submit = handleSubmit(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150))
    reset(EMPTY)
    setDone(true)
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} onChange={() => done && setDone(false)}>
      <SettingsCard title="Password" description="Change the password you sign in with.">
        <DemoNotice>Demo: passwords aren’t checked or stored. Any current password works, and nothing you type here is saved or sent.</DemoNotice>
        {/* Lets password managers match the new password to this account; not submitted anywhere. */}
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Current password" required error={errors.currentPassword?.message} className="sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]">
            {(field) => <PasswordInput {...field} {...register('currentPassword')} autoComplete="current-password" />}
          </FormField>
          <div className="flex flex-col gap-2">
            <FormField label="New password" required error={errors.password?.message}>
              {(field) => <PasswordInput {...field} {...register('password')} autoComplete="new-password" />}
            </FormField>
            <PasswordRules id={rulesId} value={password} />
          </div>
          <FormField label="Confirm new password" required error={errors.confirmPassword?.message}>
            {(field) => <PasswordInput {...field} {...register('confirmPassword')} autoComplete="new-password" />}
          </FormField>
        </div>
        <div role="status" className="empty:hidden">
          {done ? (
            <p className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-body text-foreground dark:bg-success/15">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span>
                <span className="font-medium">Demo complete — no password was changed.</span> Propwise doesn’t store passwords in this demo, and the form has been
                cleared.
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            {isSubmitting ? 'Submitting…' : 'Change password'}
          </Button>
        </div>
      </SettingsCard>
    </form>
  )
}
