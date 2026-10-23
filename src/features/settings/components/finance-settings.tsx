import { Info, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CURRENCY_CHANGE_NOTE, CURRENCY_OPTIONS, currencyName, updateCurrency, updatePaymentTerms, type WorkspaceSettings } from '@/data/services'
import { RULE_LIMITS } from '@/data/domain/finance-rules'
import { SelectField } from '@/features/finance/components/form-parts'
import { SaveError, SaveFooter, SettingsCard } from '@/features/settings/components/settings-card'
import { useSaveAction } from '@/features/settings/hooks/use-save-action'
import { createFormatters } from '@/lib/formatters'

/** Finance: workspace currency (relabel, never convert) and bill payment terms. */
export function FinanceSettings({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <CurrencyCard settings={settings} onSaved={onSaved} />
      <PaymentTermsCard settings={settings} onSaved={onSaved} />
    </div>
  )
}

function CurrencyCard({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  const [currency, setCurrency] = useState(settings.currency)
  const [confirming, setConfirming] = useState(false)
  const { pending, error, setError, run } = useSaveAction(onSaved)
  const dirty = currency !== settings.currency
  const before = createFormatters({ currency: settings.currency, locale: settings.locale })
  const after = createFormatters({ currency, locale: settings.locale })

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        setConfirming(true)
      }}
    >
      <SettingsCard
        title="Currency"
        description="The currency every amount is shown in, everywhere except the Dashboard."
        footer={<SaveFooter error={confirming ? null : error} pending={pending} dirty={dirty} label="Change currency…" />}
      >
        <SelectField
          label="Workspace currency"
          value={currency}
          onChange={setCurrency}
          placeholder="Choose a currency"
          options={CURRENCY_OPTIONS.map((option) => ({ value: option.code, label: `${option.name} (${option.code})` }))}
          hint="Currencies with two decimal places."
        />
        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-body text-info dark:bg-info/15">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-foreground/85">
            <span className="font-medium text-foreground">Relabels, doesn’t convert.</span> Changing the currency changes the symbol shown next to every amount. No exchange rate is applied, no amount changes and no historical record is rewritten.
          </p>
        </div>
      </SettingsCard>

      <Dialog open={confirming} onOpenChange={(open) => !open && !pending && setConfirming(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change the currency to {currencyName(currency)}?</DialogTitle>
            <DialogDescription>{CURRENCY_CHANGE_NOTE}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-body">
            <p className="mb-2 text-caption font-semibold tracking-wider text-muted-foreground uppercase">The same amount, relabelled</p>
            <p className="tabular-nums">
              <span className="text-muted-foreground">{before.money(125050)}</span>
              <span className="mx-2 text-muted-foreground" aria-hidden="true">
                →
              </span>
              <span className="sr-only">becomes</span>
              <span className="font-semibold text-foreground">{after.money(125050)}</span>
            </p>
          </div>
          <SaveError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={async () => {
                const saved = await run(() => updateCurrency(currency), { title: 'Currency changed', description: `Amounts are now shown in ${currencyName(currency)}. Nothing was converted.` })
                if (saved) setConfirming(false)
              }}
            >
              {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
              Relabel as {currency}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

function PaymentTermsCard({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  const [value, setValue] = useState(String(settings.paymentTermsDays))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { pending, error, run } = useSaveAction(onSaved)
  const { min, max } = RULE_LIMITS.paymentTermsDays
  const dirty = value.trim() !== String(settings.paymentTermsDays)

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const days = Number(value.trim())
        if (value.trim() === '' || !Number.isInteger(days) || days < min || days > max) {
          setFieldError(`Enter a whole number of days from ${min} to ${max}.`)
          return
        }
        setFieldError(null)
        void run(() => updatePaymentTerms(days), { title: 'Payment terms saved', description: `New bills are due ${days} ${days === 1 ? 'day' : 'days'} after the bill date.` })
      }}
    >
      <SettingsCard
        title="Bill payment terms"
        description="The default due date for new bills. Existing bills keep their due dates."
        footer={<SaveFooter error={error} pending={pending} dirty={dirty} />}
      >
        <FormField label="Days from bill date to due date" required error={fieldError ?? undefined} hint={`From ${min} to ${max} days. You can still change the due date on each bill.`}>
          {(field) => (
            <Input
              {...field}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              className="max-w-40 tabular-nums"
            />
          )}
        </FormField>
      </SettingsCard>
    </form>
  )
}
