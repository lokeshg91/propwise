import { getSettings, getWorkspaceSummary } from '@/data/services'

/** Workspace settings, rule history and the data summary (record counts, storage). */
export async function settingsLoader() {
  const [settings, summary] = await Promise.all([getSettings(), getWorkspaceSummary()])
  return { settings, summary }
}

export type SettingsData = Awaited<ReturnType<typeof settingsLoader>>
