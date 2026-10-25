import { Check, Circle, Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, useState } from 'react'

import { Input } from '@/components/ui/input'
import { PASSWORD_RULES } from '@/features/auth/lib/auth-schemas'
import { cn } from '@/lib/utils'

/** Password field with a Show/Hide button. The value is never stored. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} spellCheck={false} autoCapitalize="none" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

/** Live checklist of the password rules. */
export function PasswordRules({ value, id }: { value: string; id: string }) {
  return (
    <ul id={id} aria-label="Password rules" className="flex flex-col gap-1 text-caption">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value)
        return (
          <li key={rule.id} className={cn('flex items-center gap-1.5', met ? 'text-success' : 'text-muted-foreground')}>
            {met ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3" aria-hidden="true" />}
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' (met)' : ' (not met yet)'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
