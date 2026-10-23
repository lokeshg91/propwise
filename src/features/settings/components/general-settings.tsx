import { useMemo, useState } from 'react'

import { THEME_OPTIONS } from '@/components/shared/theme-options'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { REGION_OPTIONS, regionName, REPORT_RANGE_LABELS, updateGeneralSettings, updateRegion, type WorkspaceSettings } from '@/data/services'
import { SelectField } from '@/features/finance/components/form-parts'
import { SaveFooter, SettingsCard } from '@/features/settings/components/settings-card'
import { useSaveAction } from '@/features/settings/hooks/use-save-action'
import { useTheme } from '@/hooks/use-theme'
import { createFormatters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { REPORT_RANGE_PRESETS, type ReportRangePreset } from '@/types'

const PREVIEW = { cents: 125050, amount: 1234567.5, date: '2026-10-24', time: '2026-10-24T21:30:00' }

/** General: theme (this browser), region and the default report period (workspace). */
export function GeneralSettings({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <ThemeCard />
      <RegionCard settings={settings} onSaved={onSaved} />
      <ReportPeriodCard settings={settings} onSaved={onSaved} />
    </div>
  )
}

function ThemeCard() {
  const { theme, setTheme } = useTheme()
  return (
    <SettingsCard title="Theme" description="Applies straight away and is kept in this browser only. Backups, restores and resets don’t change it.">
      <RadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)} aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            htmlFor={`theme-${value}`}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50',
              theme === value && 'border-primary bg-accent/50 ring-1 ring-primary',
            )}
          >
            <RadioGroupItem id={`theme-${value}`} value={value} />
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-body font-medium text-foreground">{label}</span>
          </label>
        ))}
      </RadioGroup>
      <p className="text-caption text-muted-foreground">System follows your device’s light or dark setting.</p>
    </SettingsCard>
  )
}

function RegionCard({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  const [locale, setLocale] = useState(settings.locale)
  const { pending, error, run } = useSaveAction(onSaved)
  const preview = useMemo(() => createFormatters({ currency: settings.currency, locale }), [settings.currency, locale])
  const dirty = locale !== settings.locale

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void run(() => updateRegion(locale), { title: 'Region saved', description: `Formats now follow ${regionName(locale)}.` })
      }}
    >
      <SettingsCard
        title="Region"
        description="Sets number, currency and date formats everywhere except the Dashboard, which keeps its fixed sample formats. Words stay in English."
        footer={<SaveFooter error={error} pending={pending} dirty={dirty} />}
      >
        <SelectField
          label="Region"
          value={locale}
          onChange={setLocale}
          placeholder="Choose a region"
          options={REGION_OPTIONS.map((option) => ({ value: option.locale, label: `${option.name} (${option.locale})` }))}
        />
        <div aria-live="polite" className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="mb-2 text-caption font-semibold tracking-wider text-muted-foreground uppercase">Preview</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-body">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="text-foreground tabular-nums">{preview.money(PREVIEW.cents)}</dd>
            <dt className="text-muted-foreground">Number</dt>
            <dd className="text-foreground tabular-nums">{preview.number(PREVIEW.amount)}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-foreground">{preview.date(PREVIEW.date)}</dd>
            <dt className="text-muted-foreground">Date and time</dt>
            <dd className="text-foreground">{preview.dateTime(PREVIEW.time)}</dd>
          </dl>
        </div>
      </SettingsCard>
    </form>
  )
}

function ReportPeriodCard({ settings, onSaved }: { settings: WorkspaceSettings; onSaved: () => void }) {
  const [range, setRange] = useState<ReportRangePreset>(settings.appSettings.defaultReportRange)
  const { pending, error, run } = useSaveAction(onSaved)
  const dirty = range !== settings.appSettings.defaultReportRange

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void run(() => updateGeneralSettings({ defaultReportRange: range }), { title: 'Default report period saved', description: REPORT_RANGE_LABELS[range] })
      }}
    >
      <SettingsCard
        title="Default report period"
        description="The period reports open with. You can still pick another period in each report."
        footer={<SaveFooter error={error} pending={pending} dirty={dirty} />}
      >
        <SelectField
          label="Report period"
          value={range}
          onChange={(value) => setRange(value as ReportRangePreset)}
          placeholder="Choose a period"
          options={REPORT_RANGE_PRESETS.map((value) => ({ value, label: REPORT_RANGE_LABELS[value] }))}
          hint="Whole calendar months, like Finance."
        />
      </SettingsCard>
    </form>
  )
}
