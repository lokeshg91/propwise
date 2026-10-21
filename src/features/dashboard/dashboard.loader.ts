import { getDashboardData } from '@/data/services'

export async function dashboardLoader() {
  return getDashboardData()
}
