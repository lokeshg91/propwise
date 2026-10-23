/** Report period presets (Phase 9). Whole calendar months, like Finance. */
export const REPORT_RANGE_PRESETS = ['this-month', 'last-month', '3m', '6m', '12m', 'ytd', 'last-year'] as const
export type ReportRangePreset = (typeof REPORT_RANGE_PRESETS)[number]

/** Workspace preferences stored with the data (theme and sidebar stay device preferences). */
export interface AppSettings {
  /** Period a report opens with. */
  defaultReportRange: ReportRangePreset
}

export const SETTINGS_SECTIONS = ['general', 'finance', 'rules', 'data'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

/** One change made in Settings. Values are stored as display text, as they read at the time. */
export interface SettingsEvent {
  id: string
  section: SettingsSection
  title: string
  description: string
  before?: string
  after?: string
  createdAt: string
}
