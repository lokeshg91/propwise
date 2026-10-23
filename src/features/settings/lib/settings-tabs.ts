import { SETTINGS_SECTIONS, type SettingsSection } from '@/types'

export const SETTINGS_TAB_LABELS: Record<SettingsSection, string> = {
  general: 'General',
  finance: 'Finance',
  rules: 'Rent & late fees',
  data: 'Data & storage',
}

export const isSettingsTab = (value: string | null): value is SettingsSection => (SETTINGS_SECTIONS as readonly (string | null)[]).includes(value)
