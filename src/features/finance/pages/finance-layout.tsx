import { Outlet } from 'react-router'

/**
 * Finance section layout. The currency and region come from the workspace
 * settings (`SettingsProvider`), so the layout only renders the page; its
 * loader makes sure Finance data is ready first.
 */
export function FinanceLayout() {
  return <Outlet />
}
