import { zodResolver } from '@hookform/resolvers/zod'
import { ImageUp, LoaderCircle, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField } from '@/components/forms/form-field'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ACCOUNT_LIMITS, isServiceError, updateProfile, type ProfileInput } from '@/data/services'
import { AVATAR_ACCEPT, AvatarError, prepareAvatar } from '@/features/account/lib/avatar-image'
import { profileSchema, toProfileValues, type ProfileValues } from '@/features/account/lib/profile-schema'
import { SaveFooter, SettingsCard } from '@/features/settings/components/settings-card'
import { getInitials } from '@/lib/format'
import { type Account } from '@/types'

const FIELDS = new Set<keyof ProfileValues>(['name', 'email', 'phone', 'jobTitle', 'avatar'])

/** Name, email, phone, job title and photo. One Save for the whole profile; nothing changes until it is saved. */
export function ProfileCard({ account, onSaved }: { account: Account; onSaved: (account: Account) => void }) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: toProfileValues(account.profile), mode: 'onTouched' })
  const [saveError, setSaveError] = useState<string | null>(null)

  const submit = handleSubmit(async (values) => {
    setSaveError(null)
    try {
      const input: ProfileInput = { name: values.name, email: values.email, phone: values.phone, jobTitle: values.jobTitle, avatar: values.avatar }
      const saved = await updateProfile(input)
      reset(toProfileValues(saved.profile))
      toast.success('Profile saved', { description: 'Your name, job title and photo now show in the header.' })
      onSaved(saved)
    } catch (error) {
      const field = isServiceError(error) && error.field && FIELDS.has(error.field as keyof ProfileValues) ? (error.field as keyof ProfileValues) : undefined
      const message = error instanceof Error ? error.message : 'Something went wrong. Try again.'
      if (field) setError(field, { message }, { shouldFocus: field !== 'avatar' })
      else setSaveError(message)
    }
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <SettingsCard
        title="Profile"
        description="How you appear in Propwise. Saved with the workspace in this browser."
        footer={<SaveFooter error={saveError} pending={isSubmitting} dirty={isDirty} label="Save profile" />}
      >
        <AvatarField
          control={control}
          error={errors.avatar?.message}
          disabled={isSubmitting}
          onChange={(avatar) => {
            clearErrors('avatar')
            setValue('avatar', avatar, { shouldDirty: true })
          }}
          onError={(message) => setError('avatar', { message })}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register('name')} autoComplete="name" maxLength={ACCOUNT_LIMITS.name + 20} />}
          </FormField>
          <FormField label="Job title" required error={errors.jobTitle?.message} hint="Shown under your name in the header.">
            {(field) => <Input {...field} {...register('jobTitle')} autoComplete="organization-title" maxLength={ACCOUNT_LIMITS.jobTitle + 20} />}
          </FormField>
          <FormField label="Email" required error={errors.email?.message} hint="Demo: no verification email is sent.">
            {(field) => <Input {...field} {...register('email')} type="email" inputMode="email" autoComplete="email" maxLength={ACCOUNT_LIMITS.email + 20} />}
          </FormField>
          <FormField label="Phone" error={errors.phone?.message} hint="Optional.">
            {(field) => <Input {...field} {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={ACCOUNT_LIMITS.phone + 10} />}
          </FormField>
        </div>
      </SettingsCard>
    </form>
  )
}

function AvatarField({
  control,
  error,
  disabled,
  onChange,
  onError,
}: {
  control: ReturnType<typeof useForm<ProfileValues>>['control']
  error: string | undefined
  disabled: boolean
  onChange: (avatar: string | null) => void
  onError: (message: string) => void
}) {
  const [avatar, name] = useWatch({ control, name: ['avatar', 'name'] })
  const input = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const choose = async (file: File | undefined) => {
    if (!file) return
    setProcessing(true)
    try {
      onChange(await prepareAvatar(file))
    } catch (caught) {
      onError(caught instanceof AvatarError ? caught.message : 'This image couldn’t be used. Choose another image.')
    } finally {
      setProcessing(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <Avatar className="size-20">
        {avatar ? <AvatarImage src={avatar} alt="Your profile photo" /> : null}
        <AvatarFallback className="bg-primary/10 text-[1.5rem] leading-none font-semibold text-primary">{getInitials(name.trim() || '?')}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-2">
        <span id={`${id}-label`} className="text-label text-foreground">
          Photo
        </span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id={id}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || processing}
            aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(' ')}
            onClick={() => input.current?.click()}
          >
            {processing ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <ImageUp data-icon="inline-start" />}
            {processing ? 'Preparing photo…' : avatar ? 'Change photo' : 'Upload photo'}
          </Button>
          {avatar ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || processing} onClick={() => onChange(null)}>
              <Trash2 data-icon="inline-start" />
              Remove photo
            </Button>
          ) : null}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-caption font-medium text-danger">
            {error}
          </p>
        ) : null}
        <p id={hintId} className="text-caption text-muted-foreground">
          JPEG, PNG, WebP or GIF, up to 10 MB. Cropped to a square and resized to 256 × 256 px in your browser; only that copy is saved.
        </p>
      </div>
    </div>
  )
}
