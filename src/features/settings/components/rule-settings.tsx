import { CalendarClock, LoaderCircle, Lock } from 'lucide-react'
import { useState } from 'react'

import { FormField } from '@/components/forms/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { addDays, todayIso } from '@/data/domain/dates'
import { RULE_LIMITS, ruleFor, sameRule } from '@/data/domain/finance-rules'
import { centsToInput } from '@/data/domain/money'
import { addRuleVersion, type WorkspaceSettings } from '@/data/services'
import { MoneyInput } from '@/features/finance/components/money-input'
import { SaveError, SettingsCard } from '@/features/settings/components/settings-card'
import { useSaveAction } from '@/features/settings/hooks/use-save-action'
import { parseRuleForm, type RuleFormErrors, type RuleFormValues } from '@/features/settings/lib/rule-form'
import { useFormat } from '@/hooks/use-format'
import { type FinanceRule, type FinanceRuleVersion } from '@/types'

/** Rent & late fees: the rule in force, upcoming versions, a form for a new version and the read-only history. */
export function RuleSettings({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <CurrentRuleCard settings={settings} />
      <AddRuleCard settings={settings} onSaved={onSaved} />
      <RuleHistory settings={settings} />
    </div>
  )
}

function useRuleText() {
  const { money, number } = useFormat()
  return {
    grace: (days: number) => `${number(days)} ${days === 1 ? 'day' : 'days'}`,
    residential: (cents: number) => money(cents),
    commercial: (percent: number) => `${number(percent)}% of the rent`,
  }
}

function CurrentRuleCard({ settings }: { settings: WorkspaceSettings }) {
  const { date } = useFormat()
  const text = useRuleText()
  const rule = settings.currentRule
  return (
    <SettingsCard title="Rule in force today" description={`Since ${date(rule.effectiveFrom)}. It applies to rent charges by their due date.`}>
      <dl className="grid gap-4 sm:grid-cols-3">
        <RuleFigure label="Grace period" value={text.grace(rule.graceDays)} note="After the due date, before a late fee can be added" />
        <RuleFigure label="Residential late fee" value={text.residential(rule.lateFee.residentialCents)} note="Fixed, once per rent charge" />
        <RuleFigure label="Commercial late fee" value={text.commercial(rule.lateFee.commercialPercent)} note="Of the full rent charge, once" />
      </dl>
      {settings.upcomingRules.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-body dark:bg-info/15">
          {settings.upcomingRules.map((upcoming) => (
            <p key={upcoming.id} className="flex items-start gap-2 text-foreground/85">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">From {date(upcoming.effectiveFrom)}:</span> {text.grace(upcoming.graceDays)} grace, {text.residential(upcoming.lateFee.residentialCents)} residential,{' '}
                {text.commercial(upcoming.lateFee.commercialPercent)} commercial.
              </span>
            </p>
          ))}
        </div>
      ) : null}
    </SettingsCard>
  )
}

function RuleFigure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-h3 text-foreground tabular-nums">{value}</dd>
      <dd className="text-caption text-muted-foreground">{note}</dd>
    </div>
  )
}

const toForm = (rule: FinanceRule, effectiveFrom: string): RuleFormValues => ({
  effectiveFrom,
  graceDays: String(rule.graceDays),
  residential: centsToInput(rule.lateFee.residentialCents),
  commercial: String(rule.lateFee.commercialPercent),
})

/** First day of next month: the usual start for a new rule. */
function nextMonthStart(today: string): string {
  const [year, month] = today.split('-').map(Number)
  const next = new Date(year ?? 1970, month ?? 1, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
}

function AddRuleCard({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  const today = todayIso()
  const initial = toForm(settings.currentRule, nextMonthStart(today))
  const [values, setValues] = useState<RuleFormValues>(initial)
  const [errors, setErrors] = useState<RuleFormErrors>({})
  const [review, setReview] = useState<{ effectiveFrom: string; rule: FinanceRule; inForce: FinanceRuleVersion } | null>(null)
  const { pending, error, setError, run } = useSaveAction(() => {
    setValues(toForm(review?.rule ?? settings.currentRule, nextMonthStart(today)))
    setReview(null)
    onSaved()
  })
  const { date } = useFormat()
  const text = useRuleText()
  const set = (key: keyof RuleFormValues) => (value: string) => setValues((current) => ({ ...current, [key]: value }))

  const submit = () => {
    const parsed = parseRuleForm(values, today, settings.rules)
    setErrors(parsed.errors)
    if (!parsed.value) return
    const inForce = ruleFor({ rules: settings.rules }, parsed.value.effectiveFrom)
    if (sameRule(inForce, parsed.value.rule)) {
      setErrors({ form: 'These are the values already in force on that date. Change at least one value.' })
      return
    }
    setError(null)
    setReview({ ...parsed.value, inForce })
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <SettingsCard
        title="Add a rule version"
        description="A new version applies to rent due on or after its start date. Earlier charges, and late fees already added, keep the rule they had."
        footer={
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <SaveError message={errors.form ?? null} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" />
                Versions can’t be edited or removed once added.
              </p>
              <Button type="submit">Review rule…</Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Applies to rent due from" required error={errors.effectiveFrom} hint="Today or later.">
            {(field) => <Input {...field} type="date" min={today} value={values.effectiveFrom} onChange={(event) => set('effectiveFrom')(event.target.value)} />}
          </FormField>
          <FormField label="Grace period (days)" required error={errors.graceDays} hint={`${RULE_LIMITS.graceDays.min}–${RULE_LIMITS.graceDays.max} days after the due date.`}>
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min={RULE_LIMITS.graceDays.min}
                max={RULE_LIMITS.graceDays.max}
                step={1}
                value={values.graceDays}
                onChange={(event) => set('graceDays')(event.target.value)}
                className="tabular-nums"
              />
            )}
          </FormField>
          <FormField label="Residential late fee" required error={errors.residential} hint="A fixed amount, up to 1,000.00. 0 means no fee.">
            {(field) => <MoneyInput {...field} value={values.residential} onChange={(event) => set('residential')(event.target.value)} />}
          </FormField>
          <FormField label="Commercial late fee (%)" required error={errors.commercial} hint={`${RULE_LIMITS.commercialPercent.min}–${RULE_LIMITS.commercialPercent.max}% of the full rent charge, up to 2 decimals.`}>
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="decimal"
                min={RULE_LIMITS.commercialPercent.min}
                max={RULE_LIMITS.commercialPercent.max}
                step={0.01}
                value={values.commercial}
                onChange={(event) => set('commercial')(event.target.value)}
                className="tabular-nums"
              />
            )}
          </FormField>
        </div>
      </SettingsCard>

      <Dialog open={review !== null} onOpenChange={(open) => !open && !pending && setReview(null)}>
        <DialogContent className="sm:max-w-lg">
          {review ? (
            <>
              <DialogHeader>
                <DialogTitle>Add a rule from {date(review.effectiveFrom)}?</DialogTitle>
                <DialogDescription>
                  Applies to rent due on or after {date(review.effectiveFrom)}. Rent due before then, and late fees already added, keep the rule they had. This version can’t be edited or removed later; to change it, add another version.
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-0" />
                    <TableHead>Until {date(addDays(review.effectiveFrom, -1))}</TableHead>
                    <TableHead>From {date(review.effectiveFrom)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <ReviewRow label="Grace period" before={text.grace(review.inForce.graceDays)} after={text.grace(review.rule.graceDays)} />
                  <ReviewRow label="Residential fee" before={text.residential(review.inForce.lateFee.residentialCents)} after={text.residential(review.rule.lateFee.residentialCents)} />
                  <ReviewRow label="Commercial fee" before={`${review.inForce.lateFee.commercialPercent}%`} after={`${review.rule.lateFee.commercialPercent}%`} />
                </TableBody>
              </Table>
              <SaveError message={error} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReview(null)} disabled={pending}>
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () =>
                        addRuleVersion({
                          effectiveFrom: review.effectiveFrom,
                          graceDays: review.rule.graceDays,
                          residentialCents: review.rule.lateFee.residentialCents,
                          commercialPercent: review.rule.lateFee.commercialPercent,
                        }),
                      { title: 'Rule version added', description: `Applies to rent due from ${date(review.effectiveFrom)}.` },
                    )
                  }
                >
                  {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
                  Add rule version
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </form>
  )
}

function ReviewRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <TableRow>
      <TableCell className="pl-0 text-muted-foreground">{label}</TableCell>
      <TableCell className="tabular-nums">{before}</TableCell>
      <TableCell className={before === after ? 'tabular-nums' : 'font-semibold text-foreground tabular-nums'}>{after}</TableCell>
    </TableRow>
  )
}

function statusOf(rule: FinanceRuleVersion, current: FinanceRuleVersion, today: string): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (rule.id === current.id) return { label: 'In force', variant: 'default' }
  if (rule.effectiveFrom > today) return { label: 'Upcoming', variant: 'secondary' }
  return { label: 'Past', variant: 'outline' }
}

function RuleHistory({ settings }: { settings: WorkspaceSettings }) {
  const { date, dateTime, money } = useFormat()
  const today = todayIso()
  const rows = [...settings.rules].reverse()
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Rule history
        </CardTitle>
        <CardDescription>Every version, newest first. Read-only: versions are never edited or removed, so past charges always keep the rule they were due under.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="hidden md:block">
          <Table aria-label="Rent and late-fee rule versions">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Applies from</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Grace period</TableHead>
                <TableHead className="text-right">Residential fee</TableHead>
                <TableHead className="text-right">Commercial fee</TableHead>
                <TableHead className="pr-5">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rule) => {
                const status = statusOf(rule, settings.currentRule, today)
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="pl-5 font-medium whitespace-nowrap">{date(rule.effectiveFrom)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rule.graceDays} {rule.graceDays === 1 ? 'day' : 'days'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(rule.lateFee.residentialCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rule.lateFee.commercialPercent}%</TableCell>
                    <TableCell className="pr-5 whitespace-nowrap text-muted-foreground">{rule.id === 'rule_initial' ? 'When Finance started' : dateTime(rule.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <ul aria-label="Rent and late-fee rule versions" className="flex flex-col divide-y divide-border px-5 md:hidden">
          {rows.map((rule) => {
            const status = statusOf(rule, settings.currentRule, today)
            return (
              <li key={rule.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">From {date(rule.effectiveFrom)}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-caption text-muted-foreground tabular-nums">
                  {rule.graceDays} {rule.graceDays === 1 ? 'day' : 'days'} grace · {money(rule.lateFee.residentialCents)} residential · {rule.lateFee.commercialPercent}% commercial
                </p>
                <p className="text-caption text-muted-foreground">Added {rule.id === 'rule_initial' ? 'when Finance started' : dateTime(rule.createdAt)}</p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

