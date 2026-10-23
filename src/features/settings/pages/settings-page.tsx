import { useCallback, useEffect, useRef, useState } from 'react'
import { useLoaderData, useRevalidator, useSearchParams } from 'react-router'

import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataSettings } from '@/features/settings/components/data-settings'
import { FinanceSettings } from '@/features/settings/components/finance-settings'
import { GeneralSettings } from '@/features/settings/components/general-settings'
import { RuleSettings } from '@/features/settings/components/rule-settings'
import { isSettingsTab, SETTINGS_TAB_LABELS } from '@/features/settings/lib/settings-tabs'
import { type settingsLoader } from '@/features/settings/settings.loaders'
import { SETTINGS_SECTIONS, type SettingsSection } from '@/types'

/** Settings: General, Finance, Rent & late fees, Data & storage (`?tab=`). Each form saves on its own. */
export function SettingsPage() {
  const { settings, summary } = useLoaderData<typeof settingsLoader>()
  const revalidator = useRevalidator()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: SettingsSection = isSettingsTab(tabParam) ? tabParam : 'general'
  // A restore or reset replaces every setting: remount the forms so none keeps a value from before.
  const [generation, setGeneration] = useState(0)
  const tabStrip = useRef<HTMLDivElement>(null)

  // On narrow screens the tab strip scrolls sideways: keep the selected tab in view (e.g. when opened at ?tab=data).
  useEffect(() => {
    const strip = tabStrip.current
    const selected = strip?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    if (!strip || !selected) return
    const left = selected.offsetLeft // the strip is the offset parent (relative)
    if (left < strip.scrollLeft || left + selected.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = Math.max(0, left - (strip.clientWidth - selected.offsetWidth) / 2)
    }
  }, [tab])

  const setTab = useCallback(
    (next: string) => {
      if (!isSettingsTab(next)) return
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next === 'general') updated.delete('tab')
          else updated.set('tab', next)
          return updated
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const refresh = useCallback(() => void revalidator.revalidate(), [revalidator])
  const replaced = useCallback(() => {
    setGeneration((value) => value + 1)
    void revalidator.revalidate()
  }, [revalidator])

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader title="Settings" description="Workspace settings for this browser. Changes apply across Propwise, except the Dashboard, which shows fixed sample figures." />
      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div ref={tabStrip} className="relative -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-10 gap-4">
            {SETTINGS_SECTIONS.map((section) => (
              <TabsTrigger key={section} value={section} className="px-1">
                {SETTINGS_TAB_LABELS[section]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div key={generation}>
          <TabsContent value="general">
            <GeneralSettings settings={settings} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="finance">
            <FinanceSettings settings={settings} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="rules">
            <RuleSettings settings={settings} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="data">
            <DataSettings settings={settings} summary={summary} onChanged={replaced} />
          </TabsContent>
        </div>
      </Tabs>
    </PageContainer>
  )
}
